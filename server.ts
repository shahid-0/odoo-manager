import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

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

  app.post("/api/projects/deploy", (req, res) => {
    const { projectId, config } = req.body;
    console.log(`Deploying project ${projectId}...`);
    
    // Simulate deployment process
    setTimeout(() => {
      console.log(`Project ${projectId} deployed successfully.`);
    }, 2000);

    res.json({ status: "deploying", message: "Deployment started" });
  });

  app.get("/api/projects/:id/logs", (req, res) => {
    const id = req.params.id;
    // Simulate logs
    const logs = [
      `[${new Date().toISOString()}] Starting Odoo instance...`,
      `[${new Date().toISOString()}] Database connected.`,
      `[${new Date().toISOString()}] HTTP service started on port 8069.`,
      `[${new Date().toISOString()}] Loading modules...`,
      `[${new Date().toISOString()}] Odoo is up and running.`
    ];
    res.json({ logs });
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
