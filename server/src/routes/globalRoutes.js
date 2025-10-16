// server/src/routes/globalRoutes.js
import { Router } from "express";
import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

const router = Router();
const pg = new PrismaGlobal();

// ---- helpers ----
const ORG_TYPE_ALLOWED = new Set(["edu_group", "school", "bus_company"]);

// normalize Prisma Organization to your old API shape
function orgToOut(o) {
  return {
    id: o.id,
    tenant_id: o.tenantId,
    name: o.name,
    type: o.type, // already 'edu_group' | 'school' | 'bus_company'
    code: o.code ?? null,
    parent_org_id: o.parentOrgId ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    parent: o.parent
      ? {
          id: o.parent.id,
          name: o.parent.name,
          type: o.parent.type,
        }
      : null,
  };
}

function bad(res, code, msg) {
  return res.status(code).json({ message: msg });
}

/* ============================================================================
   Tenants
   ========================================================================== */

// GET /api/global/tenants
router.get("/tenants", async (_req, res, next) => {
  try {
    const rows = await pg.tenant.findMany({ orderBy: { createdAt: "desc" } });
    // keep old snake_case keys on the wire
    res.json(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        billing_email: t.billingEmail ?? null,
        timezone: t.timezone,
        plan: t.plan,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// POST /api/global/tenants  { name, slug }
router.post("/tenants", async (req, res) => {
  try {
    const { name, slug } = req.body || {};
    if (!name || !slug) return bad(res, 400, "name and slug are required");
    const created = await pg.tenant.create({ data: { name, slug } });
    res.status(201).json({
      id: created.id,
      name: created.name,
      slug: created.slug,
      status: created.status,
      billing_email: created.billingEmail ?? null,
      timezone: created.timezone,
      plan: created.plan,
      created_at: created.createdAt,
      updated_at: created.updatedAt,
    });
  } catch (e) {
    console.error("create tenant error:", e);
    return bad(res, 500, "Failed to create tenant");
  }
});

/* ============================================================================
   Organizations
   ========================================================================== */

// GET /api/global/orgs?tenant_id=...
router.get("/orgs", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const orgs = await pg.organization.findMany({
      where: { tenantId: String(tenant_id) },
      include: { parent: true },
      orderBy: { updatedAt: "desc" },
    });

    res.json(orgs.map(orgToOut));
  } catch (e) {
    console.error("list orgs error:", e);
    return bad(res, 500, "Failed to list organizations");
  }
});

// POST /api/global/orgs
// { tenant_id, name, type: 'edu_group'|'school'|'bus_company', code?, parent_org_id? }
router.post("/orgs", async (req, res) => {
  try {
    const { tenant_id, name, type, code, parent_org_id } = req.body || {};
    if (!tenant_id) return bad(res, 400, "tenant_id is required");
    if (!name) return bad(res, 400, "name is required");
    if (!type || !ORG_TYPE_ALLOWED.has(type))
      return bad(res, 400, "invalid type");

    if (parent_org_id) {
      // parent must exist inside same tenant
      const parent = await pg.organization.findFirst({
        where: { id: String(parent_org_id), tenantId: String(tenant_id) },
        select: { id: true, type: true },
      });
      if (!parent) return bad(res, 400, "parent_org_id not found in tenant");
      if (type !== "school")
        return bad(res, 400, "parent_org_id is only allowed for type=school");
      if (parent.type !== "edu_group")
        return bad(res, 400, "parent must be type=edu_group");
    }

    const created = await pg.organization.create({
      data: {
        tenantId: String(tenant_id),
        name,
        type, // already the exact string you store
        code: code || null,
        parentOrgId: parent_org_id || null,
      },
      include: { parent: true },
    });

    res.status(201).json(orgToOut(created));
  } catch (e) {
    console.error("create org error:", e);
    return bad(res, 500, "Failed to create organization");
  }
});

// PATCH /api/global/orgs/:id
router.patch("/orgs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...req.body };

    // validate 'type' if present
    if (patch.type !== undefined) {
      if (!ORG_TYPE_ALLOWED.has(patch.type))
        return bad(res, 400, "invalid type");
    }

    if (patch.code === "") patch.code = null;
    if (patch.parent_org_id === "") patch.parent_org_id = null;

    // if changing parent, enforce rules (only schools can have parents, parent must be edu_group)
    if ("parent_org_id" in patch) {
      if (patch.parent_org_id) {
        const [org, parent] = await Promise.all([
          pg.organization.findUnique({
            where: { id: String(id) },
            select: { id: true, tenantId: true, type: true },
          }),
          pg.organization.findUnique({
            where: { id: String(patch.parent_org_id) },
            select: { id: true, tenantId: true, type: true },
          }),
        ]);
        if (!org) return bad(res, 400, "organization not found");
        if (!parent || parent.tenantId !== org.tenantId)
          return bad(res, 400, "invalid parent_org_id");
        if (org.type !== "school")
          return bad(res, 400, "only schools can have a parent");
        if (parent.type !== "edu_group")
          return bad(res, 400, "parent must be type=edu_group");
      }
    }

    const updated = await pg.organization.update({
      where: { id: String(id) },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.code !== undefined ? { code: patch.code } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.parent_org_id !== undefined
          ? { parentOrgId: patch.parent_org_id }
          : {}),
        updatedAt: new Date(),
      },
      include: { parent: true },
    });

    res.json(orgToOut(updated));
  } catch (e) {
    console.error("update org error:", e);
    return bad(res, 500, "Failed to update organization");
  }
});

