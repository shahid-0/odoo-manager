import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "developer" | "viewer";
  createdAt: string;
  lastLoginAt: string | null;
}

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(path.join(__dirname, "..", "data"), { recursive: true });
  } catch {
    // directory already exists
  }
}

async function readUsers(): Promise<User[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data) as User[];
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

/**
 * Initialize the user store. If data/users.json does not exist or is empty,
 * seed it with a default admin account.
 */
export async function initUserStore(): Promise<void> {
  const users = await readUsers();
  if (users.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    const defaultAdmin: User = {
      id: nanoid(),
      username: "admin",
      passwordHash,
      role: "admin",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    await writeUsers([defaultAdmin]);
    console.log("Created default admin user (username: admin, password: admin123)");
  }
}

export async function getUsers(): Promise<User[]> {
  return readUsers();
}

export async function getUserById(id: string): Promise<User | undefined> {
  const users = await readUsers();
  return users.find((u) => u.id === id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const users = await readUsers();
  return users.find((u) => u.username === username);
}

export async function createUser(
  username: string,
  password: string,
  role: "admin" | "developer" | "viewer"
): Promise<User> {
  const users = await readUsers();

  if (users.some((u) => u.username === username)) {
    throw new Error("Username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = {
    id: nanoid(),
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "username" | "role" | "lastLoginAt" | "passwordHash">>
): Promise<User | undefined> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return undefined;

  users[idx] = { ...users[idx], ...patch };
  await writeUsers(users);
  return users[idx];
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;

  users.splice(idx, 1);
  await writeUsers(users);
  return true;
}

export async function verifyPassword(user: User, plaintext: string): Promise<boolean> {
  return bcrypt.compare(plaintext, user.passwordHash);
}
