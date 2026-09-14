// Canonical permission middleware for rebuilt/admin routes.
//
// This is intentionally separate from the legacy role-based requireAdmin
// middleware. New architecture routes should authorize against the canonical
// effective-access contract and then apply resource/tenant scope checks.

import { resolveEffectiveAccess } from "../services/effectiveAccess.js";
import { ROLE_KEYS } from "../services/accessCatalog.js";

export function hasTenantAccess(access, tenantId) {
  if (!access || !tenantId) return false;
  if ((access.roles || []).includes(ROLE_KEYS.SUPER_ADMIN)) return true;
  return Boolean(access.tenantId) && access.tenantId === tenantId;
}

export function requireCanonicalPermission(permission) {
  return async function canonicalPermissionMiddleware(req, res, next) {
    try {
      const access = await resolveEffectiveAccess(req.user);
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
