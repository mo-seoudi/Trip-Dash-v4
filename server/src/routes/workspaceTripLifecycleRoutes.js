// Explicit post-approval Trip lifecycle actions.
// Cancellation requests are represented by cancelRequest while the canonical
// trip status remains unchanged. This means declining a request naturally
// restores the exact lifecycle stage it came from instead of guessing it.
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer`), { status: 400 });
  }
  return parsed;
}

async function context(req, permission) {
  const tripId = positiveInt(req.params.tripId, "trip id");
  const operational = await operationalPrismaForWorkspace(
    req.user,
    req.params.schoolId,
    permission,
  );
  const trip = await operational.prisma.trip.findFirst({
    where: { id: tripId, owningSchoolOrganizationId: operational.workspace.schoolId },
  });
  return { ...operational, tripId, trip };
}

router.post("/complete", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await context(req, PERMISSIONS.TRIP_RESPOND);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (trip.cancelRequest) return res.status(409).json({ message: "Resolve the cancellation request before completing this trip" });
    if (trip.status !== "Confirmed") return res.status(409).json({ message: "Only a Confirmed trip can be completed" });

    const changed = await prisma.trip.updateMany({
      where: { id: tripId, status: "Confirmed", cancelRequest: { not: true } },
      data: { status: "Completed" },
    });
    if (changed.count !== 1) return res.status(409).json({ message: "Trip changed before completion" });
    return res.json(await prisma.trip.findUnique({ where: { id: tripId } }));
  } catch (error) { return next(error); }
});

router.post("/request-cancel", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await context(req, PERMISSIONS.TRIP_EDIT_REQUEST);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    const allowed = ["Accepted", "Quotation Submitted", "Approved", "Confirmed"];
    if (!allowed.includes(trip.status)) return res.status(409).json({ message: "Cancellation cannot be requested at this trip stage" });
    if (trip.cancelRequest) return res.status(409).json({ message: "A cancellation request is already pending" });

    const changed = await prisma.trip.updateMany({
      where: { id: tripId, status: trip.status, cancelRequest: { not: true } },
      data: { cancelRequest: true },
    });
    if (changed.count !== 1) return res.status(409).json({ message: "Trip changed before the cancellation request was recorded" });
    return res.json(await prisma.trip.findUnique({ where: { id: tripId } }));
  } catch (error) { return next(error); }
});

router.post("/resolve-cancel", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await context(req, PERMISSIONS.TRIP_RESPOND);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!trip.cancelRequest) return res.status(409).json({ message: "This trip has no pending cancellation request" });
    if (typeof req.body?.approve !== "boolean") return res.status(400).json({ message: "approve must be true or false" });

    const data = req.body.approve
      ? { status: "Canceled", cancelRequest: false }
      : { cancelRequest: false };
    const changed = await prisma.trip.updateMany({
      where: { id: tripId, status: trip.status, cancelRequest: true },
      data,
    });
    if (changed.count !== 1) return res.status(409).json({ message: "Trip changed before the cancellation request was resolved" });
    return res.json(await prisma.trip.findUnique({ where: { id: tripId } }));
  } catch (error) { return next(error); }
});

router.post("/cancel", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await context(req, PERMISSIONS.TRIP_EDIT_REQUEST);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (trip.status !== "Pending") return res.status(409).json({ message: "Only a Pending trip can be cancelled directly; request cancellation after it has been accepted" });

    const changed = await prisma.trip.updateMany({
      where: { id: tripId, status: "Pending" },
      data: { status: "Canceled", cancelRequest: false },
    });
    if (changed.count !== 1) return res.status(409).json({ message: "Trip changed before cancellation" });
    return res.json(await prisma.trip.findUnique({ where: { id: tripId } }));
  } catch (error) { return next(error); }
});

export default router;
