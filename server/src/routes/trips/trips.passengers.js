// server/src/routes/trips/trips.passengers.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/** Decode JWT from Authorization: Bearer ... or cookie "token" */
function getDecodedUser(req) {
  try {
    const bearer = req.headers.authorization || "";
    const token = bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : req.cookies?.token;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Basic access check: creator of the trip (or admin) */
async function canAccessTrip(user, tripId) {
  if (!user?.id) return false;
  if (user?.role === "admin") return true;

  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { id: true, createdById: true, createdByEmail: true },
  });
  if (!trip) return false;

  if (trip.createdById && Number(trip.createdById) === Number(user.id)) return true;

  const me = await prisma.user.findUnique({
    where: { id: Number(user.id) },
    select: { email: true },
  });
  if (me?.email && trip.createdByEmail && me.email === trip.createdByEmail) return true;

  return false;
}

/** GET /api/trips/:id/passengers */
router.get("/:id/passengers", async (req, res) => {
  try {
    const decoded = getDecodedUser(req);
    const tripId = Number(req.params.id);
    if (!tripId) return res.status(400).json({ error: "Invalid trip id" });

    const ok = await canAccessTrip(decoded, tripId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const rows = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { id: "desc" },
    });

    // Return as a plain array (what the client expects)
    res.json(
      rows.map((r) => ({
        id: r.id,
        tripId: r.tripId,
        fullName: r.fullName ?? "",
        guardianName: r.guardianName ?? null,
        guardianPhone: r.guardianPhone ?? null,
        pickupPoint: r.pickupPoint ?? null,
        dropoffPoint: r.dropoffPoint ?? null,
        notes: r.notes ?? null,
        checkedIn: !!r.checkedIn,
        createdAt: r.createdAt ?? null,
      }))
    );
  } catch (e) {
    console.error("[PASSENGERS] GET error:", e);
    res.status(500).json({ error: "Failed to load passengers" });
  }
});

/** POST /api/trips/:id/passengers
 * body: { passengers: [{ fullName, guardianName?, guardianPhone?, pickupPoint?, dropoffPoint?, notes?, checkedIn? }] }
 */
router.post("/:id/passengers", async (req, res) => {
  try {
    const decoded = getDecodedUser(req);
    const tripId = Number(req.params.id);
    if (!tripId) return res.status(400).json({ error: "Invalid trip id" });

    const ok = await canAccessTrip(decoded, tripId);
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
        // IMPORTANT: do not include non-existent columns here
        // seatNumber, grade, payments, etc., are handled elsewhere if you add them later
      }))
      .filter((p) => p.fullName);

    if (!toCreate.length) return res.status(400).json({ error: "Invalid passenger names" });

    await prisma.tripPassenger.createMany({ data: toCreate });

    const created = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { id: "desc" },
      take: toCreate.length,
    });

    res.status(201).json(
      created.map((r) => ({
        id: r.id,
        tripId: r.tripId,
        fullName: r.fullName ?? "",
        guardianName: r.guardianName ?? null,
        guardianPhone: r.guardianPhone ?? null,
        pickupPoint: r.pickupPoint ?? null,
        dropoffPoint: r.dropoffPoint ?? null,
        notes: r.notes ?? null,
        checkedIn: !!r.checkedIn,
        createdAt: r.createdAt ?? null,
      }))
    );
  } catch (e) {
    console.error("[PASSENGERS] POST error:", e);
    res.status(500).json({ error: "Failed to add passengers" });
  }
});

export default router;

