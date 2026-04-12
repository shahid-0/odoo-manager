import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Docker from "dockerode";

const docker = new Docker();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database for projects (in a real app, use a real DB)
  let projects: any[] = [];

  // API routes
  app.get("/api/projects", (req, res) => {
    res.json(projects);
  });

  app.post("/api/projects/deploy", async (req, res) => {
    const { projectId, config, name } = req.body;
    
    try {
      // Check if docker is installed and running
      await docker.ping();
      
      console.log(`Deploying project ${name} (${projectId})...`);
      
      const odooImage = `odoo:${config.odooVersion}`;
      const dbImage = "postgres:15";

      // Pull images if they don't exist
      // Note: In a real production environment, you'd handle this as a background task with progress
      
      let dbContainer;
      if (config.includePostgres) {
        console.log("Creating database container...");
        dbContainer = await docker.createContainer({
          Image: dbImage,
          name: `${name.toLowerCase().replace(/\s+/g, '-')}-db-${projectId.slice(0, 8)}`,
          Env: [
            `POSTGRES_DB=${config.dbName}`,
            `POSTGRES_PASSWORD=${config.dbPassword}`,
            "POSTGRES_USER=odoo"
          ],
          HostConfig: {
            RestartPolicy: { Name: "always" }
          }
        });
        await dbContainer.start();
      }

      console.log("Creating Odoo container...");
      const odooContainer = await docker.createContainer({
        Image: odooImage,
        name: `${name.toLowerCase().replace(/\s+/g, '-')}-odoo-${projectId.slice(0, 8)}`,
        Env: [
          `HOST=${dbContainer ? dbContainer.id.slice(0, 12) : 'localhost'}`,
          `USER=odoo`,
          `PASSWORD=${config.dbPassword}`,
          `DB_NAME=${config.dbName}`
        ],
        ExposedPorts: {
          "8069/tcp": {}
        },
        HostConfig: {
          PortBindings: {
            "8069/tcp": [{ HostPort: "" }] // Auto-assign a host port
          },
          RestartPolicy: { Name: "always" },
          Memory: config.resourceLimits.memory ? parseInt(config.resourceLimits.memory) * 1024 * 1024 : undefined,
          NanoCpus: config.resourceLimits.cpu ? parseFloat(config.resourceLimits.cpu) * 1e9 : undefined
        }
      });
      await odooContainer.start();

      const inspect = await odooContainer.inspect();
      const port = inspect.NetworkSettings.Ports["8069/tcp"][0].HostPort;

      res.json({ 
        status: "running", 
        message: "Deployment successful",
        containerId: odooContainer.id,
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

  app.post("/api/projects/test-config", async (req, res) => {
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

      // Test 4: Validate configuration values
      if (!config.dbName || config.dbName.trim() === '') {
        results.push("⚠ Warning: Database name is empty.");
      } else {
        results.push(`Database name: '${config.dbName}' — OK.`);
      }

      if (!config.dbPassword || config.dbPassword.trim() === '') {
        results.push("⚠ Warning: Database password is empty.");
      } else if (config.dbPassword === 'odoo_password') {
        results.push("⚠ Warning: Using default password. Change this for production.");
      } else {
        results.push("Database password is set — OK.");
      }

      // Test 5: Resource limits validation
      if (config.resourceLimits.memory) {
        results.push(`Memory limit: ${config.resourceLimits.memory} — OK.`);
      }
      if (config.resourceLimits.cpu) {
        results.push(`CPU limit: ${config.resourceLimits.cpu} — OK.`);
      }

      // Test 6: Check for container name conflicts
      try {
        const containers = await docker.listContainers({ all: true });
        const safeName = name.toLowerCase().replace(/\s+/g, '-');
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

      res.json({ status: "ok", results });
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        message: error.message || "Configuration test failed." 
      });
    }
  });

  app.get("/api/projects/:id/logs", async (req, res) => {
    const containerId = req.query.containerId as string;
    if (!containerId) {
      return res.json({ logs: ["[SYSTEM] No container ID provided."] });
    }

    try {
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 50,
        timestamps: true
      });
      
      // Docker logs are returned as a Buffer with headers, we need to clean them up
      const logsStr = logs.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, "").split('\n').filter(Boolean);
      res.json({ logs: logsStr });
    } catch (error) {
      res.json({ logs: [`[ERROR] Failed to fetch logs: ${error}`] });
    }
  });

  app.post("/api/projects/:id/stop", async (req, res) => {
    const containerId = req.body.containerId;
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
      res.json({ status: "stopped" });
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

startServer();
