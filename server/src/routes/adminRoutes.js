// server/src/routes/adminRoutes.js

import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// List pending users
router.get("/users/pending", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: "pending" },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (e) { next(e); }
});

// Approve a user
router.post("/users/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.update({
      where: { id },
      data: { status: "approved" },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    res.json({ ok: true, user });
  } catch (e) { next(e); }
});

export default router;

