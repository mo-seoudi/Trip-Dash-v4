// server/src/middleware/auth.js
import { prisma } from "../lib/prisma.js";
import { normalizeLegacyUser } from "../lib/legacyRoles.js";
import { readAuthToken, verifyAuthToken } from "../lib/authTokens.js";

// Compatibility authentication for existing v4 users while the new AppUser/
// session architecture is built. Authorization must not trust a role embedded
// in an old JWT; current role/status are reloaded from PostgreSQL on each request.
export async function requireAuth(req, res, next) {
  try {
    const token = readAuthToken(req);
    if (!token) return res.status(401).json({ message: "Not logged in" });

    const decoded = verifyAuthToken(token);
    const userId = Number(decoded.id ?? decoded.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const storedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!storedUser) return res.status(401).json({ message: "Not logged in" });

    const status = String(storedUser.status || "").toLowerCase().trim();
    if (status !== "approved") {
      return res.status(403).json({ message: "Account is not approved", status: storedUser.status });
    }

    // Expose canonical terminology to the rebuilt application without changing
    // the existing database value before the migration is ready.
    req.user = normalizeLegacyUser(storedUser);
    return next();
  } catch (e) {
    if (e?.name === "JsonWebTokenError" || e?.name === "TokenExpiredError" || e?.name === "NotBeforeError") {
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
