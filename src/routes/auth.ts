import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getUserByUsername, verifyPassword, updateUser } from "../lib/users.js";
import { signToken, requireAuth } from "../auth.js";

const router = Router();

// Rate limit: max 10 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Capture original lastLoginAt before updating — the frontend uses this
    // to detect the very first login and show the "change password" banner
    const previousLastLoginAt = user.lastLoginAt;

    // Update lastLoginAt timestamp
    await updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, lastLoginAt: previousLastLoginAt },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  // Stateless JWT — token invalidation is handled client-side
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = req.user!;
    // Fetch fresh user data to get lastLoginAt
    const user = await (await import("../lib/users.js")).getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
