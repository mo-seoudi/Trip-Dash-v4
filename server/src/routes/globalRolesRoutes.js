// server/routes/globalRolesRoutes.js
const express = require("express");
const router = express.Router();

// ✅ Prefer your existing singleton Prisma client:
let prisma;
try {
  ({ prisma } = require("../globalDb"));
  if (!prisma) ({ prismaGlobal: prisma } = require("../globalDb"));
} catch {
  const { PrismaClient } = require("../src/prisma-global");
  prisma = new PrismaClient();
}

// ---- Utilities -------------------------------------------------------------
function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}
async function orgMustExist(id) {
  return prisma.organization.findUnique({ where: { id: String(id) } });
}
async function userMustExist(id) {
  return prisma.user.findUnique({ where: { id: String(id) } });
}

// ===========================================================================
// Memberships (UserOrgMembership)  -> maps to `user_roles`
// ===========================================================================

// POST /api/global/roles/memberships  { userId, orgId, role, status?, isDefault? }
router.post("/memberships", async (req, res) => {
  try {
    const { userId, orgId, role, status = "pending", isDefault = false } = req.body || {};
    if (!userId || !orgId || !role) return bad(res, "userId, orgId, role are required");

    const [user, org] = await Promise.all([userMustExist(userId), orgMustExist(orgId)]);
    if (!user || !org) return bad(res, "Invalid userId or orgId");

    // If setting a default, clear previous defaults for this user (optional policy).
    if (isDefault) {
      await prisma.userOrgMembership.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await prisma.userOrgMembership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role,
        status,
        isDefault,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    // Unique constraint (userId, orgId, role)
    if (e.code === "P2002") return bad(res, "Membership already exists for this role");
    console.error("POST membership error:", e);
    res.status(500).json({ error: "Failed to create membership" });
  }
});

// DELETE /api/global/roles/memberships  { userId, orgId, role }
router.delete("/memberships", async (req, res) => {
  try {
    const { userId, orgId, role } = req.body || {};
    if (!userId || !orgId || !role) return bad(res, "userId, orgId, role are required");

    const deleted = await prisma.userOrgMembership.delete({
      where: {
        // composite unique in schema: [userId, orgId, role]
        userId_orgId_role: { userId: String(userId), orgId: String(orgId), role: String(role) },
      },
    });
    res.json(deleted);
  } catch (e) {
    console.error("DELETE membership error:", e);
    res.status(500).json({ error: "Failed to delete membership" });
  }
});

// PATCH /api/global/roles/memberships/:id  { status?, isDefault? }
router.patch("/memberships/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isDefault } = req.body || {};

    const existing = await prisma.userOrgMembership.findUnique({ where: { id: Number(id) } });
    if (!existing) return bad(res, "Membership not found", 404);

    // If toggling default true, clear others for this user
    if (isDefault === true) {
      await prisma.userOrgMembership.updateMany({
        where: { userId: existing.userId, isDefault: true, NOT: { id: existing.id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.userOrgMembership.update({
      where: { id: Number(id) },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    });
    res.json(updated);
  } catch (e) {
    console.error("PATCH membership error:", e);
    res.status(500).json({ error: "Failed to update membership" });
  }
});

// ===========================================================================
// Fine-grained scopes (UserOrgScope) -> maps to `user_role_scopes`
// ===========================================================================

// POST /api/global/roles/scopes  { userId, orgId, role, schoolOrgId }
router.post("/scopes", async (req, res) => {
  try {
    const { userId, orgId, role, schoolOrgId } = req.body || {};
    if (!userId || !orgId || !role || !schoolOrgId) {
      return bad(res, "userId, orgId, role, schoolOrgId are required");
    }

    const [user, org, school] = await Promise.all([
      userMustExist(userId),
      orgMustExist(orgId),
      orgMustExist(schoolOrgId),
    ]);
    if (!user || !org || !school) return bad(res, "Invalid userId/orgId/schoolOrgId");

    // Ensure the scoped school is a school and belongs to the same tenant
    if (school.type !== "school") return bad(res, "schoolOrgId must be type=school");
    if (school.tenantId !== org.tenantId) return bad(res, "orgId and schoolOrgId must be under same tenant");

    const created = await prisma.userOrgScope.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role,
        schoolOrgId: school.id,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    if (e.code === "P2002") return bad(res, "Scope already exists");
    console.error("POST scope error:", e);
    res.status(500).json({ error: "Failed to create scope" });
  }
});

// DELETE /api/global/roles/scopes  { userId, orgId, role, schoolOrgId }
router.delete("/scopes", async (req, res) => {
  try {
    const { userId, orgId, role, schoolOrgId } = req.body || {};
    if (!userId || !orgId || !role || !schoolOrgId) {
      return bad(res, "userId, orgId, role, schoolOrgId are required");
    }

    const deleted = await prisma.userOrgScope.delete({
      where: {
        userId_orgId_role_schoolOrgId: {
          userId: String(userId),
          orgId: String(orgId),
          role: String(role),
          schoolOrgId: String(schoolOrgId),
        },
      },
    });
    res.json(deleted);
  } catch (e) {
    console.error("DELETE scope error:", e);
    res.status(500).json({ error: "Failed to delete scope" });
  }
});

module.exports = router;
