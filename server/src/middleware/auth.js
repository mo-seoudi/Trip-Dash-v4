import { timedStage } from "../runtime/requestTiming.js";
import { readAuthToken, verifyAuthToken } from "../lib/authTokens.js";
import { findCanonicalUserById, isActiveAppUser, primaryCanonicalRole, publicAppUser } from "../services/canonicalAuth.js";
import { resolveRuntimeAccess } from "../services/accessRuntime.js";
import { PERMISSIONS } from "../services/accessCatalog.js";

export async function requireAuth(req, res, next) {
  try {
    // Multiple mounted routers can run their middleware before a matching route.
    // A verified identity is request-scoped; reuse it rather than querying again.
    if (req.user?.id) return next();
    const token = readAuthToken(req);
    if (!token) return res.status(401).json({ message: "Not logged in" });
    const decoded = verifyAuthToken(token);
    const userId = String(decoded.id ?? decoded.sub ?? "").trim();
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const storedUser = await timedStage(req, "auth.user_lookup", () => findCanonicalUserById(userId));
    if (!storedUser) return res.status(401).json({ message: "Not logged in" });
    if (!isActiveAppUser(storedUser)) return res.status(403).json({ message: "Account is not active", status: storedUser.status });

    const role = await timedStage(req, "auth.primary_role", () => primaryCanonicalRole(storedUser.id));
    req.user = publicAppUser(storedUser, role);
    return next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error?.name)) return res.status(401).json({ message: "Invalid or expired token" });
    return next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    // Only reuse authorization already established on this same request.
    // A fresh HTTP request always performs its own access resolution.
    if (req.effectiveAccess && (req.effectiveAccess.permissions || []).includes(PERMISSIONS.ACCESS_ADMIN)) return next();
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });
    const access = await timedStage(req, "auth.admin_access", () => resolveRuntimeAccess({ user: req.user }));
    if (!(access.permissions || []).includes(PERMISSIONS.ACCESS_ADMIN)) return res.status(403).json({ message: "Forbidden" });
    req.effectiveAccess = access;
    return next();
  } catch (error) { return next(error); }
}
