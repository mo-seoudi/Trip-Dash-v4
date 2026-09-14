// server/src/routes/trips/trips.subtrips.js
//
// LEGACY READ-ONLY COMPATIBILITY ROUTE.
// SubTrip was an early representation where each bus could become a child trip.
// That domain concept has been retired. A trip now remains one Trip and may have
// multiple TripBusAssignment records. Historical rows are exposed temporarily
// so old data can be inspected/migrated, but this API must never create new rows.

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { canReadSubTrips } from "../../services/legacyAuthorization.js";

const router = Router();

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadParentTrip(parentTripId) {
  return prisma.trip.findUnique({
    where: { id: parentTripId },
    select: {
      id: true,
      status: true,
      createdById: true,
      createdByEmail: true,
    },
  });
}

// GET /api/trips/:id/subtrips
// Temporary historical-data compatibility only. Remove after migration.
router.get("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = parsePositiveId(req.params.id);
    if (!parentTripId) return res.status(400).json({ message: "Invalid trip id" });

    const trip = await loadParentTrip(parentTripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadSubTrips(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const subs = await prisma.subTrip.findMany({
      where: { parentTripId },
      orderBy: { createdAt: "asc" },
    });
    return res.json(subs);
  } catch (e) {
    return next(e);
  }
});

// Explicitly fail old clients instead of silently recreating obsolete data.
router.post("/:id/subtrips", (req, res) => {
  return res.status(410).json({
    message: "SubTrips are retired. Use bus assignments for multiple buses on a trip.",
    code: "SUBTRIPS_RETIRED",
  });
});

export default router;
