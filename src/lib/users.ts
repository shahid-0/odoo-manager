import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from './db.js';

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    role: 'admin' | 'developer' | 'viewer';
    createdAt: string;
    lastLoginAt: string | null;
}

// ─── Internal row → User mapper ───────────────────────────────────────────────

interface UserRow {
    id: string;
    username: string;
    password_hash: string;
    role: 'admin' | 'developer' | 'viewer';
    created_at: string;
    last_login_at: string | null;
}

function rowToUser(row: UserRow): User {
    return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
    };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

/**
 * Initialize the user store. If the users table is empty,
 * seed it with a default admin account.
 */
export async function initUserStore(): Promise<void> {
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;

    if (count === 0) {
        const passwordHash = await bcrypt.hash('admin123', 12);
        db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, last_login_at)
      VALUES (?, ?, ?, 'admin', ?, NULL)
    `).run(nanoid(), 'admin', passwordHash, new Date().toISOString());

        console.log('Created default admin user (username: admin, password: admin123)');
    }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
    const rows = db.prepare('SELECT * FROM users').all() as UserRow[];
    return rows.map(rowToUser);
}

export async function getUserById(id: string): Promise<User | undefined> {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
}

export async function createUser(
    username: string,
    password: string,
    role: 'admin' | 'developer' | 'viewer'
): Promise<User> {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) throw new Error('Username already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user: User = {
        id: nanoid(),
        username,
        passwordHash,
        role,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
    };

    db.prepare(`
    INSERT INTO users (id, username, password_hash, role, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, user.username, user.passwordHash, user.role, user.createdAt, user.lastLoginAt);

    return user;
}

export async function updateUser(
    id: string,
    patch: Partial<Pick<User, 'username' | 'role' | 'lastLoginAt' | 'passwordHash'>>
): Promise<User | undefined> {
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!current) return undefined;

    // Build SET clause dynamically from only the provided keys
    const columnMap: Record<string, string> = {
        username: 'username',
        role: 'role',
        lastLoginAt: 'last_login_at',
        passwordHash: 'password_hash',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(patch)) {
        const col = columnMap[key];
        if (col) {
            setClauses.push(`${col} = ?`);
            values.push(value);
        }
    }

    if (setClauses.length === 0) return rowToUser(current);

    values.push(id);
    db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    return rowToUser(updated);
}

export async function deleteUser(id: string): Promise<boolean> {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
}

export async function verifyPassword(user: User, plaintext: string): Promise<boolean> {
    return bcrypt.compare(plaintext, user.passwordHash);
}