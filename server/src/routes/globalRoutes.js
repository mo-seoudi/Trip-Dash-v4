// server/routes/globalRoutes.js
const express = require("express");
const router = express.Router();

// ✅ Prefer your existing singleton Prisma client:
let prisma;
try {
  // Option A: your helper that exports { prisma } or { prismaGlobal }
  // Edit either line to match your export name:
  ({ prisma } = require("../globalDb"));
  if (!prisma) ({ prismaGlobal: prisma } = require("../globalDb"));
} catch {
  // Option B: fallback (not recommended if you already have a shared client)
  const { PrismaClient } = require("../src/prisma-global");
  prisma = new PrismaClient();
}

// ---- Utilities -------------------------------------------------------------
function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}
async function tenantMustExist(tenantId) {
  return prisma.tenant.findUnique({ where: { id: String(tenantId) } });
}
async function orgMustExist(id) {
  return prisma.organization.findUnique({ where: { id: String(id) } });
}
async function userMustExist(id) {
  return prisma.user.findUnique({ where: { id: String(id) } });
}
const ORG_TYPES = new Set(["edu_group", "school", "bus_company"]);

// ===========================================================================
// Tenants
// ===========================================================================

// GET /api/global/tenants
router.get("/tenants", async (req, res) => {
  try {
    const rows = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET tenants error:", e);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// POST /api/global/tenants
router.post("/tenants", async (req, res) => {
  try {
    const { name, slug, billingEmail, status = "active", plan = "standard", timezone = "Asia/Dubai" } = req.body || {};
    if (!name || !slug) return bad(res, "name and slug are required");

    const created = await prisma.tenant.create({
      data: { name, slug, billingEmail, status, plan, timezone },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error("POST tenant error:", e);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// PATCH /api/global/tenants/:id
router.patch("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const t = await tenantMustExist(id);
    if (!t) return bad(res, "Tenant not found", 404);

    const { name, slug, billingEmail, status, plan, timezone } = req.body || {};
    const updated = await prisma.tenant.update({
      where: { id: String(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(billingEmail !== undefined ? { billingEmail } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(plan !== undefined ? { plan } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        updatedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (e) {
    console.error("PATCH tenant error:", e);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// ===========================================================================
// Organizations
// ===========================================================================

// GET /api/global/orgs?tenant_id=...
router.get("/orgs", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, "tenant_id is required");
    const tenant = await tenantMustExist(tenant_id);
    if (!tenant) return bad(res, "Tenant not found", 404);

    const rows = await prisma.organization.findMany({
      where: { tenantId: String(tenant_id) },
      include: {
        parent: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (e) {
    console.error("GET orgs error:", e);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

// POST /api/global/orgs
router.post("/orgs", async (req, res) => {
  try {
    const { tenant_id, type, name, slug, code, parent_org_id, email, phone, timezone = "Asia/Dubai" } = req.body || {};
    if (!tenant_id || !type || !name) return bad(res, "tenant_id, type, name are required");
    if (!ORG_TYPES.has(type)) return bad(res, "type must be one of edu_group | school | bus_company");

    const tenant = await tenantMustExist(tenant_id);
    if (!tenant) return bad(res, "Tenant not found", 404);

    // Validate parent (only allowed when creating a school)
    let parentIdToUse = null;
    if (parent_org_id) {
      const parent = await orgMustExist(parent_org_id);
      if (!parent || parent.tenantId !== tenant.id) return bad(res, "Invalid parent_org_id");
      if (type !== "school") return bad(res, "parent_org_id is only valid for type=school");
      if (parent.type !== "edu_group") return bad(res, "Parent must be of type edu_group");
      parentIdToUse = parent.id;
    }

    const created = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        type,
        name,
        slug: slug || undefined,
        code: code || undefined,
        parentOrgId: parentIdToUse,
        email: email || undefined,
        phone: phone || undefined,
        timezone,
      },
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("POST org error:", e);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

// PATCH /api/global/orgs/:id
router.patch("/orgs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const org = await orgMustExist(id);
    if (!org) return bad(res, "Organization not found", 404);

    const {
      name, slug, code, email, phone, timezone, parent_org_id,
    } = req.body || {};

    // if parent change is requested, validate (school -> parent edu_group)
    let parentUpdate = {};
    if (parent_org_id !== undefined) {
      if (!parent_org_id) {
        parentUpdate = { parentOrgId: null };
      } else {
        const parent = await orgMustExist(parent_org_id);
        if (!parent || parent.tenantId !== org.tenantId) return bad(res, "Invalid parent_org_id");
        if (org.type !== "school") return bad(res, "Only schools can have a parent");
        if (parent.type !== "edu_group") return bad(res, "Parent must be of type edu_group");
        parentUpdate = { parentOrgId: parent.id };
      }
    }

    const updated = await prisma.organization.update({
      where: { id: String(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...parentUpdate,
        updatedAt: new Date(),
      },
      include: { parent: { select: { id: true, name: true, type: true } } },
    });

    res.json(updated);
  } catch (e) {
    console.error("PATCH org error:", e);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

// ===========================================================================
// Partnerships (School ↔ Bus Company)
// ===========================================================================

// GET /api/global/partnerships?tenant_id=...
router.get("/partnerships", async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return bad(res, "tenant_id is required");
    const tenant = await tenantMustExist(tenant_id);
    if (!tenant) return bad(res, "Tenant not found", 404);

    const rows = await prisma.partnership.findMany({
      where: { tenantId: tenant.id },
      include: {
        school: { select: { id: true, name: true } },
        busCompany: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows);
  } catch (e) {
    console.error("GET partnerships error:", e);
    res.status(500).json({ error: "Failed to fetch partnerships" });
  }
});

// POST /api/global/partnerships
router.post("/partnerships", async (req, res) => {
  try {
    const { tenant_id, school_org_id, bus_company_org_id, inHouse = false, status = "active", notes, operator_user_id } = req.body || {};
    if (!tenant_id || !school_org_id || !bus_company_org_id) {
      return bad(res, "tenant_id, school_org_id, bus_company_org_id are required");
    }

    const tenant = await tenantMustExist(tenant_id);
    if (!tenant) return bad(res, "Tenant not found", 404);

    const school = await orgMustExist(school_org_id);
    const company = await orgMustExist(bus_company_org_id);
    if (!school || !company) return bad(res, "Invalid school_org_id or bus_company_org_id");
    if (school.tenantId !== tenant.id || company.tenantId !== tenant.id) {
      return bad(res, "Organizations must belong to the same tenant");
    }
    if (school.type !== "school") return bad(res, "school_org_id must be type=school");
    if (!inHouse && company.type !== "bus_company") {
      return bad(res, "bus_company_org_id must be type=bus_company unless inHouse=true");
    }
    if (inHouse && school.id !== company.id) {
      return bad(res, "inHouse=true requires bus_company_org_id === school_org_id");
    }

    // optional operator user validation (if provided)
    let operatorLink = {};
    if (operator_user_id) {
      const user = await userMustExist(operator_user_id);
      if (!user) return bad(res, "operator_user_id not found");
      operatorLink = { operatorUserId: user.id };
    }

    const created = await prisma.partnership.create({
      data: {
        tenantId: tenant.id,
        schoolOrgId: school.id,
        busCompanyOrgId: company.id,
        inHouse,
        status,
        notes: notes || undefined,
        ...operatorLink,
      },
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("POST partnership error:", e);
    res.status(500).json({ error: "Failed to create partnership" });
  }
});

// DELETE /api/global/partnerships/:id
router.delete("/partnerships/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // will throw if not found—wrap in try
    const deleted = await prisma.partnership.delete({ where: { id: String(id) } });
    res.json(deleted);
  } catch (e) {
    console.error("DELETE partnership error:", e);
    res.status(500).json({ error: "Failed to delete partnership" });
  }
});

// ===========================================================================
// Users (directory + quick grants peek)
// ===========================================================================

// GET /api/global/users?q=...
router.get("/users", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const rows = await prisma.user.findMany({
      where,
      include: {
        memberships: {
          include: { org: { select: { id: true, name: true, type: true, tenantId: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });
    res.json(rows);
  } catch (e) {
    console.error("GET users error:", e);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// GET /api/global/users/:id/grants
router.get("/users/:id/grants", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: String(id) },
      include: {
        memberships: {
          include: { org: { select: { id: true, name: true, type: true, tenantId: true } } },
        },
        roleScopes: {
          include: {
            org: { select: { id: true, name: true, type: true, tenantId: true } },
            school: { select: { id: true, name: true, type: true, tenantId: true } },
          },
        },
      },
    });
    if (!user) return bad(res, "User not found", 404);
    res.json(user);
  } catch (e) {
    console.error("GET user grants error:", e);
    res.status(500).json({ error: "Failed to fetch user grants" });
  }
});

module.exports = router;
