// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required but missing.");
}

function readToken(req) {
  const bearer = req.headers.authorization || "";
  if (bearer.startsWith("Bearer ")) return bearer.slice(7);
  return req.cookies?.token || null;
}

// Compatibility authentication for existing v4 users while the new AppUser/
// session architecture is built. Authorization must not trust a role embedded
// in an old JWT; current role/status are reloaded from PostgreSQL on each request.
export async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Not logged in" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id ?? decoded.uid;
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!user) return res.status(401).json({ message: "Not logged in" });

    const status = String(user.status || "").toLowerCase().trim();
    if (status !== "approved") {
      return res.status(403).json({ message: "Account is not approved", status: user.status });
    }

    req.user = user;
    return next();
  } catch (e) {
    if (e?.name === "JsonWebTokenError" || e?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return next(e);
  }
}

// Temporary compatibility admin guard. This deliberately checks the current
// database role, not JWT claims. It will be replaced by permission-based scoped
// authorization once role assignments are migrated.
export function requireAdmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  return next();
}