/* ============================================================================
   Partnerships
   ========================================================================== */

// GET /api/global/partnerships?tenant_id=...
router.get("/partnerships", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const rows = await pg.partnership.findMany({
      where: { tenantId: String(tenant_id) },
      include: {
        school: true,
        busCompany: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      rows.map((p) => ({
        id: p.id,
        tenant_id: p.tenantId,
        school_org_id: p.schoolOrgId,
        bus_company_org_id: p.busCompanyOrgId,
        in_house: p.inHouse,
        status: p.status,
        notes: p.notes ?? null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        school_org: p.school ? { id: p.school.id, name: p.school.name } : null,
        bus_company:
          p.busCompany ? { id: p.busCompany.id, name: p.busCompany.name } : null,
      }))
    );
  } catch (e) {
    console.error("list partnerships error:", e);
    return bad(res, 500, "Failed to list partnerships");
  }
});

// POST /api/global/partnerships
// { tenant_id, school_org_id, bus_company_org_id }
router.post("/partnerships", async (req, res) => {
  try {
    const { tenant_id, school_org_id, bus_company_org_id } = req.body || {};
    if (!tenant_id || !school_org_id || !bus_company_org_id)
      return bad(res, 400, "tenant_id, school_org_id, bus_company_org_id required");

    const created = await pg.partnership.create({
      data: {
        tenantId: String(tenant_id),
        schoolOrgId: String(school_org_id),
        busCompanyOrgId: String(bus_company_org_id),
        inHouse: false,
        status: "active",
      },
      include: { school: true, busCompany: true },
    });

    res.status(201).json({
      id: created.id,
      tenant_id: created.tenantId,
      school_org_id: created.schoolOrgId,
      bus_company_org_id: created.busCompanyOrgId,
      in_house: created.inHouse,
      status: created.status,
      notes: created.notes ?? null,
      created_at: created.createdAt,
      updated_at: created.updatedAt,
      school_org: created.school ? { id: created.school.id, name: created.school.name } : null,
      bus_company: created.busCompany ? { id: created.busCompany.id, name: created.busCompany.name } : null,
    });
  } catch (e) {
    console.error("create partnership error:", e);
    return bad(res, 500, "Failed to create partnership");
  }
});

// DELETE /api/global/partnerships/:id
router.delete("/partnerships/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pg.partnership.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  } catch (e) {
    console.error("delete partnership error:", e);
    return bad(res, 500, "Failed to delete partnership");
  }
});

/* ============================================================================
   Users / (directory only here)
   ========================================================================== */

// GET /api/global/users?q=...
router.get("/users", async (req, res, next) => {
  try {
    const { q = "" } = req.query;
    const where =
      q && String(q).trim()
        ? {
            OR: [
              { email: { contains: String(q), mode: "insensitive" } },
              { fullName: { contains: String(q), mode: "insensitive" } },
            ],
          }
        : undefined;

    const rows = await pg.user.findMany({
      where,
      take: 25,
      orderBy: { createdAt: "desc" },
    });

    res.json(
      rows.map((u) => ({
        id: u.id,
        tenant_id: u.tenantId ?? null,
        email: u.email,
        full_name: u.fullName ?? null,
        is_active: u.isActive,
        legacy_user_id: u.legacyUserId ?? null,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
      }))
    );
  } catch (e) {
    next(e);
  }
});

export default router;
