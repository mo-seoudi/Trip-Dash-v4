// Canonical access-control administration API.
// Platform tenancy is commercial coverage; organizations and relationships form
// the operational graph and are not owned by a tenant.

import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const MAX_TEXT = 200;
const RELATIONSHIP_TYPES = new Set([
  "BELONGS_TO_GROUP",
  "TRANSPORT_PROVIDER",
  "TRIP_MANAGER",
  "WORKS_WITH_TRANSPORT_PROVIDER",
]);
const MEMBERSHIP_STATUSES = new Set(["PENDING", "ACTIVE", "SUSPENDED", "REVOKED"]);

function text(value, field, { required = false, max = MAX_TEXT } = {}) {
  const result = String(value ?? "").trim();
  if (required && !result) { const e = new Error(`${field} is required`); e.status = 400; throw e; }
  if (result.length > max) { const e = new Error(`${field} is too long`); e.status = 400; throw e; }
  return result || null;
}

function membershipStatus(value, fallback = "ACTIVE") {
  const status = String(value ?? fallback).trim().toUpperCase();
  if (!MEMBERSHIP_STATUSES.has(status)) { const e = new Error("Unsupported membership status"); e.status = 400; throw e; }
  return status;
}

function organizationView(org) {
  if (!org) return null;
  return {
    id: org.id, type: org.type, display_name: org.displayName, full_name: org.fullName,
    abbreviation: org.abbreviation, slug: org.slug, status: org.status,
  };
}

function membershipView(m) {
  return {
    id: m.id, user_id: m.userId, organization_id: m.organizationId,
    status: m.status, is_primary: m.isPrimary, job_title: m.jobTitle,
    ...(m.user ? { user: { id: m.user.id, email: m.user.email, display_name: m.user.displayName } } : {}),
    ...(m.organization ? { organization: organizationView(m.organization) } : {}),
  };
}

async function appUserForRequest(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({ where: { OR: [
    ...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []),
    ...(req.user?.email ? [{ email: req.user.email }] : []),
  ] } });
}

async function assertTenantAdminAccess(req, tenantId) {
  const user = await appUserForRequest(req);
  if (!user) { const e = new Error("Canonical user identity not found"); e.status = 403; throw e; }
  const role = await prismaControl.roleAssignment.findFirst({ where: {
    userId: user.id, isActive: true,
    OR: [
      { scopeType: "PLATFORM", role: { key: "super_admin" } },
      { scopeType: "TENANT", tenantId, role: { key: { in: ["tenant_admin", "super_admin"] } } },
    ],
  } });
  if (!role) { const e = new Error("Forbidden for this tenant"); e.status = 403; throw e; }
  return user;
}

async function assertOrganizationAdminAccess(req, organizationId) {
  const user = await appUserForRequest(req);
  if (!user) { const e = new Error("Canonical user identity not found"); e.status = 403; throw e; }
  const role = await prismaControl.roleAssignment.findFirst({ where: {
    userId: user.id, isActive: true,
    OR: [
      { scopeType: "PLATFORM", role: { key: "super_admin" } },
      { scopeType: "ORGANIZATION", organizationId, role: { key: { in: ["tenant_admin", "super_admin"] } } },
      { scopeType: "TENANT", tenant: { organizations: { some: { organizationId } } }, role: { key: { in: ["tenant_admin", "super_admin"] } } },
    ],
  } });
  if (!role) { const e = new Error("Forbidden for this organization"); e.status = 403; throw e; }
  return user;
}

router.get("/overview", async (req, res, next) => {
  try {
    const tenantId = text(req.query.tenant_id, "tenant_id", { required: true, max: 100 });
    await assertTenantAdminAccess(req, tenantId);
    const tenant = await prismaControl.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const coverage = await prismaControl.tenantOrganization.findMany({ where: { tenantId }, select: { organizationId: true } });
    const coveredIds = coverage.map((row) => row.organizationId);
    const [organizations, memberships, assignments, relationships] = await Promise.all([
      prismaControl.organization.findMany({ where: { id: { in: coveredIds } }, orderBy: { displayName: "asc" } }),
      prismaControl.organizationMembership.findMany({ where: { organizationId: { in: coveredIds } }, include: { user: true, organization: true }, orderBy: [{ userId: "asc" }, { organizationId: "asc" }] }),
      prismaControl.roleAssignment.findMany({ where: { isActive: true, OR: [{ tenantId }, { organizationId: { in: coveredIds } }] }, include: { user: true, role: true, organization: true } }),
      prismaControl.organizationRelationship.findMany({ where: { OR: [{ fromOrganizationId: { in: coveredIds } }, { toOrganizationId: { in: coveredIds } }] }, include: { fromOrganization: true, toOrganization: true }, orderBy: { createdAt: "desc" } }),
    ]);
    const usersById = new Map();
    for (const membership of memberships) usersById.set(membership.user.id, membership.user);
    for (const assignment of assignments) usersById.set(assignment.user.id, assignment.user);
    return res.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, subscription_mode: tenant.subscriptionMode, plan_key: tenant.planKey, billing_organization_id: tenant.billingOrganizationId },
      organizations: organizations.map(organizationView),
      users: [...usersById.values()].map((u) => ({ id: u.id, legacy_user_id: u.legacyUserId, email: u.email, display_name: u.displayName, status: u.status })),
      memberships: memberships.map(membershipView),
      role_assignments: assignments.map((a) => ({ id: a.id, user_id: a.userId, role: a.role.key, scope_type: a.scopeType, tenant_id: a.tenantId, organization_id: a.organizationId, is_active: a.isActive })),
      relationships: relationships.map((r) => ({ id: r.id, type: r.type, status: r.status, is_primary: r.isPrimary, from_organization_id: r.fromOrganizationId, to_organization_id: r.toOrganizationId, from_organization: organizationView(r.fromOrganization), to_organization: organizationView(r.toOrganization), notes: r.notes })),
      capabilities: { relationship_types: [...RELATIONSHIP_TYPES], canonical_control_plane: true },
    });
  } catch (e) { return next(e); }
});

