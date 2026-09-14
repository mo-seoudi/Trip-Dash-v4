// Transitional access-control administration API backed by the legacy global
// control-plane tables. Public contracts use canonical product terminology;
// legacy storage details stay behind compatibility helpers until v2 migration.

import { Router } from "express";
import { prismaGlobal } from "../lib/prismaGlobal.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { canonicalOrganizationType, isLegacyBusOperatorType } from "../lib/legacyOrganizations.js";
import { canonicalRoleKey } from "../services/accessCatalog.js";
import {
  deleteLegacyMembershipWithScopes,
  updateLegacyMembershipWithScopes,
} from "../services/legacyMembershipIntegrity.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const MAX_TEXT = 200;
const ROLE_TO_LEGACY = new Map([
  ["tenant_admin", "admin"], ["super_admin", "admin"], ["group_staff", "staff"],
  ["school_staff", "school_staff"], ["service_partner", "trip_manager"],
  ["bus_operator", "bus_company"], ["finance", "finance"],
]);

function text(value, field, { required = false, max = MAX_TEXT } = {}) {
  const result = String(value ?? "").trim();
  if (required && !result) { const e = new Error(`${field} is required`); e.status = 400; throw e; }
  if (result.length > max) { const e = new Error(`${field} is too long`); e.status = 400; throw e; }
  return result || null;
}

function legacyRole(role) {
  const canonical = canonicalRoleKey(role);
  const stored = ROLE_TO_LEGACY.get(canonical);
  if (!stored) { const e = new Error("Unsupported role"); e.status = 400; throw e; }
  return { canonical, stored };
}

function organizationView(org) {
  if (!org) return null;
  return {
    id: org.id, tenant_id: org.tenantId, type: canonicalOrganizationType(org.type),
    display_name: org.name, full_name: org.name, abbreviation: org.code || null,
    parent_org_id: org.parentOrgId || null,
  };
}

async function globalUserForRequest(req) {
  return (await prismaGlobal.user.findFirst({ where: { legacyUserId: Number(req.user.id) } })) ||
    prismaGlobal.user.findFirst({ where: { email: req.user.email } });
}

async function assertTenantAdminAccess(req, tenantId) {
  const globalUser = await globalUserForRequest(req);
  if (globalUser?.tenantId && globalUser.tenantId !== tenantId) {
    const e = new Error("Forbidden for this tenant"); e.status = 403; throw e;
  }
  return globalUser;
}

router.get("/overview", async (req, res, next) => {
  try {
    const tenantId = text(req.query.tenant_id, "tenant_id", { required: true, max: 100 });
    await assertTenantAdminAccess(req, tenantId);
    const [tenant, organizations, users, memberships, scopes, partnerships] = await Promise.all([
      prismaGlobal.tenant.findUnique({ where: { id: tenantId } }),
      prismaGlobal.organization.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prismaGlobal.user.findMany({ where: { tenantId }, orderBy: { email: "asc" } }),
      prismaGlobal.userOrgMembership.findMany({ where: { user: { tenantId } }, include: { user: true, org: true }, orderBy: [{ userId: "asc" }, { orgId: "asc" }] }),
      prismaGlobal.userOrgScope.findMany({ where: { user: { tenantId } }, include: { user: true, org: true, school: true } }),
      prismaGlobal.partnership.findMany({ where: { tenantId }, include: { school: true, busCompany: true }, orderBy: { createdAt: "desc" } }),
    ]);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    return res.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
      organizations: organizations.map(organizationView),
      users: users.map((u) => ({ id: u.id, tenant_id: u.tenantId, legacy_user_id: u.legacyUserId, email: u.email, display_name: u.fullName || u.email, is_active: u.isActive })),
      memberships: memberships.map((m) => ({ id: m.id, user_id: m.userId, organization_id: m.orgId, role: canonicalRoleKey(m.role), status: m.status, is_primary: m.isDefault, user: { id: m.user.id, email: m.user.email, display_name: m.user.fullName || m.user.email }, organization: organizationView(m.org) })),
      scopes: scopes.map((s) => ({ user_id: s.userId, organization_id: s.orgId, role: canonicalRoleKey(s.role), school_organization_id: s.schoolOrgId, organization: organizationView(s.org), school: organizationView(s.school) })),
      relationships: partnerships.map((p) => ({ id: p.id, type: "TRANSPORT_PROVIDER", status: p.status, from_organization_id: p.schoolOrgId, to_organization_id: p.busCompanyOrgId, from_organization: organizationView(p.school), to_organization: organizationView(p.busCompany), notes: p.notes || null, legacy: true })),
      capabilities: { relationship_types: ["TRANSPORT_PROVIDER"], note: "Legacy bridge. SERVICE_PARTNER and generic relationship types activate after canonical v2 migration." },
    });
  } catch (e) { return next(e); }
});

