// server/src/routes/trips/trips.passengers.js
import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// Temporary legacy resource check. Authentication is guaranteed by the parent
// trip router. This will be replaced by the centralized authorization service.
async function canAccessTrip(user, tripId) {
  if (!user?.id) return false;
  if (user.role === "admin") return true;

  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { createdById: true, createdByEmail: true },
  });
  if (!trip) return false;

  if (trip.createdById && Number(trip.createdById) === Number(user.id)) return true;
  return !!(user.email && trip.createdByEmail && user.email === trip.createdByEmail);
}

/** GET /api/trips/:id/passengers -> TripPassenger[] */
router.get("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ error: "Invalid trip id" });
    }

    const ok = await canAccessTrip(req.user, tripId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const rows = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { id: "desc" },
    });

    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

/** POST /api/trips/:id/passengers */
router.post("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ error: "Invalid trip id" });
    }

    const ok = await canAccessTrip(req.user, tripId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const list = Array.isArray(req.body?.passengers) ? req.body.passengers : [];
    if (!list.length) return res.status(400).json({ error: "No passengers provided" });

    const toCreate = list
      .map((p) => ({
        tripId,
        fullName: String(p.fullName || "").trim(),
        guardianName: p.guardianName ? String(p.guardianName).trim() : null,
        guardianPhone: p.guardianPhone ? String(p.guardianPhone).trim() : null,
        pickupPoint: p.pickupPoint ? String(p.pickupPoint).trim() : null,
        dropoffPoint: p.dropoffPoint ? String(p.dropoffPoint).trim() : null,
        notes: p.notes ? String(p.notes).trim() : null,
        checkedIn: !!p.checkedIn,
      }))
      .filter((p) => p.fullName);

    if (!toCreate.length) return res.status(400).json({ error: "Invalid passenger names" });

    await prisma.tripPassenger.createMany({ data: toCreate });

    const created = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { id: "desc" },
      take: toCreate.length,
    });

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

export default router;
