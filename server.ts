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