router.post("/memberships", async (req, res, next) => {
  try {
    const userId = text(req.body?.user_id, "user_id", { required: true, max: 100 });
    const orgId = text(req.body?.organization_id ?? req.body?.org_id, "organization_id", { required: true, max: 100 });
    const { canonical, stored } = legacyRole(req.body?.role);
    const status = String(req.body?.status || "active").toLowerCase();
    if (!["active", "approved", "pending", "blocked"].includes(status)) return res.status(400).json({ message: "Unsupported membership status" });
    const [user, org] = await Promise.all([
      prismaGlobal.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true } }),
      prismaGlobal.organization.findUnique({ where: { id: orgId }, select: { id: true, tenantId: true } }),
    ]);
    if (!user || !org) return res.status(404).json({ message: "User or organization not found" });
    if (!user.tenantId || user.tenantId !== org.tenantId) return res.status(400).json({ message: "User and organization must belong to the same tenant" });
    await assertTenantAdminAccess(req, user.tenantId);
    const created = await prismaGlobal.userOrgMembership.create({ data: { userId, orgId, role: stored, status: status === "active" ? "approved" : status, isDefault: Boolean(req.body?.is_primary ?? req.body?.is_default) } });
    return res.status(201).json({ id: created.id, user_id: created.userId, organization_id: created.orgId, role: canonical, status: created.status, is_primary: created.isDefault });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This user already has that role on this organization" });
    return next(e);
  }
});

router.patch("/memberships/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid membership id" });
    const existing = await prismaGlobal.userOrgMembership.findUnique({ where: { id }, include: { org: { select: { tenantId: true } } } });
    if (!existing) return res.status(404).json({ message: "Membership not found" });
    await assertTenantAdminAccess(req, existing.org.tenantId);
    const data = {};
    if (req.body?.role !== undefined) data.role = legacyRole(req.body.role).stored;
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toLowerCase();
      if (!["active", "approved", "pending", "blocked"].includes(status)) return res.status(400).json({ message: "Unsupported membership status" });
      data.status = status === "active" ? "approved" : status;
    }
    if (req.body?.is_primary !== undefined || req.body?.is_default !== undefined) data.isDefault = Boolean(req.body?.is_primary ?? req.body?.is_default);
    if (!Object.keys(data).length) return res.status(400).json({ message: "No supported fields to update" });
    const updated = await updateLegacyMembershipWithScopes(prismaGlobal, { membershipId: id, existing, data });
    return res.json({ id: updated.id, user_id: updated.userId, organization_id: updated.orgId, role: canonicalRoleKey(updated.role), status: updated.status, is_primary: updated.isDefault });
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
    const existing = await prismaGlobal.userOrgMembership.findUnique({ where: { id }, include: { org: { select: { tenantId: true } } } });
    if (!existing) return res.status(404).json({ message: "Membership not found" });
    await assertTenantAdminAccess(req, existing.org.tenantId);
    await deleteLegacyMembershipWithScopes(prismaGlobal, existing);
    return res.status(204).end();
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Membership not found" });
    return next(e);
  }
});

