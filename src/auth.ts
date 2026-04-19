import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { User } from "./users.ts";

const JWT_SECRET: string = (() => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  console.warn(
    "⚠ JWT_SECRET is not set in environment variables. Using a hardcoded dev secret — DO NOT use this in production!"
  );
  return "odoo-manager-dev-secret-change-me";
})();

const TOKEN_EXPIRY = "8h";

export interface TokenPayload {
  userId: string;
  username: string;
  role: "admin" | "viewer";
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
