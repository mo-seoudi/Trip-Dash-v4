// server/src/routes/userRoutes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/users  -> list users for admin (existing)
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

// NEW: GET /api/users/:id -> profile (self or admin)
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });

    // requireAuth should set req.user = { id, role, ... }
    const me = req.user;
    if (!me) return res.status(401).json({ message: "Not logged in" });

    const isSelf = me.id === id;
    const isAdmin = me.role === "admin";
    if (!isSelf && !isAdmin) return res.status(403).json({ message: "Forbidden" });

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// PUT /api/users/:id  -> update role/status for admin (existing)
router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { role, status } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    res.json(user);
  } catch (e) {
    next(e);
  }
});

export default router;
