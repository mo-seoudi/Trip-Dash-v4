import { readAuthToken, verifyAuthToken } from "../lib/authTokens.js";
import { findCanonicalUserById, isActiveAppUser, primaryCanonicalRole, publicAppUser } from "../services/canonicalAuth.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";
import { PERMISSIONS } from "../services/accessCatalog.js";

export async function requireAuth(req, res, next) {
  try {
    const token = readAuthToken(req);
    if (!token) return res.status(401).json({ message: "Not logged in" });
    const decoded = verifyAuthToken(token);
    const userId = String(decoded.id ?? decoded.sub ?? "").trim();
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const storedUser = await findCanonicalUserById(userId);
    if (!storedUser) return res.status(401).json({ message: "Not logged in" });
    if (!isActiveAppUser(storedUser)) return res.status(403).json({ message: "Account is not active", status: storedUser.status });

    const role = await primaryCanonicalRole(storedUser.id);
    req.user = publicAppUser(storedUser, role);
    return next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error?.name)) return res.status(401).json({ message: "Invalid or expired token" });
    return next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });
    const access = await resolveRuntimeAccess({ user: req.user });
    if (!(access.permissions || []).includes(PERMISSIONS.ACCESS_ADMIN)) return res.status(403).json({ message: "Forbidden" });
    req.effectiveAccess = access;
    return next();
  } catch (error) { return next(error); }
}
