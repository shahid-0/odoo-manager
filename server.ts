import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Docker from "dockerode";
import fs from "fs/promises";
import { Organization, Project } from "./src/types.js";
import { streamContainerStats } from "./src/stats.js";
import { backupOdooDatabase, restoreOdooDatabase, listBackups, deleteBackup } from "./src/backup.js";
import { initUserStore } from "./src/lib/users.js";
import { requireAuth, requireAdmin, requireDeveloper } from "./src/auth.js";
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/users.js";
import * as store from "./src/lib/store.js";

const docker = new Docker();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Persistent storage for organizations and projects
// Removed: loadMetadata/saveMetadata (now handled by sqlite)

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize user store — creates default admin if data/users.json is missing
  await initUserStore();

  // Mount auth routes (login, logout, /me) — login has its own rate limiter
  app.use("/api/auth", authRoutes);

  // Mount user management routes (admin-only, middleware applied inside)
  app.use("/api/users", userRoutes);

  const deploymentLogs: Record<string, string[]> = {};

  // ─── Route-level middleware application pattern ───
  // GET (read) routes use requireAuth: both admin and viewer roles can access.
  // POST/PUT/PATCH/DELETE (mutation) routes use requireAdmin or requireDeveloper.
  // This pattern keeps authorization declarative at the route level rather than
  // scattering role checks inside individual handlers.

  // API routes — READ (requireAuth: admin + viewer)
  app.get("/api/organizations", requireAuth, (req, res) => {
    res.json(store.getOrganizations());
  });

  // MUTATION routes (requireAdmin: admin only)
  app.post("/api/organizations", requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Organization name is required" });
    const org = store.createOrganization(name);
    res.json(org);
  });

  app.post("/api/organizations/:orgId/projects", requireDeveloper, async (req, res) => {
    const { orgId } = req.params;
    const { name, description, config } = req.body;
    
    const org = store.getOrganizationById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    
    const project = store.createProject(orgId, { name, description, config });
    res.json(project);
  });

  app.delete("/api/organizations/:orgId", requireAdmin, async (req, res) => {
    const { orgId } = req.params;
    
    const org = store.getOrganizationById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    
    if (org.projects.length > 0) {
      return res.status(400).json({ error: "Please delete all projects before deleting the organization." });
    }
    
    store.deleteOrganization(orgId);
    res.json({ success: true });
  });

  app.put("/api/projects/:projectId", requireDeveloper, async (req, res) => {
    const { projectId } = req.params;
    const updates = req.body;
    
    const updated = store.updateProject(projectId, updates);
    if (updated) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Project not found" });
    }
  });

  app.post("/api/projects/deploy", requireDeveloper, async (req, res) => {
    const { projectId, config, name, forcePull } = req.body;
    
    store.appendProjectLog(projectId, `🚀 Deployment started (Force Pull: ${forcePull})`);

    try {
      // Check if docker is installed and running
      await docker.ping();
      
      const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const networkName = `${safeName}-network-${projectId.slice(0, 8)}`;
      const dbUser = config.dbUser || 'odoo';

      deploymentLogs[projectId] = [`[SYSTEM] Starting deployment for ${name} (${projectId})...`];
      const appendLog = (msg: string) => {
        deploymentLogs[projectId].push(msg);
      };

      appendLog(`[SYSTEM] Checked Docker connection.`);
      
      const odooImage = `odoo:${config.odooVersion}`;
      const dbImage = "postgres:15";

      // Pull images if not available locally, or if forced
      await pullImageIfNeeded(odooImage, appendLog, forcePull);
      if (config.includePostgres) {
        await pullImageIfNeeded(dbImage, appendLog, forcePull);
      }

      // Create a Docker network for inter-container communication
      let network;
      try {
        network = await docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
        });
        console.log(`Created network: ${networkName}`);
      } catch (e: any) {
        // If network already exists, use it
        const networks = await docker.listNetworks({ filters: { name: [networkName] } });
        if (networks.length > 0) {
          network = docker.getNetwork(networks[0].Id);
        } else {
          throw e;
        }
      }

      let dbContainerId: string | undefined;

      if (config.includePostgres) {
        console.log("Creating database container...");
        const dbContainerName = `${safeName}-db-${projectId.slice(0, 8)}`;
        
        try {
          const existingDb = docker.getContainer(dbContainerName);
          await existingDb.remove({ force: true });
        } catch (e) {
          // Ignored if it doesn't exist
        }
        
        const dbContainer = await docker.createContainer({
          Image: dbImage,
          name: dbContainerName,
          Env: [
            `POSTGRES_DB=${config.dbName}`,
            `POSTGRES_PASSWORD=${config.dbPassword}`,
            `POSTGRES_USER=${dbUser}`,
            `PGDATA=/var/lib/postgresql/data/pgdata`,
          ],
          HostConfig: {
            RestartPolicy: { Name: "always" },
            Binds: [
              `${safeName}-db-data-${projectId.slice(0, 8)}:/var/lib/postgresql/data/pgdata`,
            ],
          },
          NetworkingConfig: {
            EndpointsConfig: {
              [networkName]: {
                Aliases: ['db'],
              },
            },
          },
        });
        await dbContainer.start();
        dbContainerId = dbContainer.id;
        console.log(`Database container started: ${dbContainerName}`);

        // Give PostgreSQL a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log("Creating Odoo container...");
      const odooContainerName = `${safeName}-odoo-${projectId.slice(0, 8)}`;

      // Build volume bindings
      const binds = [
        `${safeName}-web-data-${projectId.slice(0, 8)}:/var/lib/odoo`,
      ];

      // Add custom addon mounts from array
      const addonsPaths = config.addonsPaths || [];
      addonsPaths.forEach((p: string, i: number) => {
        if (p && p.trim()) {
           binds.push(`${path.resolve(p.trim())}:/mnt/extra-addons-${i}`);
        }
      });

      try {
        const existingOdoo = docker.getContainer(odooContainerName);
        await existingOdoo.remove({ force: true });
      } catch (e) {
        // Ignored if it doesn't exist
      }

      const odooContainer = await docker.createContainer({
        Image: odooImage,
        name: odooContainerName,
        Env: [
          `HOST=db`,
          `USER=${dbUser}`,
          `PASSWORD=${config.dbPassword}`,
        ],
        ExposedPorts: {
          "8069/tcp": {}
        },
        HostConfig: {
          PortBindings: {
            "8069/tcp": [{ HostPort: String(config.hostPort || 8069) }]
          },
          RestartPolicy: { Name: "always" },
          Binds: binds,
          Memory: config.resourceLimits?.memory ? parseMemoryString(config.resourceLimits.memory) : undefined,
          NanoCpus: config.resourceLimits?.cpu ? parseFloat(config.resourceLimits.cpu) * 1e9 : undefined,
        },
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: {},
          },
        },
      });
      await odooContainer.start();

      const inspect = await odooContainer.inspect();
      const port = inspect.NetworkSettings.Ports["8069/tcp"][0].HostPort;

      console.log(`Odoo container started on port ${port}: ${odooContainerName}`);

      // Update project in metadata
      store.setProjectContainers(projectId, {
        containerId: odooContainer.id,
        dbContainerId: dbContainerId,
        port: port,
        status: "running"
      });

      res.json({ 
        status: "running", 
        message: "Deployment successful",
        containerId: odooContainer.id,
        dbContainerId: dbContainerId,
        port: port
      });
    } catch (error: any) {
      console.error("Docker operation failed:", error);
      res.status(500).json({ 
        status: "error", 
        message: error.message || "Docker operation failed. Please ensure Docker is running." 
      });
    }
  });

  app.post("/api/projects/test-config", requireDeveloper, async (req, res) => {
    const { config, name } = req.body;
    const results: string[] = [];
    
    try {
      // Test 1: Check Docker connectivity
      try {
        await docker.ping();
        results.push("Docker daemon is running and accessible.");
      } catch (e) {
        return res.status(500).json({ 
          status: "error", 
          message: "Docker is not running or not accessible. Please start Docker Desktop." 
        });
      }

      // Test 2: Check if the Odoo image exists locally
      const odooImage = `odoo:${config.odooVersion}`;
      try {
        const images = await docker.listImages({ filters: { reference: [odooImage] } });
        if (images.length > 0) {
          results.push(`Odoo image '${odooImage}' found locally.`);
        } else {
          results.push(`Odoo image '${odooImage}' not found locally — it will be pulled on deploy.`);
        }
      } catch (e) {
        results.push(`Could not check Odoo image: ${e}`);
      }

      // Test 3: Check if PostgreSQL image exists locally
      if (config.includePostgres) {
        try {
          const pgImages = await docker.listImages({ filters: { reference: ["postgres:15"] } });
          if (pgImages.length > 0) {
            results.push("PostgreSQL image 'postgres:15' found locally.");
          } else {
            results.push("PostgreSQL image 'postgres:15' not found locally — it will be pulled on deploy.");
          }
        } catch (e) {
          results.push(`Could not check PostgreSQL image: ${e}`);
        }
      }

      // Test 4: Validate Odoo version is supported
      const supportedVersions = ['17.0', '18.0', '19.0'];
      if (supportedVersions.includes(config.odooVersion)) {
        results.push(`Odoo version ${config.odooVersion} is officially supported.`);
      } else {
        results.push(`⚠ Warning: Odoo version '${config.odooVersion}' may not be officially supported. Supported versions: ${supportedVersions.join(', ')}.`);
      }

      // Test 5: Validate configuration values
      if (!config.dbName || config.dbName.trim() === '') {
        results.push("⚠ Warning: Database name is empty.");
      } else {
        results.push(`Database name: '${config.dbName}' — OK.`);
      }

      const dbUser = config.dbUser || 'odoo';
      results.push(`Database user: '${dbUser}' — OK.`);

      if (!config.dbPassword || config.dbPassword.trim() === '') {
        results.push("⚠ Warning: Database password is empty.");
      } else if (config.dbPassword === 'odoo') {
        results.push("⚠ Warning: Using default password 'odoo'. Change this for production.");
      } else {
        results.push("Database password is set — OK.");
      }

      // Test 6: Resource limits validation
      if (config.resourceLimits?.memory) {
        try {
          const bytes = parseMemoryString(config.resourceLimits.memory);
          results.push(`Memory limit: ${config.resourceLimits.memory} (${(bytes / 1024 / 1024).toFixed(0)} MB) — OK.`);
        } catch (e) {
          results.push(`⚠ Warning: Invalid memory format '${config.resourceLimits.memory}'. Use format like: 512m, 1g, 2g.`);
        }
      }
      if (config.resourceLimits?.cpu) {
        results.push(`CPU limit: ${config.resourceLimits.cpu} — OK.`);
      }

      // Test 7: Check for container name conflicts
      try {
        const containers = await docker.listContainers({ all: true });
        const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const conflicting = containers.filter((c: any) => 
          c.Names.some((n: string) => n.includes(safeName))
        );
        if (conflicting.length > 0) {
          results.push(`⚠ Warning: ${conflicting.length} existing container(s) found with similar name '${safeName}'.`);
        } else {
          results.push("No container name conflicts detected — OK.");
        }
      } catch (e) {
        results.push(`Could not check for container conflicts: ${e}`);
      }

      // Test 8: Check addons path
      if (config.addonsPath && config.addonsPath.trim()) {
        results.push(`Custom addons path: '${config.addonsPath}' will be mounted at /mnt/extra-addons.`);
      } else {
        results.push("No custom addons path specified.");
      }

      if (config.enterpriseAddonsPath && config.enterpriseAddonsPath.trim()) {
        results.push(`Enterprise addons path: '${config.enterpriseAddonsPath}' will be mounted at /mnt/enterprise-addons.`);
      }

      res.json({ status: "ok", results });
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        message: error.message || "Configuration test failed." 
      });
    }
  });

  app.get("/api/projects/:id/logs", requireAuth, async (req, res) => {
    const containerId = req.query.containerId as string;
    const projectId = req.params.id;

    if (!containerId || containerId === "undefined") {
      const logs = deploymentLogs[projectId] || ["[SYSTEM] Waiting for deployment to start..."];
      return res.json({ logs });
    }

    try {
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 50,
        timestamps: true
      });
      
      // Docker logs are returned as a multiplexed Buffer if tty isn't enabled.
      let logBuffer = logs as unknown as Buffer;
      if (!Buffer.isBuffer(logBuffer)) logBuffer = Buffer.from(logBuffer as any);
      
      const logsArr: string[] = [];
      let offset = 0;
      while (offset < logBuffer.length) {
        if (offset + 8 > logBuffer.length) break;
        // Header: [stream type (1 byte), 0, 0, 0, length (4 bytes)]
        const len = logBuffer.readUInt32BE(offset + 4);
        offset += 8;
        if (offset + len > logBuffer.length) break;
        logsArr.push(logBuffer.slice(offset, offset + len).toString('utf8'));
        offset += len;
      }
      
      // Remove Terminal ANSI Color Codes since UI renders raw text
      const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const logsStr = logsArr.join('')
        .split('\n')
        .map(line => line.replace(ansiRegex, '').trim())
        .filter(Boolean);
        
      res.json({ logs: logsStr });
    } catch (error) {
      res.json({ logs: [`[ERROR] Failed to fetch logs: ${error}`] });
    }
  });

  app.post("/api/projects/:id/stop", requireDeveloper, async (req, res) => {
    const { containerId, dbContainerId } = req.body;
    try {
      // Stop Odoo container
      if (containerId) {
        const container = docker.getContainer(containerId);
        await container.stop();
        console.log(`Stopped Odoo container: ${containerId.slice(0, 12)}`);
      }
      // Stop DB container
      if (dbContainerId) {
        const dbContainer = docker.getContainer(dbContainerId);
        await dbContainer.stop();
        console.log(`Stopped DB container: ${dbContainerId.slice(0, 12)}`);
      }
      
      store.setProjectStatus(req.params.id, 'stopped');
      store.appendProjectLog(req.params.id, `🛑 Project containers stopped`);

      res.json({ status: "stopped" });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/projects/:id/start", requireDeveloper, async (req, res) => {
    const { containerId, dbContainerId } = req.body;
    try {
      let port;
      // Start DB container
      if (dbContainerId) {
        const dbContainer = docker.getContainer(dbContainerId);
        await dbContainer.start();
        console.log(`Started DB container: ${dbContainerId.slice(0, 12)}`);
      }
      
      // Wait a moment for DB to start up if it was provided
      if (dbContainerId) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Start Odoo container
      if (containerId) {
        const container = docker.getContainer(containerId);
        await container.start();
        const inspect = await container.inspect();
        // Fallback or read the port binding
        port = inspect.NetworkSettings.Ports["8069/tcp"]?.[0]?.HostPort;
        console.log(`Started Odoo container: ${containerId.slice(0, 12)} on port ${port || 'unknown'}`);
      }
      // Update status in metadata
      store.updateProject(req.params.id, { status: 'running', port: port });
      store.appendProjectLog(req.params.id, `▶️ Project containers started`);

      res.json({ status: "running", port });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/projects/:id", requireDeveloper, async (req, res) => {
    const projectId = req.params.id;
    const { containerId, dbContainerId, name } = req.body;
    
    try {
      if (containerId) {
        try {
          const c = docker.getContainer(containerId);
          await c.remove({ force: true });
        } catch(e) {}
      }
      if (dbContainerId) {
        try {
          const dc = docker.getContainer(dbContainerId);
           await dc.remove({ force: true });
        } catch(e) {}
      }

      if (name) {
        const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const dbContainerName = `${safeName}-db-${projectId.slice(0, 8)}`;
        const odooContainerName = `${safeName}-odoo-${projectId.slice(0, 8)}`;
        try {
          const c1 = docker.getContainer(dbContainerName);
          await c1.remove({ force: true });
        } catch(e) {}
        try {
          const c2 = docker.getContainer(odooContainerName);
          await c2.remove({ force: true });
        } catch(e) {}
      }
      
      store.deleteProject(projectId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:id/stats/stream", requireAuth, async (req, res) => {
    const projectId = req.params.id;
    const type = req.query.type as string; // 'odoo' or 'db'
    
    const p = store.getProjectById(projectId);
    if (!p) return res.status(404).json({ error: "Project not found" });

    const containerId = type === 'db' ? p.dbContainerId : p.containerId;

    if (!containerId) {
      return res.status(404).json({ error: "Container not found or project missing" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stopStreaming = streamContainerStats(
      docker,
      containerId,
      (stats) => {
        res.write(`data: ${JSON.stringify(stats)}\n\n`);
      },
      (err) => {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      }
    );

    req.on('close', () => {
      stopStreaming();
    });
  });

  app.get("/api/projects/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const p = store.getProjectById(id);
    if (p) return res.json(p);
    res.status(404).json({ error: "Project not found" });
  });

  app.patch("/api/organizations/:orgId/projects/:projectId", requireDeveloper, async (req, res) => {
    const { projectId } = req.params;
    const updates = req.body;

    const updated = store.updateProject(projectId, updates);
    if (updated) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Project not found" });
    }
  });

  app.post("/api/projects/:projectId/backup", requireDeveloper, async (req, res) => {
    const { projectId } = req.params;
    const { neutralize, withFilestore } = req.body;
    store.appendProjectLog(projectId, `💾 Initiating backup (${withFilestore ? 'with filestore' : 'no filestore'}, ${neutralize ? 'neutralized' : 'exact'})...`);

    try {
      const project = store.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const meta = await backupOdooDatabase(project, { 
        neutralize: !!neutralize, 
        withFilestore: !!withFilestore 
      }, async (msg) => {
        store.appendProjectLog(projectId, msg);
      });
      
      store.appendProjectLog(projectId, `✅ Backup complete: ${meta.filename}`);
      res.json(meta);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:projectId/backups", requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
      const backups = await listBackups(projectId);
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/projects/:projectId/restore", requireDeveloper, async (req, res) => {
    const { projectId } = req.params;
    const { filepath } = req.body;
    store.appendProjectLog(projectId, `🔄 Starting restoration from: ${path.basename(filepath)}...`);

    try {
      const project = store.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      await restoreOdooDatabase(docker, project, filepath, async (msg) => {
        store.appendProjectLog(projectId, msg);
      });
      
      store.appendProjectLog(projectId, `✅ Database successfully restored from ${path.basename(filepath)}.`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/projects/:projectId/backups/:filename", requireDeveloper, async (req, res) => {
    const { projectId, filename } = req.params;
    try {
      const backups = await listBackups(projectId);
      const backup = backups.find(b => b.filename === filename);
      if (!backup) return res.status(404).json({ error: "Backup not found" });

      await deleteBackup(backup.filepath);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/projects/:projectId/backups/:filename/download", requireAuth, async (req, res) => {
    const { projectId, filename } = req.params;
    try {
      const backups = await listBackups(projectId);
      const backup = backups.find(b => b.filename === filename);
      if (!backup) return res.status(404).json({ error: "Backup not found" });

      res.download(backup.filepath, filename);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

/**
 * Parse a Docker memory string like "512m", "1g", "2g" into bytes.
 */
function parseMemoryString(memStr: string): number {
  const match = memStr.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|k|m|g|kb|mb|gb)?$/);
  if (!match) throw new Error(`Invalid memory format: ${memStr}`);
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  switch (unit) {
    case 'b': return value;
    case 'k':
    case 'kb': return value * 1024;
    case 'm':
    case 'mb': return value * 1024 * 1024;
    case 'g':
    case 'gb': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

/**
 * Helper to pull a Docker image if it's not already available locally, or if forced.
 */
async function pullImageIfNeeded(imageRef: string, appendLog: (msg: string) => void, forcePull: boolean = false) {
  const images = await docker.listImages({ filters: { reference: [imageRef] } });
  if (images.length === 0 || forcePull) {
    appendLog(`[SYSTEM] Starting pull for image ${imageRef}...`);
    
    let lastLogTime = 0;
    const layerProgress: Record<string, string> = {};

    await new Promise((resolve, reject) => {
      docker.pull(imageRef, (err: Error, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, onFinished, onProgress);

        function onFinished(err: Error | null, output: any) {
          if (err) {
            appendLog(`[ERROR] Failed to pull ${imageRef}: ${err.message}`);
            return reject(err);
          }
          appendLog(`[SYSTEM] ✅ Successfully pulled ${imageRef}.`);
          resolve(output);
        }

        function onProgress(event: any) {
          if (!event.id) return;
          layerProgress[event.id] = event.status;
          
          const now = Date.now();
          if (now - lastLogTime > 1000) {
            lastLogTime = now;
            let downloading = 0;
            let extracting = 0;
            let complete = 0;
            let total = Object.keys(layerProgress).length;
            
            for (const id in layerProgress) {
               const status = layerProgress[id].toLowerCase();
               if (status.includes('downloading')) downloading++;
               else if (status.includes('extracting')) extracting++;
               else if (status.includes('complete') || status.includes('pull complete')) complete++;
            }
            if (total > 0) {
               appendLog(`[SYSTEM] Pulling ${imageRef}: ${complete}/${total} layers complete (Downloading: ${downloading}, Extracting: ${extracting})`);
            }
          }
        }
      });
    });
  } else {
    appendLog(`[SYSTEM] Image ${imageRef} found locally.`);
  }
}

startServer();
