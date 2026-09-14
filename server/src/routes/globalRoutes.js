// server/src/routes/globalRoutes.js
import { Router } from "express";
import { prismaGlobal as pg } from "../lib/prismaGlobal.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// The legacy global/control plane is an administrative surface. Until it is
// replaced by the new scoped authorization model, every endpoint here requires
// an authenticated legacy admin. Frontend route hiding is not authorization.
router.use(requireAuth, requireAdmin);

const ORG_TYPE_ALLOWED = new Set([
  "edu_group",
  "school",
  "bus_company", // persisted legacy value; migrated later to bus_operator
  "service_partner",
]);

function bad(res, code, msg) {
  return res.status(code).json({ message: msg });
}

function cleanString(value, max = 200) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function slugify(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function orgToOut(o) {
  return {
    id: o.id,
    tenant_id: o.tenantId,
    name: o.name,
    type: o.type,
    code: o.code ?? null,
    parent_org_id: o.parentOrgId ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
    parent: o.parent
      ? { id: o.parent.id, name: o.parent.name, type: o.parent.type }
      : null,
    slug: o.slug,
  };
}

/* ============================================================================
   Tenants
   ========================================================================== */

router.get("/tenants", async (_req, res, next) => {
  try {
    const rows = await pg.tenant.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(
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
    return next(e);
  }
});

router.post("/tenants", async (req, res, next) => {
  try {
    const name = cleanString(req.body?.name);
    const slug = slugify(req.body?.slug || "");
    if (!name || !slug) return bad(res, 400, "name and slug are required");

    const created = await pg.tenant.create({ data: { name, slug } });
    return res.status(201).json({
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
    if (e?.code === "P2002") return bad(res, 409, "Tenant slug already exists");
    return next(e);
  }
});

/* ============================================================================
   Organizations
   ========================================================================== */

router.get("/orgs", async (req, res, next) => {
  try {
    const tenantId = cleanString(req.query?.tenant_id, 100);
    if (!tenantId) return bad(res, 400, "tenant_id is required");

    const orgs = await pg.organization.findMany({
      where: { tenantId },
      include: { parent: true },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(orgs.map(orgToOut));
  } catch (e) {
    return next(e);
  }
});

router.post("/orgs", async (req, res, next) => {
  try {
    const tenantId = cleanString(req.body?.tenant_id, 100);
    const name = cleanString(req.body?.name);
    const type = cleanString(req.body?.type, 50);
    const code = cleanString(req.body?.code, 50);
    const parentOrgId = cleanString(req.body?.parent_org_id, 100);

    if (!tenantId) return bad(res, 400, "tenant_id is required");
    if (!name) return bad(res, 400, "name is required");
    if (!type || !ORG_TYPE_ALLOWED.has(type)) return bad(res, 400, "invalid type");

    const tenant = await pg.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return bad(res, 400, "tenant_id not found");

    if (parentOrgId) {
      const parent = await pg.organization.findFirst({
        where: { id: parentOrgId, tenantId },
        select: { id: true, type: true },
      });
      if (!parent) return bad(res, 400, "parent_org_id not found in tenant");
      if (type !== "school") return bad(res, 400, "parent_org_id is only allowed for type=school");
      if (parent.type !== "edu_group") return bad(res, 400, "parent must be type=edu_group");
    }

    const finalSlug = slugify(req.body?.slug || name);
    if (!finalSlug) return bad(res, 400, "valid slug is required");

    const created = await pg.organization.create({
      data: {
        tenantId,
        name,
        type,
        slug: finalSlug,
        code,
        parentOrgId,
      },
      include: { parent: true },
    });

    return res.status(201).json(orgToOut(created));
  } catch (e) {
    if (e?.code === "P2002") return bad(res, 409, "Organization slug already exists");
    return next(e);
  }
});

router.patch("/orgs/:id", async (req, res, next) => {
  try {
    const id = cleanString(req.params?.id, 100);
    if (!id) return bad(res, 400, "organization id is required");

    const allowedFields = new Set([
      "name",
      "type",
      "slug",
      "code",
      "email",
      "phone",
      "timezone",
      "parent_org_id",
    ]);
    const unknown = Object.keys(req.body || {}).filter((key) => !allowedFields.has(key));
    if (unknown.length) return bad(res, 400, `Unsupported fields: ${unknown.join(", ")}`);

    const existing = await pg.organization.findUnique({
      where: { id },
      select: { id: true, tenantId: true, type: true },
    });
    if (!existing) return bad(res, 404, "organization not found");

    const patch = req.body || {};
    const nextType = patch.type !== undefined ? cleanString(patch.type, 50) : existing.type;
    if (!nextType || !ORG_TYPE_ALLOWED.has(nextType)) return bad(res, 400, "invalid type");

    const parentOrgId =
      patch.parent_org_id === undefined ? undefined : cleanString(patch.parent_org_id, 100);

    if (parentOrgId) {
      const parent = await pg.organization.findUnique({
        where: { id: parentOrgId },
        select: { id: true, tenantId: true, type: true },
      });
      if (!parent || parent.tenantId !== existing.tenantId)
        return bad(res, 400, "invalid parent_org_id");
      if (nextType !== "school") return bad(res, 400, "only schools can have a parent");
      if (parent.type !== "edu_group") return bad(res, 400, "parent must be type=edu_group");
    }

    if (parentOrgId === null && nextType !== "school") {
      // Explicitly clearing parent is fine for any type.
    } else if (nextType !== "school" && existing.type === "school" && patch.type !== undefined) {
      // A school cannot keep a group parent after changing into a non-school type.
      if (patch.parent_org_id === undefined) {
        return bad(res, 400, "clear parent_org_id when changing a school to another type");
      }
    }

    const nextSlug = patch.slug !== undefined ? slugify(patch.slug || "") : undefined;
    if (patch.slug !== undefined && !nextSlug) return bad(res, 400, "valid slug is required");

    const updated = await pg.organization.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: cleanString(patch.name) } : {}),
        ...(patch.type !== undefined ? { type: nextType } : {}),
        ...(patch.slug !== undefined ? { slug: nextSlug } : {}),
        ...(patch.code !== undefined ? { code: cleanString(patch.code, 50) } : {}),
        ...(patch.email !== undefined ? { email: cleanString(patch.email, 254) } : {}),
        ...(patch.phone !== undefined ? { phone: cleanString(patch.phone, 50) } : {}),
        ...(patch.timezone !== undefined ? { timezone: cleanString(patch.timezone, 100) } : {}),
        ...(parentOrgId !== undefined ? { parentOrgId } : {}),
        updatedAt: new Date(),
      },
      include: { parent: true },
    });

    return res.json(orgToOut(updated));
  } catch (e) {
    if (e?.code === "P2002") return bad(res, 409, "Organization slug already exists");
    return next(e);
  }
});

/* ============================================================================
   Partnerships (legacy school <-> bus operator relationship)
   ========================================================================== */

router.get("/partnerships", async (req, res, next) => {
  try {
    const tenantId = cleanString(req.query?.tenant_id, 100);
    if (!tenantId) return bad(res, 400, "tenant_id is required");

    const rows = await pg.partnership.findMany({
      where: { tenantId },
      include: { school: true, busCompany: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      rows.map((p) => ({
        id: p.id,
        tenant_id: p.tenantId,
        school_org_id: p.schoolOrgId,
        // Keep legacy wire keys temporarily so the existing admin UI does not break.
        // They will be migrated to bus_operator naming with the control-plane migration.
        bus_company_org_id: p.busCompanyOrgId,
        in_house: p.inHouse,
        status: p.status,
        notes: p.notes ?? null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        school_org: p.school ? { id: p.school.id, name: p.school.name } : null,
        bus_company: p.busCompany ? { id: p.busCompany.id, name: p.busCompany.name } : null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

router.post("/partnerships", async (req, res, next) => {
  try {
    const tenantId = cleanString(req.body?.tenant_id, 100);
    const schoolOrgId = cleanString(req.body?.school_org_id, 100);
    const busOperatorOrgId = cleanString(
      req.body?.bus_operator_org_id || req.body?.bus_company_org_id,
      100
    );

    if (!tenantId || !schoolOrgId || !busOperatorOrgId) {
      return bad(res, 400, "tenant_id, school_org_id and bus_operator_org_id are required");
    }

    const [school, operator] = await Promise.all([
      pg.organization.findUnique({ where: { id: schoolOrgId }, select: { id: true, tenantId: true, type: true } }),
      pg.organization.findUnique({ where: { id: busOperatorOrgId }, select: { id: true, tenantId: true, type: true } }),
    ]);

    if (!school || school.tenantId !== tenantId || school.type !== "school") {
      return bad(res, 400, "school_org_id must identify a school in the tenant");
    }
    if (!operator || operator.tenantId !== tenantId || !["bus_company", "bus_operator"].includes(operator.type)) {
      return bad(res, 400, "bus_operator_org_id must identify a bus operator in the tenant");
    }

    const created = await pg.partnership.create({
      data: {
        tenantId,
        schoolOrgId,
        busCompanyOrgId: busOperatorOrgId,
        inHouse: false,
        status: "active",
      },
      include: { school: true, busCompany: true },
    });

    return res.status(201).json({
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
    if (e?.code === "P2002") return bad(res, 409, "Partnership already exists");
    return next(e);
  }
});

router.delete("/partnerships/:id", async (req, res, next) => {
  try {
    const id = cleanString(req.params?.id, 100);
    if (!id) return bad(res, 400, "partnership id is required");

    const existing = await pg.partnership.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return bad(res, 404, "partnership not found");

    await pg.partnership.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

/* ============================================================================
   Users (legacy global directory only)
   ========================================================================== */

router.get("/users", async (req, res, next) => {
  try {
    const q = cleanString(req.query?.q, 200) || "";
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined;

    const rows = await pg.user.findMany({
      where,
      take: 25,
      orderBy: { createdAt: "desc" },
    });

    return res.json(
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
    return next(e);
  }
});

export default router;
