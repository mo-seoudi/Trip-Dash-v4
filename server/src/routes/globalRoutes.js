// server/src/routes/globalRoutes.js
import { Router } from "express";
import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

const router = Router();
const pg = new PrismaGlobal();

// ---- helpers ----
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
    id: o.id,
    tenant_id: o.tenant_id,
    name: o.name,
    type: ORG_TYPE_OUT[o.type] ?? o.type,
    code: o.code,
    parent_org_id: o.parent_org_id,
    created_at: o.created_at,
    updated_at: o.updated_at,
    parent: o.parent
      ? {
          id: o.parent.id,
          name: o.parent.name,
          type: ORG_TYPE_OUT[o.parent.type] ?? o.parent.type,
        }
      : null,
  };
}

function bad(res, code, msg) {
  return res.status(code).json({ message: msg });
}

// ---------- Tenants ----------

// GET /api/global/tenants
router.get("/tenants", async (_req, res, next) => {
  try {
    const rows = await pg.tenants.findMany({ orderBy: { created_at: "desc" } });
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
    const created = await pg.tenants.create({ data: { name, slug } });
    res.status(201).json(created);
  } catch (e) {
    console.error("create tenant error:", e);
    return bad(res, 500, "Failed to create tenant");
  }
});

// ---------- Organizations ----------

// GET /api/global/orgs?tenant_id=...
router.get("/orgs", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const orgs = await pg.organizations.findMany({
      where: { tenant_id: String(tenant_id) },
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

    if (parent_org_id) {
      const parent = await pg.organizations.findFirst({
        where: { id: String(parent_org_id), tenant_id: String(tenant_id) },
        select: { id: true },
      });
      if (!parent) return bad(res, 400, "parent_org_id not found in tenant");
    }

    const created = await pg.organizations.create({
      data: {
        tenant_id: String(tenant_id),
        name,
        type: ORG_TYPE_IN[type],
        code: code || null,
        parent_org_id: parent_org_id || null,
      },
    });

    const fresh = await pg.organizations.findUnique({
      where: { id: created.id },
      include: { parent: true },
    });

    res.status(201).json(toOutOrg(fresh));
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

    await pg.organizations.update({
      where: { id: String(id) },
      data: patch,
    });

    const fresh = await pg.organizations.findUnique({
      where: { id: String(id) },
      include: { parent: true },
    });

    res.json(toOutOrg(fresh));
  } catch (e) {
    console.error("update org error:", e);
    return bad(res, 500, "Failed to update organization");
  }
});

// ---------- Partnerships ----------

// GET /api/global/partnerships?tenant_id=...
router.get("/partnerships", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, 400, "tenant_id is required");

    const rows = await pg.partnerships.findMany({
      where: { tenant_id: String(tenant_id), is_active: true },
      include: { school_org: true, bus_company: true },
      orderBy: { created_at: "desc" },
    });

    res.json(
      rows.map((p) => ({
        id: p.id,
        tenant_id: p.tenant_id,
        school_org_id: p.school_org_id,
        bus_company_org_id: p.bus_company_id,
        created_at: p.created_at,
        school_org: p.school_org ? { id: p.school_org.id, name: p.school_org.name } : null,
        bus_company: p.bus_company ? { id: p.bus_company.id, name: p.bus_company.name } : null,
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
        tenant_id: String(tenant_id),
        school_org_id: String(school_org_id),
        bus_company_id: String(bus_company_org_id),
        is_active: true,
      },
      include: { school_org: true, bus_company: true },
    });

    res.status(201).json({
      id: created.id,
      tenant_id: created.tenant_id,
      school_org_id: created.school_org_id,
      bus_company_org_id: created.bus_company_id,
      created_at: created.created_at,
      school_org: created.school_org ? { id: created.school_org.id, name: created.school_org.name } : null,
      bus_company: created.bus_company ? { id: created.bus_company.id, name: created.bus_company.name } : null,
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
    await pg.partnerships.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  } catch (e) {
    console.error("delete partnership error:", e);
    return bad(res, 500, "Failed to delete partnership");
  }
});

// ---------- Users / Roles / Scopes ----------

// GET /api/global/users?q=...
router.get("/users", async (req, res, next) => {
  try {
    const { q = "" } = req.query;
    const rows = await pg.users.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: String(q), mode: "insensitive" } },
              { full_name: { contains: String(q), mode: "insensitive" } },
            ],
          }
        : undefined,
      take: 25,
      orderBy: { created_at: "desc" },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/global/users/:id/grants
router.get("/users/:id/grants", async (req, res, next) => {
  try {
    const { id } = req.params;

    const [roles, scopes] = await Promise.all([
      pg.userRoles.findMany({
        where: { user_id: String(id) },
        include: { organizations: true },
        orderBy: { created_at: "desc" },
      }),
      pg.userRoleScopes.findMany({
        where: { user_id: String(id) },
        include: { org: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    res.json({
      roles: roles.map((r) => ({
        user_id: r.user_id,
        org_id: r.org_id,
        role: r.role,
        is_default: r.is_default,
        created_at: r.created_at,
        org: r.organizations ? { id: r.organizations.id, name: r.organizations.name } : null,
      })),
      scopes: scopes.map((s) => ({
        user_id: s.user_id,
        org_id: s.org_id,
        role: s.role,
        school_org_id: s.school_org_id,
        created_at: s.created_at,
        org: s.org ? { id: s.org.id, name: s.org.name } : null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/global/users/:id/roles   { org_id, role, is_default? }
router.post("/users/:id/roles", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { org_id, role, is_default = false } = req.body || {};
    if (!org_id || !role) return bad(res, 400, "org_id and role are required");

    if (is_default) {
      await pg.userRoles.updateMany({
        where: { user_id: String(id), org_id: String(org_id) },
        data: { is_default: false },
      });
    }

    const created = await pg.userRoles.create({
      data: { user_id: String(id), org_id: String(org_id), role, is_default: Boolean(is_default) },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/global/users/:id/roles  body: { org_id, role }
router.delete("/users/:id/roles", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { org_id, role } = req.body || {};
    if (!org_id || !role) return bad(res, 400, "org_id and role are required");

    await pg.userRoles.delete({
      where: { user_id_org_id_role: { user_id: String(id), org_id: String(org_id), role } },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/global/users/:id/scopes   { org_id, role, school_org_id }
router.post("/users/:id/scopes", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { org_id, role, school_org_id } = req.body || {};
    if (!org_id || !role || !school_org_id)
      return bad(res, 400, "org_id, role, school_org_id required");

    const created = await pg.userRoleScopes.create({
      data: {
        user_id: String(id),
        org_id: String(org_id),
        role,
        school_org_id: String(school_org_id),
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/global/users/:id/scopes  body: { org_id, role, school_org_id }
router.delete("/users/:id/scopes", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { org_id, role, school_org_id } = req.body || {};
    if (!org_id || !role || !school_org_id)
      return bad(res, 400, "org_id, role, school_org_id required");

    await pg.userRoleScopes.delete({
      where: {
        user_id_org_id_role_school_org_id: {
          user_id: String(id),
          org_id: String(org_id),
          role,
          school_org_id: String(school_org_id),
        },
      },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;


