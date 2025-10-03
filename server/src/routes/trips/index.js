// server/src/routes/trips/index.js

import express from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const requireAuth = (req, res, next) => {
  const bearer = req.headers.authorization || "";
  const token = bearer.startsWith("Bearer ")
    ? bearer.slice(7)
    : req.cookies?.token;          // <— accept cookie as fallback
  if (!token) return res.status(401).json({ message: "Not logged in" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, email }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Example “mine” endpoint (start simple)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // show only the logged-in user’s trips to prove auth works
    const trips = await prisma.trip.findMany({
      where: { createdById: Number(req.user.id) },
      orderBy: { createdAt: "desc" },
    });
    res.json(trips);
  } catch (e) {
    next(e);
  }
});

export default router;

