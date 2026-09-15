// Canonical permission middleware for rebuilt/admin routes.
//
// During migration the permission vocabulary is canonical, while the runtime
// access decision remains legacy-authoritative. Optional canonical-v2 shadow
// evaluation is centralized in accessRuntime and cannot grant permissions.

import { resolveRuntimeAccess } from "../services/accessRuntime.js";
import { ROLE_KEYS } from "../services/accessCatalog.js";

export function hasTenantAccess(access, tenantId) {
  if (!access || !tenantId) return false;
  if ((access.roles || []).includes(ROLE_KEYS.SUPER_ADMIN)) return true;
  return Boolean(access.tenantId) && access.tenantId === tenantId;
}

export function requireCanonicalPermission(permission) {
  return async function canonicalPermissionMiddleware(req, res, next) {
    try {
      const access = await resolveRuntimeAccess({ user: req.user });
      if (!(access.permissions || []).includes(permission)) {
        return res.status(403).json({
          message: "Forbidden",
          code: "PERMISSION_REQUIRED",
          permission,
        });
      }

      req.effectiveAccess = access;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function assertCanonicalTenantAccess(req, tenantId) {
  if (!hasTenantAccess(req.effectiveAccess, tenantId)) {
    const error = new Error("Forbidden for this tenant");
    error.status = 403;
    error.code = "TENANT_SCOPE_REQUIRED";
    throw error;
  }
}