router.post("/memberships", async (req, res, next) => {
  try {
    const userId = text(req.body?.user_id, "user_id", { required: true, max: 100 });
    const organizationId = text(req.body?.organization_id, "organization_id", { required: true, max: 100 });
    const status = membershipStatus(req.body?.status);
    const jobTitle = text(req.body?.job_title, "job_title", { max: 200 });
    const [user, organization] = await Promise.all([
      prismaControl.appUser.findUnique({ where: { id: userId } }),
      prismaControl.organization.findUnique({ where: { id: organizationId } }),
    ]);
    if (!user || !organization) return res.status(404).json({ message: "User or organization not found" });
    await assertOrganizationAdminAccess(req, organizationId);
    if (req.body?.is_primary) await prismaControl.organizationMembership.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
    const created = await prismaControl.organizationMembership.create({
      data: { userId, organizationId, status, isPrimary: Boolean(req.body?.is_primary), jobTitle },
      include: { user: true, organization: true },
    });
    return res.status(201).json(membershipView(created));
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This user already belongs to this organization" });
    return next(e);
  }
});

router.patch("/memberships/:id", async (req, res, next) => {
  try {
    const id = text(req.params.id, "membership id", { required: true, max: 100 });
    const existing = await prismaControl.organizationMembership.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Membership not found" });
    await assertOrganizationAdminAccess(req, existing.organizationId);
    const data = {};
    if (req.body?.status !== undefined) data.status = membershipStatus(req.body.status);
    if (req.body?.job_title !== undefined) data.jobTitle = text(req.body.job_title, "job_title", { max: 200 });
    if (req.body?.is_primary !== undefined) {
      data.isPrimary = Boolean(req.body.is_primary);
      if (data.isPrimary) await prismaControl.organizationMembership.updateMany({ where: { userId: existing.userId, isPrimary: true, id: { not: id } }, data: { isPrimary: false } });
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: "No supported fields to update" });
    const updated = await prismaControl.organizationMembership.update({ where: { id }, data, include: { user: true, organization: true } });
    return res.json(membershipView(updated));
  } catch (e) { return next(e); }
});

router.delete("/memberships/:id", async (req, res, next) => {
  try {
    const id = text(req.params.id, "membership id", { required: true, max: 100 });
    const existing = await prismaControl.organizationMembership.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Membership not found" });
    await assertOrganizationAdminAccess(req, existing.organizationId);
    await prismaControl.$transaction([
      prismaControl.roleAssignment.deleteMany({ where: { userId: existing.userId, scopeType: "ORGANIZATION", organizationId: existing.organizationId } }),
      prismaControl.organizationMembership.delete({ where: { id } }),
    ]);
    return res.status(204).end();
  } catch (e) { return next(e); }
});

router.post("/relationships", async (req, res, next) => {
  try {
    const type = String(req.body?.type || "").trim().toUpperCase();
    if (!RELATIONSHIP_TYPES.has(type)) return res.status(400).json({ message: "Unsupported relationship type" });
    const fromOrganizationId = text(req.body?.from_organization_id, "from_organization_id", { required: true, max: 100 });
    const toOrganizationId = text(req.body?.to_organization_id, "to_organization_id", { required: true, max: 100 });
    if (fromOrganizationId === toOrganizationId) return res.status(400).json({ message: "An organization cannot relate to itself" });
    const notes = text(req.body?.notes, "notes", { max: 2000 });
    const [fromOrg, toOrg] = await Promise.all([
      prismaControl.organization.findUnique({ where: { id: fromOrganizationId } }),
      prismaControl.organization.findUnique({ where: { id: toOrganizationId } }),
    ]);
    if (!fromOrg || !toOrg) return res.status(404).json({ message: "Organization not found" });
    await assertOrganizationAdminAccess(req, fromOrganizationId);
    const created = await prismaControl.organizationRelationship.create({ data: { fromOrganizationId, toOrganizationId, type, notes, isPrimary: Boolean(req.body?.is_primary) }, include: { fromOrganization: true, toOrganization: true } });
    return res.status(201).json({ id: created.id, type: created.type, status: created.status, is_primary: created.isPrimary, from_organization_id: created.fromOrganizationId, to_organization_id: created.toOrganizationId, from_organization: organizationView(created.fromOrganization), to_organization: organizationView(created.toOrganization), notes: created.notes });
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ message: "This organization relationship already exists" });
    return next(e);
  }
});

router.delete("/relationships/:id", async (req, res, next) => {
  try {
    const id = text(req.params.id, "relationship id", { required: true, max: 100 });
    const existing = await prismaControl.organizationRelationship.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Relationship not found" });
    await assertOrganizationAdminAccess(req, existing.fromOrganizationId);
    await prismaControl.organizationRelationship.delete({ where: { id } });
    return res.status(204).end();
  } catch (e) { return next(e); }
});

export default router;
