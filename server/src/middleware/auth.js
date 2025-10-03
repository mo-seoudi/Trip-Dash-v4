// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Read token from either Authorization: Bearer <jwt> or cookie "token"
export function requireAuth(req, res, next) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;

    if (!token) return res.status(401).json({ message: "Not logged in" });

    // support legacy { uid } tokens while migrating
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id ?? decoded.uid;

    if (!userId) return res.status(401).json({ message: "Invalid token" });

    req.user = { id: Number(userId), email: decoded.email || null, role: decoded.role || null };
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });

    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, role: true },
    });
    if (!me) return res.status(401).json({ message: "Not logged in" });
    if (me.role !== "admin") return res.status(403).json({ message: "Forbidden" });

    req.user.role = me.role;
    next();
  } catch (e) {
    next(e);
  }
}


