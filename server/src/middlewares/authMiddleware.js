import { verifyToken } from "../services/authService.js";
import { getUserRepository } from "../services/repositoryResolver.js";
import { getTenantConfig } from "../services/tenantService.js";

/**
 * Middleware to verify JWT and attach user info to request
 */
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = await verifyToken(token, req.tenantId);

    const tenant = await getTenantConfig(decoded.tenantId);
    const userRepository = getUserRepository();

    const user = await userRepository.getUserById(decoded.uid);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: decoded.uid,
      email: decoded.email,
      role: user.role,
      tenantId: user.tenantId,
      assignedSchools: user.assignedSchools,
      permissions: user.permissions,
      organizationId: user.organizationId,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
}

/**
 * Middleware to enforce required roles
 */
export function requireRole(requiredRoles) {
  return (req, res, next) => {
    if (!req.user || !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

/**
 * Middleware to enforce required permissions
 */
export function requirePermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ message: "Forbidden: no permissions set" });
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.user.permissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }

    next();
  };
}
