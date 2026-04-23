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
> Because Odoo Manager connects directly to Docker to launch its target containers, the application requires access to the host's Docker socket.

### 🔍 Finding your Docker Socket
Depending on your Operating System, the Docker socket path may vary:

| OS | Default Path | Notes |
| :--- | :--- | :--- |
| **Linux** | `/var/run/docker.sock` | Ensure your user has permissions (`sudo usermod -aG docker $USER`). |
| **macOS** | `/var/run/docker.sock` | If using Docker Desktop, check **Settings > Advanced > Allow the default Docker socket to be used**. |
| **macOS (Alt)** | `~/.docker/run/docker.sock` | Used in newer Docker Desktop versions if the default symlink is disabled. |
| **Windows** | `//./pipe/docker_engine` | This is a named pipe. If running Odoo Manager inside Docker on Windows, use `/var/run/docker.sock` (handled by Docker Desktop). |


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
*(Odoo Manager will automatically save your application data inside the mapped `src/data` directory so it persists across container restarts)*

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
- **Persistence:** SQLite Database (`better-sqlite3`) for metadata, logs, and users.
- **Container Management:** Docker & `dockerode`
- **Authentication:** JWT-based auth with BCrypt password hashing.

---

## 📄 Docker Hub Overview
*Copy the content below to your Docker Hub "Full Description" field:*

# Odoo Manager
**Odoo Manager** is a professional, full-stack application designed to simplify the deployment and management of Odoo instances using Docker. It provides a clean interface for handling multiple organizations, managing containers, monitoring resource usage, and performing native database backups.

### 🚀 Key Features
- **Organization & Project Hierarchy**: Group your Odoo deployments by client or organization.
- **One-Click Deployments**: Effortlessly launch Odoo & PostgreSQL container bundles.
- **Live Resource Monitoring**: Real-time CPU and Memory usage statistics for every instance.
- **Native Database Backups**: Direct integration with Odoo's native backup/restore API.
- **Persistent SQLite Backend**: All application metadata and logs are stored in a robust SQLite database.
- **Multi-Role Auth**: Built-in Admin, Developer, and Viewer roles with JWT security.

### 🛠️ Quick Start (Docker Compose)
Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  odoo-manager:
    image: your-username/odoo-manager:latest
    container_name: odoo-manager
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=generate-a-strong-secret-key
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - odoo_manager_data:/app/src/data
    restart: unless-stopped

volumes:
  odoo_manager_data:
```

1. Replace `your-username` with your Docker Hub username.
2. Run `docker compose up -d`.
3. Access at `http://localhost:3000`.
4. **Default Login**: `admin` / `admin123`.

### 📋 Environment Variables
| Variable | Description | Default |
| :--- | :--- | :--- |
| `JWT_SECRET` | **Required.** Secret key for tokens. | - |
| `PORT` | App port inside container. | `3000` |

### 📦 Persistence
Mount a volume to `/app/src/data` to persist your database and backups.
