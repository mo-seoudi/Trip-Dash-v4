// server/src/routes/adminRoutes.js
import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Compatibility admin endpoints. These remain on the legacy User table until
// the new scoped organization administration APIs are introduced.
router.get("/users/pending", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: "pending" },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return res.json(users);
  } catch (e) {
    return next(e);
  }
});

router.post("/users/:id/approve", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status: "approved" },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    return res.json({ ok: true, user });
  } catch (e) {
    return next(e);
  }
});

export default router;
