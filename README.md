# Odoo Manager

Odoo Manager is an open-source, full-stack application built to seamlessly deploy, manage, and monitor Odoo instances via Docker. It provides a beautiful interface for handling your Odoo deployments and their associated PostgreSQL databases, viewing live container statistics, managing environment variables, and capturing full database backups and restores natively.

## Features

- **Project & Organization Hierarchy:** Manage multiple Odoo deployments under different organizations.
- **One-Click Deployments:** Easily launch standalone or bundled Odoo & PostgreSQL environments.
- **Docker Integration:** Direct communication with the Docker instance via `dockerode` to automatically provision containers, virtual networks, and mounted data volumes.
- **Live Monitoring:** Real-time container resource utilization stats (CPU, Memory).
- **Environment Management:** Easily append and update container environment variables dynamically.
- **Native Database Backups:** Directly integrates with Odoo's native `/web/database/manager` HTTP endpoints to pull `.zip` format complete archive backups and restore databases.

## 🚀 Pre-requisites

Regardless of the installation method, you must have:
- **Docker** and **Docker Compose** installed and running on your host machine.
- If running natively via Node.js: **Node.js 20+** installed.

> [!IMPORTANT]
> Because Odoo Manager connects directly to Docker to launch its target containers, the application requires access to the host's `/var/run/docker.sock`.

---

## 💻 Method 1: Self-Hosting with Docker (Recommended)

Running Odoo Manager in Docker is the easiest method since `docker-compose` is already set up to correctly map the required Docker socket and data volumes.

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/odoo-manager.git
   cd odoo-manager
   ```

2. Start the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```
*(Odoo Manager will automatically save your application data inside the mapped `./data` directory so it persists across container restarts)*

---

## 🛠️ Method 2: Manual Installation (Node.js)

If you'd prefer to run the application directly on your machine without a container wrapper:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-username/odoo-manager.git
   cd odoo-manager
   npm install
   ```

2. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
   *(This starts the backend and Vite frontend development server concurrently)*

3. **Run in Production Mode:**
   ```bash
   # Build the Vite frontend application
   npm run build

   # Start the production server
   npm run start
   ```

4. Navigate to `http://localhost:3000` to start managing!

## 📦 Publishing to Docker Hub

If you wish to publish this image to your own Docker Hub registry:

```bash
# 1. Build the image
docker build -t your-dockerhub-username/odoo-manager:latest .

# 2. Login to Docker Hub
docker login

# 3. Push the image
docker push your-dockerhub-username/odoo-manager:latest
```

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Shadcn UI
- **Backend:** Express, Node.js (`tsx`)
- **Container Management:** Docker & `dockerode`
- **Authentication:** Local filesystem JSON-based user caching (BCrypt + JWT)
