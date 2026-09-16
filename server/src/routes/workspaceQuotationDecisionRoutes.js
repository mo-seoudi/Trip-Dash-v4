import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { canApproveWorkspaceQuotation } from "../services/workspaceAuthorization.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

const actorId = (access) => String(access?.user?.appUserId || "").trim() || null;

router.post("/request-changes", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) return res.status(400).json({ message: "trip id must be a positive integer" });
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ message: "Please explain what needs to be changed" });
    if (note.length > 1000) return res.status(400).json({ message: "Change request note is too long" });

    const c = await operationalPrismaForWorkspace(req.user, req.params.schoolId, PERMISSIONS.TRIP_APPROVE_QUOTE);
    const trip = await c.prisma.trip.findFirst({
      where: { id: tripId, owningSchoolOrganizationId: c.workspace.schoolId },
      select: { id: true, status: true, createdByAppUserId: true },
    });
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canApproveWorkspaceQuotation({ workspace: c.workspace, trip })) {
      return res.status(409).json({ message: "A submitted quotation is required before changes can be requested" });
    }

    const uid = actorId(c.access);
    if (!uid) return res.status(403).json({ message: "An application identity is required for this decision" });

    const result = await c.prisma.$transaction(async (tx) => {
      const quotation = await tx.tripQuotation.findFirst({
        where: { tripId, status: "submitted" },
        orderBy: { version: "desc" },
      });
      if (!quotation) throw Object.assign(new Error("Submitted quotation not found"), { status: 409 });

      let approval = await tx.tripApprovalRequest.findFirst({
        where: { tripId, quotationId: quotation.id, status: "pending", approverAppUserId: uid },
        orderBy: { requestedAt: "desc" },
      });
      if (approval) {
        approval = await tx.tripApprovalRequest.update({
          where: { id: approval.id },
          data: { status: "declined", decidedByAppUserId: uid, decidedAt: new Date(), decisionNote: note },
        });
      } else {
        approval = await tx.tripApprovalRequest.create({
          data: {
            tripId, quotationId: quotation.id, status: "declined",
            requestedByAppUserId: uid, approverAppUserId: uid, decidedByAppUserId: uid,
            decidedAt: new Date(), decisionNote: note, channel: "in_app",
          },
        });
      }

      await tx.tripQuotation.update({
        where: { id: quotation.id },
        data: { status: "superseded", supersededAt: new Date() },
      });
      await tx.tripApprovalRequest.updateMany({
        where: { quotationId: quotation.id, status: "pending", id: { not: approval.id } },
        data: { status: "superseded", decidedAt: new Date(), decisionNote: "Quotation changes requested through another approval request" },
      });
      await tx.externalWorkflowAction.updateMany({
        where: { quotationId: quotation.id, consumedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const changed = await tx.trip.updateMany({
        where: { id: tripId, status: "Quotation Submitted" },
        data: { status: "Accepted" },
      });
      if (changed.count !== 1) throw Object.assign(new Error("Trip changed while quotation changes were being requested"), { status: 409 });

      return { tripId, quotationId: quotation.id, quotationVersion: quotation.version, status: "Accepted", approvalRequestId: approval.id };
    });

    return res.json(result);
  } catch (error) { next(error); }
});

export default router;
