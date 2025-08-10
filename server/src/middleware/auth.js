// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const COOKIE_NAME = "session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// attach req.user if cookie is valid
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const { uid } = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Not authenticated" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
