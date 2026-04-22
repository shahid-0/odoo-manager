import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'odoo-manager.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Creates all tables if they don't already exist.
 * Safe to call on every app startup — uses IF NOT EXISTS throughout.
 */
function createSchema(): void {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      username       TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL CHECK(role IN ('admin', 'developer', 'viewer')),
      created_at     TEXT NOT NULL,
      last_login_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id               TEXT PRIMARY KEY,
      org_id           TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      description      TEXT NOT NULL DEFAULT '',
      status           TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'deploying', 'running', 'error', 'stopped')),
      container_id     TEXT,
      db_container_id  TEXT,
      port             TEXT,
      created_at       TEXT NOT NULL,
      config           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      message     TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
    CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);
    CREATE INDEX IF NOT EXISTS idx_project_logs_project_id ON project_logs(project_id);
  `);
}

createSchema();

export default db;