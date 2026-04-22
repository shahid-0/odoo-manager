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
  options: { neutralize: boolean; withFilestore: boolean },
  onLog?: (msg: string) => void
): Promise<BackupMeta> {
  if (!project.port) throw new Error("Project port not found. Is the container running?");
  
  const odooUrl = `http://localhost:${project.port}/web/database/backup`;
  const masterPwd = project.config.masterPassword || 'admin';
  const backupFormat = options.withFilestore ? 'zip' : 'dump';

  const backupDir = path.join(__dirname, 'data/backups', project.id);
  if (!existsSync(backupDir)) {
    onLog?.(`Creating backup directory: ${backupDir}`);
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

  onLog?.(`Requesting backup from Odoo API: ${odooUrl}...`);
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

  onLog?.(`Receiving backup file (${(blob.size / 1024 / 1024).toFixed(2)} MB)...`);
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(filepath, buffer);
  onLog?.(`Backup saved to host: ${filename}`);

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
async function dropOdooDatabase(project: Project, onLog?: (msg: string) => void): Promise<void> {
  if (!project.port) throw new Error("Project port not found.");
  onLog?.(`Dropping database ${project.config.dbName} via Odoo API...`);
  const odooUrl = `http://localhost:${project.port}/web/database/drop`;
  const masterPwd = project.config.masterPassword || 'admin';

  const params = new URLSearchParams();
  params.append('master_pwd', masterPwd);
  params.append('name', project.config.dbName);

  const response = await fetch(odooUrl, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual'
  });

  if (response.status !== 303) {
    const errorText = await response.text();
    // Ignore if database doesn't exist already (common case)
    if (errorText.includes('does not exist') || errorText.includes('Database not found')) {
      onLog?.(`Database ${project.config.dbName} already clean (not found).`);
      return;
    }
    
    const errorMatch = errorText.match(/<div class="alert alert-danger"[^>]*>([\s\S]*?)<\/div>/i);
    const cleanError = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '').trim() : "Odoo rejected the drop request";
    
    onLog?.(`❌ Odoo drop failed: ${cleanError}`);
    throw new Error(`Odoo drop failed: ${cleanError}`);
  }
  onLog?.(`✅ Database ${project.config.dbName} successfully dropped.`);
}

/**
 * Restores an Odoo database using either Odoo's API or direct Postgres restore.
 */
export async function restoreOdooDatabase(
  docker: Docker,
  project: Project, 
  backupFilepath: string,
  onLog?: (msg: string) => void,
  neutralize: boolean = false,
): Promise<void> {
  if (!project.port) throw new Error("Project port not found. Is the container running?");
  if (!existsSync(backupFilepath)) throw new Error("Backup file does not exist.");

  const extension = path.extname(backupFilepath).toLowerCase();
  const filename = path.basename(backupFilepath);

  console.log(`[RESTORE] Starting restore for ${filename}...`);

  // 1. First drop the existing database to avoid "already exists" error
  await dropOdooDatabase(project, onLog).catch(err => {
    onLog?.(`⚠️ Drop database warning (it might not exist): ${err.message}`);
  });

  if (extension === '.sql') {
    // Mode: Direct PSQL restore for raw SQL dumps
    onLog?.(`Detected .sql file. Using direct psql restore into container ${project.dbContainerId}...`);
    const dbContainer = docker.getContainer(project.dbContainerId!);
    
    // Ensure the database is recreated empty first
    onLog?.(`Recreating empty database ${project.config.dbName}...`);
    const createExec = await dbContainer.exec({
      Cmd: ['createdb', '-U', project.config.dbUser, project.config.dbName],
      Env: [`PGPASSWORD=${project.config.dbPassword}`]
    });
    const createStream = await createExec.start({});
    await new Promise((resolve) => createStream.on('end', resolve));
    
    const createStatus = await createExec.inspect();
    if (createStatus.ExitCode !== 0 && createStatus.ExitCode !== null) {
      // It's possible it already exists if drop failed
      onLog?.(`Note: Database creation returned code ${createStatus.ExitCode}. Proceeding to restore...`);
    }

    onLog?.(`Piping SQL content to psql...`);
    const fileBuffer = await fs.readFile(backupFilepath);

    const exec = await dbContainer.exec({
      Cmd: ['psql', '-U', project.config.dbUser, '-d', project.config.dbName, '--no-password'],
      Env: [`PGPASSWORD=${project.config.dbPassword}`],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    
    return new Promise((resolve, reject) => {
      docker.modem.demuxStream(stream, process.stdout, process.stderr);
      stream.on('end', async () => {
        const inspectStatus = await exec.inspect();
        if (inspectStatus.ExitCode === 0) {
          onLog?.(`✅ SQL restore complete.`);
          resolve();
        } else {
          onLog?.(`❌ psql failed with code ${inspectStatus.ExitCode}`);
          reject(new Error(`psql exit code ${inspectStatus.ExitCode}`));
        }
      });
      stream.write(fileBuffer);
      stream.end();
    });

  } else if (extension === '.zip') {
    // Mode: Odoo Native API for .zip (includes filestore)
    onLog?.(`Detected .zip archive. Using Odoo native restore API at port ${project.port}...`);
    const odooUrl = `http://localhost:${project.port}/web/database/restore`;
    const masterPwd = project.config.masterPassword || 'admin';
    
    const fileBuffer = await fs.readFile(backupFilepath);
    const formData = new FormData();
    
    formData.append('master_pwd', masterPwd);
    formData.append('name', project.config.dbName);
    const blob = new Blob([fileBuffer]);
    formData.append('backup_file', blob, filename);
    formData.append('copy', 'false');
    if (neutralize) {
      formData.append('neutralize', 'true');
    }

    const response = await fetch(odooUrl, {
      method: 'POST',
      body: formData,
      redirect: 'manual'
    });

    // For Odoo /restore and /drop, a 303 Redirect is the success signal.
    // If it returns a 200 OK, it usually means it stayed on the page to show an error form.
    if (response.status === 303) {
      onLog?.(`✅ Native archive restore complete.`);
    } else {
      const errorText = await response.text();
      // Try to find a common Odoo error message in the HTML
      const errorMatch = errorText.match(/<div class="alert alert-danger"[^>]*>([\s\S]*?)<\/div>/i);
      const cleanError = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '').trim() : "Odoo rejected the request (likely wrong Master Password or invalid file)";
      
      onLog?.(`❌ Odoo API failed (${response.status}): ${cleanError}`);
      throw new Error(`Odoo restore failed: ${cleanError}`);
    }
  } else {
    throw new Error(`Unsupported backup format: ${extension}`);
  }
}

/**
 * Lists all backups available for a specific project.
 */
export async function listBackups(projectId: string): Promise<BackupMeta[]> {
  const backupDir = path.join(__dirname, 'data/backups', projectId);
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


