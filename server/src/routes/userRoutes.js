// server/src/routes/userRoutes.js
import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Legacy compatibility routes. These are intentionally preserved until users
// have been migrated to AppUser + scoped RoleAssignment records.
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    return res.json(users);
  } catch (e) {
    return next(e);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const isSelf = req.user.id === id;
    const isLegacyAdmin = req.user.role === "admin";
    if (!isSelf && !isLegacyAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (e) {
    return next(e);
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const { role, status } = req.body || {};
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return res.json(user);
  } catch (e) {
    return next(e);
  }
});

export default router;
