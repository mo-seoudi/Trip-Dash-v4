// server/src/routes/globalRoutes.js
import { Router } from "express";
import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

const router = Router();
const pg = new PrismaGlobal();

/* ---------- helpers ---------- */
const ORG_TYPE_IN = {
  school: "SCHOOL",
  bus_company: "BUS_COMPANY",
  parent_org: "PARENT_ORG",
};
const ORG_TYPE_OUT = {
  SCHOOL: "school",
  BUS_COMPANY: "bus_company",
  PARENT_ORG: "parent_org",
};

function toOutOrg(o) {
  return {
    ...o,
    type: ORG_TYPE_OUT[o.type] ?? o.type,
    parent: o.parent
      ? { id: o.parent.id, name: o.parent.name, type: ORG_TYPE_OUT[o.parent.type] }
      : null,
  };
}

function bad(res, code, msg) {
  return res.status(code).json({ message: msg });
}

/* ---------- Tenants ---------- */

// GET /api/global/tenants
router.get("/tenants", async (req, res, next) => {
  try {
    const rows = await pg.tenants.findMany({
      orderBy: { created_at: "desc" },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/global/tenants  { name, slug }
router.post("/tenants", async (req, res) => {
  try {
    const { name, slug } = req.body || {};
    if (!name || !slug) return bad(res, 400, "name and slug are required");

    const created = await pg.tenants.create({
      data: { name, slug },
    });
    res.status(201).json(created);
  } catch (e) {
    // unique slug, etc.
    console.error("create tenant error:", e);
    return bad(res, 500, "Failed to create tenant");
  }
});

/* ---------- Organizations ---------- */

// GET /api/global/orgs?tenant_id=...
router.get("/orgs", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const orgs = await pg.organizations.findMany({
      where: { tenant_id },
      include: { parent: true },
      orderBy: { updated_at: "desc" },
    });
    res.json(orgs.map(toOutOrg));
  } catch (e) {
    console.error("list orgs error:", e);
    return bad(res, 500, "Failed to list organizations");
  }
});

// POST /api/global/orgs
// { tenant_id, name, type: 'school'|'bus_company'|'parent_org', code?, parent_org_id? }
router.post("/orgs", async (req, res) => {
  try {
    const { tenant_id, name, type, code, parent_org_id } = req.body || {};
    if (!tenant_id) return bad(res, 400, "tenant_id is required");
    if (!name) return bad(res, 400, "name is required");
    if (!type || !ORG_TYPE_IN[type]) return bad(res, 400, "invalid type");

    // Optional: ensure parent belongs to same tenant if provided
    if (parent_org_id) {
      const parent = await pg.organizations.findFirst({
        where: { id: parent_org_id, tenant_id },
        select: { id: true },
      });
      if (!parent) return bad(res, 400, "parent_org_id not found in tenant");
    }

    const created = await pg.organizations.create({
      data: {
        tenant_id,
        name,
        type: ORG_TYPE_IN[type],
        code: code || null,
        parent_org_id: parent_org_id || null,
      },
      include: { parent: true },
    });
    res.status(201).json(toOutOrg(created));
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

    if (patch.type) {
      if (!ORG_TYPE_IN[patch.type]) return bad(res, 400, "invalid type");
      patch.type = ORG_TYPE_IN[patch.type];
    }
    if (patch.code === "") patch.code = null;
    if (patch.parent_org_id === "") patch.parent_org_id = null;

    const updated = await pg.organizations.update({
      where: { id },
      data: patch,
      include: { parent: true },
    });
    res.json(toOutOrg(updated));
  } catch (e) {
    console.error("update org error:", e);
    return bad(res, 500, "Failed to update organization");
  }
});

/* ---------- Partnerships ---------- */

// GET /api/global/partnerships?tenant_id=...
router.get("/partnerships", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const rows = await pg.partnerships.findMany({
      where: { tenant_id, is_active: true },
      include: {
        school_org: true,
        bus_company: true,
      },
      orderBy: { created_at: "desc" },
    });

    res.json(
      rows.map((p) => ({
        id: p.id,
        tenant_id: p.tenant_id,
        school_org_id: p.school_org_id,
        bus_company_org_id: p.bus_company_id,
        created_at: p.created_at,
        school_org: p.school_org
          ? { id: p.school_org.id, name: p.school_org.name }
          : null,
        bus_company: p.bus_company
          ? { id: p.bus_company.id, name: p.bus_company.name }
          : null,
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

    const created = await pg.partnerships.create({
      data: {
        tenant_id,
        school_org_id,
        bus_company_id: bus_company_org_id,
        is_active: true,
      },
      include: {
        school_org: true,
        bus_company: true,
      },
    });

    res.status(201).json({
      id: created.id,
      tenant_id: created.tenant_id,
      school_org_id: created.school_org_id,
      bus_company_org_id: created.bus_company_id,
      created_at: created.created_at,
      school_org: created.school_org
        ? { id: created.school_org.id, name: created.school_org.name }
        : null,
      bus_company: created.bus_company
        ? { id: created.bus_company.id, name: created.bus_company.name }
        : null,
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
    await pg.partnerships.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("delete partnership error:", e);
    return bad(res, 500, "Failed to delete partnership");
  }
});

export default router;
