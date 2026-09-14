// server/src/routes/accessAdminRoutes.js
// Transitional admin API for the access-control UI. It deliberately wraps the
// existing global/control-plane tables so administrators can manage access from
// the application while the canonical v2 access tables are prepared/migrated.

import { Router } from "express";
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { canonicalRoleKey } from "../services/accessCatalog.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const MAX_TEXT = 200;
const ROLE_TO_LEGACY = new Map([
  ["tenant_admin", "admin"],
  ["super_admin", "admin"],
  ["group_staff", "staff"],
  ["school_staff", "school_staff"],
  ["service_partner", "trip_manager"],
  ["bus_operator", "bus_company"],
  ["finance", "finance"],
]);

function text(value, field, { required = false, max = MAX_TEXT } = {}) {
  const result = String(value ?? "").trim();
  if (required && !result) {
    const e = new Error(`${field} is required`);
    e.status = 400;
    throw e;
  }
  if (result.length > max) {
    const e = new Error(`${field} is too long`);
    e.status = 400;
    throw e;
  }
  return result || null;
}

function legacyRole(role) {
  const canonical = canonicalRoleKey(role);
  const stored = ROLE_TO_LEGACY.get(canonical);
  if (!stored) {
    const e = new Error("Unsupported role");
    e.status = 400;
    throw e;
  }
  return { canonical, stored };
}

function canonicalOrgType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "edu_group") return "SCHOOL_GROUP";
  if (normalized === "school") return "SCHOOL";
  if (normalized === "bus_company" || normalized === "bus_operator") return "BUS_OPERATOR";
  if (normalized === "service_partner") return "SERVICE_PARTNER";
  return String(type || "").toUpperCase();
}

// GET /api/access-admin/overview?tenant_id=...
router.get("/overview", async (req, res, next) => {
  try {
    const tenantId = text(req.query.tenant_id, "tenant_id", { required: true, max: 100 });
    const [tenant, organizations, users, memberships, scopes, partnerships] = await Promise.all([
      prismaGlobal.tenants.findUnique({ where: { id: tenantId } }),
      prismaGlobal.organizations.findMany({ where: { tenant_id: tenantId }, orderBy: { name: "asc" } }),
      prismaGlobal.users.findMany({ where: { tenant_id: tenantId }, orderBy: { email: "asc" } }),
      prismaGlobal.userRoles.findMany({
        where: { users: { tenant_id: tenantId } },
        include: { users: true, organizations: true },
        orderBy: [{ user_id: "asc" }, { org_id: "asc" }],
      }),
      prismaGlobal.userRoleScopes.findMany({
        where: { users: { tenant_id: tenantId } },
        include: { organizations_user_role_scopes_org_idToorganizations: true, organizations_user_role_scopes_school_org_idToorganizations: true },
      }),
      prismaGlobal.partnerships.findMany({
        where: { tenant_id: tenantId },
        include: { school: true, busCompany: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    return res.json({
      tenant,
      organizations: organizations.map((org) => ({ ...org, canonical_type: canonicalOrgType(org.type) })),
      users,
      memberships: memberships.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        org_id: row.org_id,
        role: canonicalRoleKey(row.role),
        status: row.status,
        is_default: row.is_default,
        user: row.users,
        organization: row.organizations ? { ...row.organizations, canonical_type: canonicalOrgType(row.organizations.type) } : null,
      })),
      scopes: scopes.map((row) => ({
        user_id: row.user_id,
        org_id: row.org_id,
        role: canonicalRoleKey(row.role),
        school_org_id: row.school_org_id,
      })),
      relationships: partnerships.map((row) => ({
        id: row.id,
        type: "TRANSPORT_PROVIDER",
        status: row.status,
        from_organization_id: row.school_org_id,
        to_organization_id: row.bus_company_org_id,
        from_organization: row.school,
        to_organization: row.busCompany ? { ...row.busCompany, canonical_type: "BUS_OPERATOR" } : null,
        legacy: true,
      })),
    });
  } catch (e) {
    return next(e);
  }
});

// POST /api/access-admin/memberships
router.post("/memberships", async (req, res, next) => {
  try {
    const userId = text(req.body?.user_id, "user_id", { required: true, max: 100 });
    const orgId = text(req.body?.org_id, "org_id", { required: true, max: 100 });
    const { canonical, stored } = legacyRole(req.body?.role);
    const status = String(req.body?.status || "active").toLowerCase();
    if (!["active", "approved", "pending", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Unsupported membership status" });
    }

    const [user, org] = await Promise.all([
      prismaGlobal.users.findUnique({ where: { id: userId }, select: { id: true, tenant_id: true } }),
      prismaGlobal.organizations.findUnique({ where: { id: orgId }, select: { id: true, tenant_id: true } }),
    ]);
    if (!user || !org) return res.status(404).json({ message: "User or organization not found" });
    if (!user.tenant_id || user.tenant_id !== org.tenant_id) {
      return res.status(400).json({ message: "User and organization must belong to the same tenant" });
    }

    const created = await prismaGlobal.userRoles.create({
      data: {
        user_id: userId,
        org_id: orgId,
        role: stored,
        status: status === "active" ? "approved" : status,
        is_default: Boolean(req.body?.is_default),
      },
    });
    return res.status(201).json({ ...created, role: canonical });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This user already has that role on this organization" });
    return next(e);
  }
});

router.patch("/memberships/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid membership id" });
    const data = {};
    if (req.body?.role !== undefined) data.role = legacyRole(req.body.role).stored;
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toLowerCase();
      if (!["active", "approved", "pending", "blocked"].includes(status)) return res.status(400).json({ message: "Unsupported membership status" });
      data.status = status === "active" ? "approved" : status;
    }
    if (req.body?.is_default !== undefined) data.is_default = Boolean(req.body.is_default);
    if (!Object.keys(data).length) return res.status(400).json({ message: "No supported fields to update" });
    const updated = await prismaGlobal.userRoles.update({ where: { id }, data });
    return res.json({ ...updated, role: canonicalRoleKey(updated.role) });
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Membership not found" });
    if (e?.code === "P2002") return res.status(409).json({ message: "This user already has that role on this organization" });
    return next(e);
  }
});

router.delete("/memberships/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid membership id" });
    await prismaGlobal.userRoles.delete({ where: { id } });
    return res.status(204).end();
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Membership not found" });
    return next(e);
  }
});

export default router;
