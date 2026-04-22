import { nanoid } from 'nanoid';
import db from './db.js';
import type { Organization, Project, ProjectConfig, ProjectStatus } from '../types.js';

// ─── Internal row types ────────────────────────────────────────────────────────

interface OrgRow {
    id: string;
    name: string;
    created_at: string;
}

interface ProjectRow {
    id: string;
    org_id: string;
    name: string;
    description: string;
    status: ProjectStatus;
    container_id: string | null;
    db_container_id: string | null;
    port: string | null;
    created_at: string;
    config: string; // JSON
}

interface LogRow {
    project_id: string;
    message: string;
    created_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToProject(row: ProjectRow, logs: string[] = []): Project {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        containerId: row.container_id ?? undefined,
        dbContainerId: row.db_container_id ?? undefined,
        port: row.port ?? undefined,
        createdAt: row.created_at,
        config: JSON.parse(row.config) as ProjectConfig,
        projectLogs: logs,
    };
}

function rowToOrg(row: OrgRow, projects: Project[]): Organization {
    return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        projects,
    };
}

// ─── Organization queries ─────────────────────────────────────────────────────

export function getOrganizations(): Organization[] {
    const orgRows = db.prepare('SELECT * FROM organizations ORDER BY created_at ASC').all() as OrgRow[];
    const projectRows = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as ProjectRow[];
    const logRows = db.prepare('SELECT * FROM project_logs ORDER BY created_at ASC').all() as LogRow[];

    return orgRows.map((org) => {
        const projects = projectRows
            .filter((p) => p.org_id === org.id)
            .map(row => {
                const logs = logRows
                    .filter(l => l.project_id === row.id)
                    .map(l => l.message);
                return rowToProject(row, logs);
            });
        return rowToOrg(org, projects);
    });
}

export function getOrganizationById(id: string): Organization | undefined {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as OrgRow | undefined;
    if (!org) return undefined;

    const projectRows = db
        .prepare('SELECT * FROM projects WHERE org_id = ? ORDER BY created_at ASC')
        .all(id) as ProjectRow[];

    const projects = projectRows.map(row => {
        const logs = db
            .prepare('SELECT message FROM project_logs WHERE project_id = ? ORDER BY created_at ASC')
            .all(row.id) as { message: string }[];
        return rowToProject(row, logs.map(l => l.message));
    });

    return rowToOrg(org, projects);
}

export function createOrganization(name: string): Organization {
    const org: Organization = {
        id: nanoid(),
        name,
        createdAt: new Date().toISOString(),
        projects: [],
    };

    db.prepare(`
    INSERT INTO organizations (id, name, created_at)
    VALUES (?, ?, ?)
  `).run(org.id, org.name, org.createdAt);

    return org;
}

export function updateOrganization(
    id: string,
    patch: Partial<Pick<Organization, 'name'>>
): Organization | undefined {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as OrgRow | undefined;
    if (!org) return undefined;

    if (patch.name) {
        db.prepare('UPDATE organizations SET name = ? WHERE id = ?').run(patch.name, id);
    }

    return getOrganizationById(id);
}

export function deleteOrganization(id: string): boolean {
    // Projects are cascade-deleted via FK constraint
    const result = db.prepare('DELETE FROM organizations WHERE id = ?').run(id);
    return result.changes > 0;
}

// ─── Project queries ──────────────────────────────────────────────────────────

export function getProjectById(id: string): Project | undefined {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!row) return undefined;

    const logs = db
        .prepare('SELECT message FROM project_logs WHERE project_id = ? ORDER BY created_at ASC')
        .all(id) as { message: string }[];

    return rowToProject(row, logs.map(l => l.message));
}

export function getProjectsByOrg(orgId: string): Project[] {
    const rows = db
        .prepare('SELECT * FROM projects WHERE org_id = ? ORDER BY created_at ASC')
        .all(orgId) as ProjectRow[];

    return rows.map(row => {
        const logs = db
            .prepare('SELECT message FROM project_logs WHERE project_id = ? ORDER BY created_at ASC')
            .all(row.id) as { message: string }[];
        return rowToProject(row, logs.map(l => l.message));
    });
}

export function createProject(orgId: string, data: {
    name: string;
    description?: string;
    config: ProjectConfig;
}): Project {
    const project: Project = {
        id: nanoid(),
        name: data.name,
        description: data.description ?? '',
        config: data.config,
        createdAt: new Date().toISOString(),
        status: 'idle',
    };

    db.prepare(`
    INSERT INTO projects (id, org_id, name, description, status, container_id, db_container_id, port, created_at, config)
    VALUES (?, ?, ?, ?, 'idle', NULL, NULL, NULL, ?, ?)
  `).run(
        project.id,
        orgId,
        project.name,
        project.description,
        project.createdAt,
        JSON.stringify(project.config)
    );

    return project;
}

export function updateProject(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'containerId' | 'dbContainerId' | 'port' | 'config'>>
): Project | undefined {
    const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!current) return undefined;

    // Map camelCase patch keys → snake_case column names
    const columnMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        status: 'status',
        containerId: 'container_id',
        dbContainerId: 'db_container_id',
        port: 'port',
        config: 'config',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(patch)) {
        const col = columnMap[key];
        if (col) {
            setClauses.push(`${col} = ?`);
            // Serialize config object to JSON
            values.push(key === 'config' ? JSON.stringify(value) : value);
        }
    }

    if (setClauses.length === 0) return rowToProject(current);

    values.push(id);
    db.prepare(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
    return rowToProject(updated);
}

export function deleteProject(id: string): boolean {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
}

// ─── Convenience: update only runtime fields ──────────────────────────────────
// Called frequently during deploy/stop cycles — keeps callers clean.

export function setProjectStatus(id: string, status: ProjectStatus): void {
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
}

export function setProjectContainers(id: string, data: {
    containerId?: string;
    dbContainerId?: string;
    port?: string;
    status?: ProjectStatus;
}): void {
    db.prepare(`
    UPDATE projects
    SET container_id = ?, db_container_id = ?, port = ?, status = COALESCE(?, status)
    WHERE id = ?
  `).run(
        data.containerId ?? null,
        data.dbContainerId ?? null,
        data.port ?? null,
        data.status ?? null,
        id
    );
}

export function appendProjectLog(projectId: string, message: string): string {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${message}`;

    db.prepare(`
    INSERT INTO project_logs (project_id, message, created_at)
    VALUES (?, ?, ?)
  `).run(projectId, formattedMsg, timestamp);

    return formattedMsg;
}