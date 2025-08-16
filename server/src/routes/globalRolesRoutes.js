// server/src/routes/globalRolesRoutes.js
import { Router } from "express";
import { PrismaClient as GlobalPrisma } from "../prisma-global/index.js";
const g = new GlobalPrisma();
const router = Router();

// TODO: replace with your real auth middleware
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  next();
}

/**
 * Minimal "is admin" check:
 * - user must have ADMIN on some org within this tenant (you can tighten as you like)
 */
async function requireTenantAdmin(req, res, next) {
  try {
    const { tenant_id } = req.body.tenant || req.query; // or resolve from session
    const roles = await g.user_roles.findMany({
      where: { user_id: String(req.user.id) },
      include: { organizations: true },
    });
    const isAdmin = roles.some(r => r.role === "ADMIN" && r.organizations.tenant_id === tenant_id);
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });
    next();
  } catch (e) {
    next(e);
  }
}

/* ---------- Roles (assign/remove) ---------- */

// POST /api/global/user-roles  { user_id, org_id, role }
router.post("/user-roles", requireAuth, requireTenantAdmin, async (req, res, next) => {
  try {
    const { user_id, org_id, role } = req.body || {};
    if (!user_id || !org_id || !role) return res.status(400).json({ message: "user_id, org_id, role required" });

    const created = await g.user_roles.create({ data: { user_id, org_id, role } });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/global/user-roles  (body) { user_id, org_id, role }
router.delete("/user-roles", requireAuth, requireTenantAdmin, async (req, res, next) => {
  try {
    const { user_id, org_id, role } = req.body || {};
    if (!user_id || !org_id || !role) return res.status(400).json({ message: "user_id, org_id, role required" });

    await g.user_roles.delete({
      where: { user_id_org_id_role: { user_id, org_id, role } }, // composite PK in your schema
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Scopes (list/set) ---------- */

// GET /api/global/user-role-scopes?user_id=&org_id=&role=
router.get("/user-role-scopes", requireAuth, requireTenantAdmin, async (req, res, next) => {
  try {
    const { user_id, org_id, role } = req.query;
    if (!user_id || !org_id || !role) return res.status(400).json({ message: "user_id, org_id, role required" });

    const rows = await g.user_role_scopes.findMany({
      where: { user_id: String(user_id), org_id: String(org_id), role: String(role) },
      select: { school_org_id: true },
    });
    res.json({ school_org_ids: rows.map(r => r.school_org_id) });
  } catch (e) {
    next(e);
  }
});

// PUT /api/global/user-role-scopes  { user_id, org_id, role, school_org_ids: [] }
router.put("/user-role-scopes", requireAuth, requireTenantAdmin, async (req, res, next) => {
  try {
    const { user_id, org_id, role, school_org_ids = [] } = req.body || {};
    if (!user_id || !org_id || !role || !Array.isArray(school_org_ids)) {
      return res.status(400).json({ message: "user_id, org_id, role, school_org_ids[] required" });
    }

    // Replace semantics: delete existing, insert new
    await g.$transaction([
      g.user_role_scopes.deleteMany({ where: { user_id, org_id, role } }),
      ...(school_org_ids.length
        ? school_org_ids.map(sid =>
            g.user_role_scopes.create({ data: { user_id, org_id, role, school_org_id: sid } })
          )
        : []),
    ]);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