router.post("/scopes", async (req, res, next) => {
  try {
    const userId = text(req.body?.user_id, "user_id", { required: true, max: 100 });
    const orgId = text(req.body?.organization_id, "organization_id", { required: true, max: 100 });
    const schoolOrgId = text(req.body?.school_organization_id, "school_organization_id", { required: true, max: 100 });
    const { canonical, stored } = legacyRole(req.body?.role);
    const [user, org, school] = await Promise.all([
      prismaGlobal.user.findUnique({ where: { id: userId } }), prismaGlobal.organization.findUnique({ where: { id: orgId } }), prismaGlobal.organization.findUnique({ where: { id: schoolOrgId } }),
    ]);
    if (!user || !org || !school) return res.status(404).json({ message: "User or organization not found" });
    if (!user.tenantId || user.tenantId !== org.tenantId || org.tenantId !== school.tenantId) return res.status(400).json({ message: "Scope entities must belong to the same tenant" });
    if (canonicalOrganizationType(school.type) !== "SCHOOL") return res.status(400).json({ message: "school_organization_id must refer to a school" });
    await assertTenantAdminAccess(req, user.tenantId);
    const membership = await prismaGlobal.userOrgMembership.findFirst({ where: { userId, orgId, role: stored } });
    if (!membership) return res.status(409).json({ message: "Create the organization membership before adding a school scope" });
    const created = await prismaGlobal.userOrgScope.create({ data: { userId, orgId, role: stored, schoolOrgId } });
    return res.status(201).json({ user_id: created.userId, organization_id: created.orgId, role: canonical, school_organization_id: created.schoolOrgId });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This school scope already exists" });
    return next(e);
  }
});

router.delete("/scopes", async (req, res, next) => {
  try {
    const userId = text(req.body?.user_id, "user_id", { required: true, max: 100 });
    const orgId = text(req.body?.organization_id, "organization_id", { required: true, max: 100 });
    const schoolOrgId = text(req.body?.school_organization_id, "school_organization_id", { required: true, max: 100 });
    const { stored } = legacyRole(req.body?.role);
    const org = await prismaGlobal.organization.findUnique({ where: { id: orgId }, select: { tenantId: true } });
    if (!org) return res.status(404).json({ message: "Organization not found" });
    await assertTenantAdminAccess(req, org.tenantId);
    await prismaGlobal.userOrgScope.delete({ where: { userId_orgId_role_schoolOrgId: { userId, orgId, role: stored, schoolOrgId } } });
    return res.status(204).end();
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Scope not found" });
    return next(e);
  }
});

router.post("/relationships", async (req, res, next) => {
  try {
    const type = String(req.body?.type || "").toUpperCase();
    if (type !== "TRANSPORT_PROVIDER") return res.status(409).json({ message: "This relationship type requires the canonical v2 access migration", supported_types: ["TRANSPORT_PROVIDER"] });
    const schoolOrgId = text(req.body?.from_organization_id, "from_organization_id", { required: true, max: 100 });
    const busOperatorOrgId = text(req.body?.to_organization_id, "to_organization_id", { required: true, max: 100 });
    const notes = text(req.body?.notes, "notes", { max: 2000 });
    const [school, operator] = await Promise.all([
      prismaGlobal.organization.findUnique({ where: { id: schoolOrgId } }), prismaGlobal.organization.findUnique({ where: { id: busOperatorOrgId } }),
    ]);
    if (!school || !operator) return res.status(404).json({ message: "Organization not found" });
    if (school.tenantId !== operator.tenantId) return res.status(400).json({ message: "Organizations must belong to the same tenant" });
    if (canonicalOrganizationType(school.type) !== "SCHOOL") return res.status(400).json({ message: "Relationship source must be a school" });
    if (!isLegacyBusOperatorType(operator.type)) return res.status(400).json({ message: "Relationship target must be a Bus Operator" });
    await assertTenantAdminAccess(req, school.tenantId);
    const created = await prismaGlobal.partnership.create({ data: { tenantId: school.tenantId, schoolOrgId, busCompanyOrgId: busOperatorOrgId, status: "active", notes }, include: { school: true, busCompany: true } });
    return res.status(201).json({ id: created.id, type: "TRANSPORT_PROVIDER", status: created.status, from_organization_id: created.schoolOrgId, to_organization_id: created.busCompanyOrgId, from_organization: organizationView(created.school), to_organization: organizationView(created.busCompany), notes: created.notes || null, legacy: true });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This transport-provider relationship already exists" });
    return next(e);
  }
});

router.delete("/relationships/:id", async (req, res, next) => {
  try {
    const id = text(req.params.id, "relationship id", { required: true, max: 100 });
    const existing = await prismaGlobal.partnership.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Relationship not found" });
    await assertTenantAdminAccess(req, existing.tenantId);
    await prismaGlobal.partnership.delete({ where: { id } });
    return res.status(204).end();
  } catch (e) {
    if (e?.code === "P2025") return res.status(404).json({ message: "Relationship not found" });
    return next(e);
  }
});

export default router;
