import { Router } from "express";
import { PrismaClient as PrismaGlobal } from "../prisma-global/index.js";

const router = Router();
const pg = new PrismaGlobal();

// ---- me / session are likely already in src/index.js ----

// Tenants
router.get("/tenants", async (req, res, next) => {
  try {
    const rows = await pg.tenants.findMany({ orderBy: { created_at: "desc" } });
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/tenants", async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    const row = await pg.tenants.create({ data: { name, slug } });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Orgs
router.get("/orgs", async (req, res, next) => {
  try {
    const where = req.query.tenant_id ? { tenant_id: String(req.query.tenant_id) } : {};
    const rows = await pg.organizations.findMany({
      where,
      include: { // parent org for schools
        partnerships_as_school: false,
        partnerships_as_buscompany: false,
      },
      orderBy: { created_at: "desc" },
    });
    // attach parent name if any
    const parentMap = new Map(rows.map(r => [r.id, r]));
    const withParent = rows.map(r => ({
      ...r,
      parent: r.parent_org_id ? parentMap.get(r.parent_org_id) || null : null
    }));
    res.json(withParent);
  } catch (e) { next(e); }
});

router.post("/orgs", async (req, res, next) => {
  try {
    const { tenant_id, name, type, code, parent_org_id } = req.body;
    const row = await pg.organizations.create({
      data: { tenant_id, name, type, code, parent_org_id: parent_org_id || null },
    });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/orgs/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await pg.organizations.update({ where: { id }, data: req.body });
    res.json(row);
  } catch (e) { next(e); }
});

// Partnerships
router.get("/partnerships", async (req, res, next) => {
  try {
    const where = req.query.tenant_id ? { tenant_id: String(req.query.tenant_id) } : {};
    const rows = await pg.partnerships.findMany({
      where,
      include: {
        school_org: { select: { id: true, name: true } },
        bus_company: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
    });
    res.json(rows.map(r => ({
      ...r,
      school_org: r.school_org,
      bus_company: r.bus_company,
    })));
  } catch (e) { next(e); }
});

router.post("/partnerships", async (req, res, next) => {
  try {
    const { tenant_id, school_org_id, bus_company_org_id } = req.body;
    const row = await pg.partnerships.create({ data: { tenant_id, school_org_id, bus_company_org_id } });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.delete("/partnerships/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await pg.partnerships.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
