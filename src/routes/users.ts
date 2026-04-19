import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../auth.ts";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../users.ts";

const router = Router();

// All user management routes require admin
router.use(requireAdmin);

// GET /api/users — list all users (omit passwordHash)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const users = await getUsers();
    const sanitized = users.map(({ passwordHash, ...rest }) => rest);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/users — create a new user
router.post("/", async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: "username, password, and role are required" });
    }

    if (!["admin", "viewer"].includes(role)) {
      return res.status(400).json({ error: "role must be 'admin' or 'viewer'" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await createUser(username, password, role);
    const { passwordHash, ...sanitized } = user;
    res.status(201).json(sanitized);
  } catch (error: any) {
    if (error.message === "Username already exists") {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/users/:id — update username or role (not password)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, role } = req.body;

    if (role && !["admin", "viewer"].includes(role)) {
      return res.status(400).json({ error: "role must be 'admin' or 'viewer'" });
    }

    // If demoting an admin, check that they're not the last admin
    // "Last admin" deletion guard: prevents removing the only admin account,
    // which would lock everyone out of admin functionality permanently.
    if (role === "viewer") {
      const users = await getUsers();
      const currentUser = users.find((u) => u.id === id);
      if (currentUser?.role === "admin") {
        const adminCount = users.filter((u) => u.role === "admin").length;
        if (adminCount <= 1) {
          return res.status(403).json({ error: "Cannot demote the last admin" });
        }
      }
    }

    const patch: Record<string, string> = {};
    if (username) patch.username = username;
    if (role) patch.role = role;

    const updated = await updateUser(id, patch);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    const { passwordHash, ...sanitized } = updated;
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id — delete a user
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requesterId = req.user!.userId;

    // Reject if trying to delete own account
    if (id === requesterId) {
      return res.status(403).json({ error: "Cannot delete your own account" });
    }

    // "Last admin" deletion guard: ensures at least one admin always exists
    // so the system is never left without a user who can manage other users.
    const users = await getUsers();
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return res.status(403).json({ error: "Cannot delete the last admin" });
      }
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// POST /api/users/:id/reset-password — admin resets any user's password
router.post("/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await updateUser(id, { passwordHash });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
