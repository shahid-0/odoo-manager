import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { User } from "./lib/users.js";

const JWT_SECRET: string = (() => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  if (process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL ERROR: JWT_SECRET environment variable is missing!");
    console.error("You MUST provide a secure JWT_SECRET in production. Exiting...");
    process.exit(1);
  }

  console.warn(
    "⚠ JWT_SECRET is not set in environment variables. Using a hardcoded dev secret — DO NOT use this in production!"
  );
  return "odoo-manager-dev-secret-change-me";
})();

const TOKEN_EXPIRY = "8h";

interface TokenPayload {
  userId: string;
  username: string;
  role: "admin" | "developer" | "viewer";
}

// Extend Express Request to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function signToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

/**
 * Allows admin OR developer roles. Used for project-level mutations
 * (deploy, start/stop, backup/restore, project CRUD) where developers
 * need write access but user management and org-level admin actions
 * remain restricted to admin-only via requireAdmin.
 */
export function requireDeveloper(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role === "viewer") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
