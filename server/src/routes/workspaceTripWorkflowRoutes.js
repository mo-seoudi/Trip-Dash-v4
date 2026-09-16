// Explicit Trip workflow actions. These endpoints keep quotation submission,
// school approval and final operator confirmation out of generic status PATCHes.
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { canApproveWorkspaceQuotation, canConfirmWorkspaceTrip, canReadWorkspaceTrip, canSubmitWorkspaceQuotation } from "../services/workspaceAuthorization.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) { const e = new Error(`${field} must be a positive integer`); e.status = 400; throw e; }
  return n;
}
function actorId(access) { return String(access?.user?.appUserId || "").trim() || null; }
async function context(req, permission) {
  const tripId = positiveInt(req.params.tripId, "trip id");
  const c = await operationalPrismaForWorkspace(req.user, req.params.schoolId, permission);
  const trip = await c.prisma.trip.findFirst({ where: { id: tripId, owningSchoolOrganizationId: c.workspace.schoolId }, select: { id: true, status: true, createdByAppUserId: true } });
  return { ...c, tripId, trip };
}

router.get("/quotation", async (req, res, next) => {
  try {
    const { prisma, access, workspace, tripId, trip } = await context(req, PERMISSIONS.TRIP_READ);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadWorkspaceTrip({ access, workspace, trip })) return res.status(403).json({ message: "Forbidden" });
    const quotation = await prisma.tripQuotation.findFirst({ where: { tripId }, orderBy: { version: "desc" }, include: { lines: { orderBy: { sequence: "asc" } }, approvalRequests: { orderBy: { requestedAt: "desc" } } } });
    return res.json(quotation);
  } catch (e) { return next(e); }
});

router.post("/submit-quotation", async (req, res, next) => {
  try {
    const { prisma, access, workspace, tripId, trip } = await context(req, PERMISSIONS.TRIP_RESPOND);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canSubmitWorkspaceQuotation({ workspace, trip })) return res.status(409).json({ message: "Trip must be Accepted before its quotation can be submitted" });
    const result = await prisma.$transaction(async (tx) => {
      const buses = await tx.tripBusAssignment.findMany({ where: { tripId, status: { not: "cancelled" } }, orderBy: { sequence: "asc" } });
      if (!buses.length) { const e = new Error("At least one bus assignment is required before submitting a quotation"); e.status = 409; throw e; }
      for (const bus of buses) {
        if (!String(bus.busType || "").trim()) { const e = new Error(`Bus ${bus.sequence} requires a bus type before quotation submission`); e.status = 409; throw e; }
        if (bus.price == null) { const e = new Error(`Bus ${bus.sequence} requires a price before quotation submission`); e.status = 409; throw e; }
      }
      const latest = await tx.tripQuotation.findFirst({ where: { tripId }, select: { version: true, id: true, status: true }, orderBy: { version: "desc" } });
      if (latest && latest.status !== "superseded") await tx.tripQuotation.update({ where: { id: latest.id }, data: { status: "superseded", supersededAt: new Date() } });
      const quotation = await tx.tripQuotation.create({
        data: {
          tripId,
          version: (latest?.version || 0) + 1,
          submittedByAppUserId: actorId(access),
          lines: { create: buses.map((bus) => ({ busAssignmentId: bus.id, sequence: bus.sequence, busType: bus.busType.trim(), seatCapacity: bus.seatCapacity, price: bus.price, currency: bus.currency })) },
        },
        include: { lines: { orderBy: { sequence: "asc" } } },
      });
      await tx.trip.update({ where: { id: tripId }, data: { status: "Quotation Submitted" } });
      return quotation;
    });
    return res.status(201).json(result);
  } catch (e) { return next(e); }
});

router.post("/approve-quotation", async (req, res, next) => {
  try {
    const { prisma, access, workspace, tripId, trip } = await context(req, PERMISSIONS.TRIP_APPROVE_QUOTE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canApproveWorkspaceQuotation({ workspace, trip })) return res.status(409).json({ message: "A submitted quotation is required before approval" });
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.tripQuotation.findFirst({ where: { tripId, status: "submitted" }, orderBy: { version: "desc" } });
      if (!quotation) { const e = new Error("Submitted quotation not found"); e.status = 409; throw e; }
      const approverAppUserId = actorId(access);
      const approval = await tx.tripApprovalRequest.create({ data: { tripId, quotationId: quotation.id, status: "approved", requestedByAppUserId: approverAppUserId, approverAppUserId, decidedByAppUserId: approverAppUserId, decidedAt: new Date(), channel: "in_app" } });
      await tx.tripQuotation.update({ where: { id: quotation.id }, data: { status: "approved" } });
      await tx.trip.update({ where: { id: tripId }, data: { status: "Approved" } });
      return { quotationId: quotation.id, quotationVersion: quotation.version, approval };
    });
    return res.json(result);
  } catch (e) { return next(e); }
});

router.post("/confirm", async (req, res, next) => {
  try {
    const { prisma, workspace, tripId, trip } = await context(req, PERMISSIONS.TRIP_RESPOND);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canConfirmWorkspaceTrip({ workspace, trip })) return res.status(409).json({ message: "Trip must have an approved quotation before final confirmation" });
    const buses = await prisma.tripBusAssignment.findMany({ where: { tripId, status: { not: "cancelled" } }, select: { sequence: true, driverName: true, driverPhone: true } });
    if (!buses.length) return res.status(409).json({ message: "At least one bus assignment is required before final confirmation" });
    const incomplete = buses.find((bus) => !String(bus.driverName || "").trim() || !String(bus.driverPhone || "").trim());
    if (incomplete) return res.status(409).json({ message: `Bus ${incomplete.sequence} requires driver name and phone before final confirmation` });
    await prisma.trip.update({ where: { id: tripId }, data: { status: "Confirmed" } });
    return res.json({ tripId, status: "Confirmed" });
  } catch (e) { return next(e); }
});

export default router;
