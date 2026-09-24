import { Router } from "express";
import { prismaControl } from "../lib/prismaControl.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function appUser(req) {
  const legacyUserId = Number(req.user?.id);
  return prismaControl.appUser.findFirst({
    where: {
      OR: [
        ...(Number.isInteger(legacyUserId) ? [{ legacyUserId }] : []),
        ...(req.user?.email ? [{ email: req.user.email }] : []),
      ],
    },
  });
}

async function requirePlatformAdmin(req) {
  const user = await appUser(req);
  if (!user) return null;
  const assignment = await prismaControl.roleAssignment.findFirst({
    where: { userId: user.id, isActive: true, scopeType: "PLATFORM", role: { key: "super_admin" } },
  });
  return assignment ? user : null;
}

router.delete("/organizations/:organizationId/relationships/:relationshipId", async (req, res, next) => {
  try {
    const actor = await requirePlatformAdmin(req);
    if (!actor) return res.status(403).json({ message: "Platform Super Admin access required" });

    const existing = await prismaControl.organizationRelationship.findFirst({
      where: {
        id: req.params.relationshipId,
        OR: [
          { fromOrganizationId: req.params.organizationId },
          { toOrganizationId: req.params.organizationId },
        ],
      },
    });
    if (!existing) return res.status(404).json({ message: "Relationship not found" });

    await prismaControl.$transaction(async (tx) => {
      await tx.organizationRelationship.delete({ where: { id: existing.id } });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.id,
          organizationId: req.params.organizationId,
          action: "relationship.deleted",
          resourceType: "organization_relationship",
          resourceId: existing.id,
          metadata: {
            type: existing.type,
            fromOrganizationId: existing.fromOrganizationId,
            toOrganizationId: existing.toOrganizationId,
            previousStatus: existing.status,
          },
        },
      });
    });

    return res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
