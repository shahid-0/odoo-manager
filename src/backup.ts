import Docker from 'dockerode';
import fs from 'fs/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Project } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BackupMeta {
  filename: string;
  filepath: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Backs up an Odoo database using Odoo's internal backup API.
 */
export async function backupOdooDatabase(
  project: Project, 
  options: { neutralize: boolean; withFilestore: boolean }
): Promise<BackupMeta> {
  if (!project.port) throw new Error("Project port not found. Is the container running?");
  
  const odooUrl = `http://localhost:${project.port}/web/database/backup`;
  const masterPwd = project.config.masterPassword || 'admin';
  const backupFormat = options.withFilestore ? 'zip' : 'dump';

  const backupDir = path.join(__dirname, '../data/backups', project.id);
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const extension = options.withFilestore ? '.zip' : '.sql';
  const prefix = options.neutralize ? 'neutralized-' : 'exact-';
  const filename = `${prefix}${new Date().valueOf()}${extension}`;
  const filepath = path.join(backupDir, filename);

  const params = new URLSearchParams();
  params.append('master_pwd', masterPwd);
  params.append('name', project.config.dbName);
  params.append('backup_format', backupFormat);
  // Neutralization is supported in Odoo 16+ backup API
  if (options.neutralize) {
    params.append('backup_mode', 'neutralize');
  }

  const response = await fetch(odooUrl, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odoo backup failed (${response.status}): ${errorText.slice(0, 100)}`);
  }

  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return {
    filename,
    filepath,
    sizeBytes: buffer.length,
    createdAt: new Date().toISOString()
  };
}

/**
 * Drops an Odoo database using Odoo's internal API.
 */
export async function dropOdooDatabase(project: Project): Promise<void> {
  if (!project.port) throw new Error("Project port not found.");
  const odooUrl = `http://localhost:${project.port}/web/database/drop`;
  const masterPwd = project.config.masterPassword || 'admin';

  const params = new URLSearchParams();
  params.append('master_pwd', masterPwd);
  params.append('name', project.config.dbName);

  const response = await fetch(odooUrl, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Ignore if database doesn't exist already
    if (!errorText.includes('does not exist')) {
      throw new Error(`Odoo drop failed (${response.status}): ${errorText.slice(0, 100)}`);
    }
  }
}

/**
 * Restores an Odoo database using Odoo's internal restore API.
 */
export async function restoreOdooDatabase(
  project: Project, 
  backupFilepath: string,
  neutralize: boolean = false
): Promise<void> {
  if (!project.port) throw new Error("Project port not found. Is the container running?");
  if (!existsSync(backupFilepath)) throw new Error("Backup file does not exist.");

  // 1. First drop the existing database to avoid "already exists" error
  await dropOdooDatabase(project).catch(err => {
    console.warn("Drop database failed (might not exist):", err.message);
  });

  // 2. Perform the restore
  const odooUrl = `http://localhost:${project.port}/web/database/restore`;
  const masterPwd = project.config.masterPassword || 'admin';
  
  const fileBuffer = await fs.readFile(backupFilepath);
  const formData = new FormData();
  
  formData.append('master_pwd', masterPwd);
  formData.append('name', project.config.dbName);
  // Important: Node's fetch with FormData needs a filename for the blob to be treated as a file upload
  const blob = new Blob([fileBuffer]);
  formData.append('backup_file', blob, path.basename(backupFilepath));
  formData.append('copy', 'false');
  if (neutralize) {
    formData.append('neutralize', 'true');
  }

  // Use redirect: 'manual' because Odoo returns a redirect on success which we don't need to follow
  const response = await fetch(odooUrl, {
    method: 'POST',
    body: formData,
    redirect: 'manual'
  });

  // 303 Redirect is the success indicator for Odoo restores
  if (!response.ok && response.status !== 303) {
    const errorText = await response.text();
    throw new Error(`Odoo restore failed (${response.status}): ${errorText.slice(0, 300)}`);
  }
}

/**
 * Lists all backups available for a specific project.
 */
export async function listBackups(projectId: string): Promise<BackupMeta[]> {
  const backupDir = path.join(__dirname, '../data/backups', projectId);
  if (!existsSync(backupDir)) return [];

  const files = await fs.readdir(backupDir);
  const backups: BackupMeta[] = [];

  for (const file of files) {
    if (file.endsWith('.sql') || file.endsWith('.zip')) {
      const filepath = path.join(backupDir, file);
      const stats = await fs.stat(filepath);
      backups.push({
        filename: file,
        filepath,
        sizeBytes: stats.size,
        createdAt: stats.birthtime.toISOString()
      });
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Deletes a backup file from the filesystem.
 */
export async function deleteBackup(filepath: string): Promise<void> {
  if (existsSync(filepath)) {
    await fs.unlink(filepath);
  }
}


