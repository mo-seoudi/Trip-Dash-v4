import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const TYPES = new Set(["SCHOOL_GROUP", "SCHOOL", "BUS_OPERATOR", "SERVICE_PARTNER"]);
const clean = (value, max = 200) => {
  const result = String(value ?? "").trim();
  if (result.length > max) { const error = new Error("Value is too long"); error.status = 400; throw error; }
  return result || null;
};
const slugify = (value) => String(value || "organization").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "organization";

async function canonicalUser(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({ where: { OR: [...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []), ...(req.user?.email ? [{ email: req.user.email }] : [])] } });
}

async function assertTenantAdmin(req, tenantId) {
  const user = await canonicalUser(req);
  if (!user) { const error = new Error("Canonical user identity not found"); error.status = 403; throw error; }
  const assignment = await prismaControl.roleAssignment.findFirst({ where: { userId: user.id, isActive: true, OR: [{ scopeType: "PLATFORM", role: { key: "super_admin" } }, { scopeType: "TENANT", tenantId, role: { key: { in: ["tenant_admin", "super_admin"] } } }] } });
  if (!assignment) { const error = new Error("Forbidden for this administration scope"); error.status = 403; throw error; }
}

async function uniqueSlug(seed, excludeId = null) {
  const base = slugify(seed);
  for (let i = 0; i < 100; i += 1) {
    const slug = i ? `${base}-${i + 1}` : base;
    const existing = await prismaControl.organization.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
  }
  return `${base}-${Date.now()}`;
}

async function assertCovered(tenantId, organizationId) {
  const coverage = await prismaControl.tenantOrganization.findUnique({ where: { tenantId_organizationId: { tenantId, organizationId } } });
  if (!coverage) { const error = new Error("Organization is outside this administration scope"); error.status = 404; throw error; }
}

router.post("/", async (req, res, next) => {
  try {
    const tenantId = clean(req.body?.tenant_id, 100);
    const displayName = clean(req.body?.display_name);
    const fullName = clean(req.body?.full_name);
    const abbreviation = clean(req.body?.abbreviation, 50)?.toUpperCase() || null;
    const type = String(req.body?.type || "").trim().toUpperCase();
    if (!tenantId || !displayName) return res.status(400).json({ message: "tenant_id and display_name are required" });
    if (!TYPES.has(type)) return res.status(400).json({ message: "Unsupported organization type" });
    await assertTenantAdmin(req, tenantId);
    if (!(await prismaControl.tenant.findUnique({ where: { id: tenantId } }))) return res.status(404).json({ message: "Administration scope not found" });
    const slug = await uniqueSlug(displayName);
    const organization = await prismaControl.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: { type, displayName, fullName, abbreviation, slug } });
      await tx.tenantOrganization.create({ data: { tenantId, organizationId: created.id } });
      return created;
    });
    return res.status(201).json({ id: organization.id });
  } catch (error) { return next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = clean(req.body?.tenant_id, 100);
    if (!tenantId) return res.status(400).json({ message: "tenant_id is required" });
    await assertTenantAdmin(req, tenantId);
    await assertCovered(tenantId, req.params.id);
    const existing = await prismaControl.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Organization not found" });
    const data = {};
    if (req.body?.display_name !== undefined) { const value = clean(req.body.display_name); if (!value) return res.status(400).json({ message: "display_name cannot be empty" }); data.displayName = value; }
    if (req.body?.full_name !== undefined) data.fullName = clean(req.body.full_name);
    if (req.body?.abbreviation !== undefined) data.abbreviation = clean(req.body.abbreviation, 50)?.toUpperCase() || null;
    if (req.body?.type !== undefined) { const type = String(req.body.type).trim().toUpperCase(); if (!TYPES.has(type)) return res.status(400).json({ message: "Unsupported organization type" }); data.type = type; }
    if (!Object.keys(data).length) return res.status(400).json({ message: "No supported fields to update" });
    await prismaControl.organization.update({ where: { id: existing.id }, data });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

export default router;
