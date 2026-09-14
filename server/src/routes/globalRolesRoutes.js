// server/src/routes/globalRolesRoutes.js
import express from "express";
import { prismaGlobal as prisma } from "../lib/prismaGlobal.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const MEMBERSHIP_STATUS_ALLOWED = new Set(["pending", "active", "suspended", "revoked"]);
const LEGACY_ROLE_ALLOWED = new Set([
  "admin",
  "school_staff",
  "finance",
  "bus_company", // persisted legacy value
  "bus_operator", // accepted at API boundary and stored as bus_company until migration
  "trip_manager",
]);

const storedRole = (role) => (role === "bus_operator" ? "bus_company" : role);

const orgMustExist = (id) =>
  prisma.organization.findUnique({ where: { id: String(id) } });

const userMustExist = (id) =>
  prisma.user.findUnique({ where: { id: String(id) } });

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ===================================================================
// Memberships (UserOrgMembership) -> legacy `user_roles`
// ===================================================================

router.post("/roles/memberships", async (req, res, next) => {
  try {
    const { userId, orgId } = req.body || {};
    const role = String(req.body?.role || "").trim();
    const status = String(req.body?.status || "pending").trim().toLowerCase();
    const isDefault = req.body?.isDefault === true;

    if (!userId || !orgId || !role) return bad(res, "userId, orgId, role are required");
    if (!LEGACY_ROLE_ALLOWED.has(role)) return bad(res, "Invalid role");
    if (!MEMBERSHIP_STATUS_ALLOWED.has(status)) return bad(res, "Invalid status");

    const [user, org] = await Promise.all([userMustExist(userId), orgMustExist(orgId)]);
    if (!user || !org) return bad(res, "Invalid userId or orgId");

    const roleToStore = storedRole(role);

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.userOrgMembership.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userOrgMembership.create({
        data: { userId: user.id, orgId: org.id, role: roleToStore, status, isDefault },
      });
    });

    return res.status(201).json({
      ...created,
      role: created.role === "bus_company" ? "bus_operator" : created.role,
    });
  } catch (e) {
    if (e?.code === "P2002") return bad(res, "Membership already exists for this role", 409);
    return next(e);
  }
});

router.delete("/roles/memberships", async (req, res, next) => {
  try {
    const { userId, orgId } = req.body || {};
    const role = String(req.body?.role || "").trim();
    if (!userId || !orgId || !role) return bad(res, "userId, orgId, role are required");
    if (!LEGACY_ROLE_ALLOWED.has(role)) return bad(res, "Invalid role");

    const key = {
      userId: String(userId),
      orgId: String(orgId),
      role: storedRole(role),
    };

    const existing = await prisma.userOrgMembership.findUnique({
      where: { userId_orgId_role: key },
      select: { id: true },
    });
    if (!existing) return bad(res, "Membership not found", 404);

    await prisma.userOrgMembership.delete({ where: { userId_orgId_role: key } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

router.patch("/roles/memberships/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return bad(res, "Invalid membership id");

    const allowedFields = new Set(["status", "isDefault"]);
    const unknown = Object.keys(req.body || {}).filter((key) => !allowedFields.has(key));
    if (unknown.length) return bad(res, `Unsupported fields: ${unknown.join(", ")}`);

    const existing = await prisma.userOrgMembership.findUnique({ where: { id } });
    if (!existing) return bad(res, "Membership not found", 404);

    const status =
      req.body?.status === undefined ? undefined : String(req.body.status).trim().toLowerCase();
    if (status !== undefined && !MEMBERSHIP_STATUS_ALLOWED.has(status)) {
      return bad(res, "Invalid status");
    }

    const isDefault = req.body?.isDefault;
    if (isDefault !== undefined && typeof isDefault !== "boolean") {
      return bad(res, "isDefault must be boolean");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.userOrgMembership.updateMany({
          where: { userId: existing.userId, isDefault: true, NOT: { id: existing.id } },
          data: { isDefault: false },
        });
      }

      return tx.userOrgMembership.update({
        where: { id },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
        },
      });
    });

    return res.json({
      ...updated,
      role: updated.role === "bus_company" ? "bus_operator" : updated.role,
    });
  } catch (e) {
    return next(e);
  }
});

// ===================================================================
// Fine-grained scopes (UserOrgScope) -> legacy `user_role_scopes`
// ===================================================================

router.post("/roles/scopes", async (req, res, next) => {
  try {
    const { userId, orgId, schoolOrgId } = req.body || {};
    const role = String(req.body?.role || "").trim();
    if (!userId || !orgId || !role || !schoolOrgId) {
      return bad(res, "userId, orgId, role, schoolOrgId are required");
    }
    if (!LEGACY_ROLE_ALLOWED.has(role)) return bad(res, "Invalid role");

    const [user, org, school] = await Promise.all([
      userMustExist(userId),
      orgMustExist(orgId),
      orgMustExist(schoolOrgId),
    ]);
    if (!user || !org || !school) return bad(res, "Invalid userId/orgId/schoolOrgId");
    if (school.type !== "school") return bad(res, "schoolOrgId must be type=school");
    if (school.tenantId !== org.tenantId) {
      return bad(res, "orgId and schoolOrgId must be under same tenant");
    }

    const roleToStore = storedRole(role);
    const membership = await prisma.userOrgMembership.findUnique({
      where: {
        userId_orgId_role: {
          userId: user.id,
          orgId: org.id,
          role: roleToStore,
        },
      },
      select: { id: true },
    });
    if (!membership) return bad(res, "Matching membership is required before adding a scope");

    const created = await prisma.userOrgScope.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: roleToStore,
        schoolOrgId: school.id,
      },
    });

    return res.status(201).json({
      ...created,
      role: created.role === "bus_company" ? "bus_operator" : created.role,
    });
  } catch (e) {
    if (e?.code === "P2002") return bad(res, "Scope already exists", 409);
    return next(e);
  }
});

router.delete("/roles/scopes", async (req, res, next) => {
  try {
    const { userId, orgId, schoolOrgId } = req.body || {};
    const role = String(req.body?.role || "").trim();
    if (!userId || !orgId || !role || !schoolOrgId) {
      return bad(res, "userId, orgId, role, schoolOrgId are required");
    }
    if (!LEGACY_ROLE_ALLOWED.has(role)) return bad(res, "Invalid role");

    const key = {
      userId: String(userId),
      orgId: String(orgId),
      role: storedRole(role),
      schoolOrgId: String(schoolOrgId),
    };

    const existing = await prisma.userOrgScope.findUnique({
      where: { userId_orgId_role_schoolOrgId: key },
      select: { id: true },
    });
    if (!existing) return bad(res, "Scope not found", 404);

    await prisma.userOrgScope.delete({ where: { userId_orgId_role_schoolOrgId: key } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
