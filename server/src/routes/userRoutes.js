// server/src/routes/usersRoutes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/users  -> list users for admin
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

// PUT /api/users/:id  -> update role/status for admin
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
