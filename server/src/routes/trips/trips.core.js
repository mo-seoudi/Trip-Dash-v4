// server/src/routes/trips/trips.core.js
import { PrismaClient, Prisma } from "@prisma/client";
const prisma = globalThis.__prisma || new PrismaClient();
globalThis.__prisma = prisma;

// If your project already has an auth guard, replace this with it.
async function canAccessTrip(user, tripId) {
  if (!user) return false;
  if (["admin", "bus_company"].includes(user.role)) return true;
  const trip = await prisma.trip.findUnique({
    where: { id: Number(tripId) },
    select: { createdById: true },
  });
  return !!trip && trip.createdById === user.id;
}

const tripInclude = { createdByUser: true };

const coerceDate = (v) => {
  if (!v) return v;
  // accept "YYYY-MM-DD" or ISO string or Date
  if (v instanceof Date) return v;
  const str = String(v);
  try { return new Date(str); } catch { return null; }
};

export async function requestCancelTrip(req, res) {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid trip id" });

    const ok = await canAccessTrip(user, id);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const reason = (req.body?.reason ?? "").toString().trim() || null;

    const row = await prisma.trip.update({
      where: { id },
      data: {
        cancelRequested: true,
        cancelReason: reason,
        cancelRequestedAt: new Date(),
      },
      include: tripInclude,
    });

    return res.json(row);
  } catch (e) {
    console.error("[TRIPS] request-cancel error:", e);
    return res.status(500).json({ error: "Failed to request cancellation" });
  }
}

export async function requestEditTrip(req, res) {
  try {
    const user = req.user;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid trip id" });

    const ok = await canAccessTrip(user, id);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    const payload = req.body?.patch ?? req.body?.draft ?? {};

    // optional: sanitize/whitelist here if you prefer
    const row = await prisma.trip.update({
      where: { id },
      data: {
        editRequested: true,
        editRequestPayload: payload,
        editRequestedAt: new Date(),
      },
      include: tripInclude,
    });

    return res.json(row);
  } catch (e) {
    console.error("[TRIPS] request-edit error:", e);
    return res.status(500).json({ error: "Failed to request edit" });
  }
}

export async function respondCancelTrip(req, res) {
  try {
    const user = req.user;
    if (!["bus_company", "admin"].includes(user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid trip id" });

    const approve = !!req.body?.approve;

    const data = approve
      ? { status: "Canceled", cancelRequested: false, cancelHandledAt: new Date() }
      : { cancelRequested: false, cancelHandledAt: new Date() };

    const row = await prisma.trip.update({
      where: { id },
      data,
      include: tripInclude,
    });

    return res.json(row);
  } catch (e) {
    console.error("[TRIPS] respond-cancel error:", e);
    return res.status(500).json({ error: "Failed to respond cancel request" });
  }
}

export async function applyEditTrip(req, res) {
  try {
    const user = req.user;
    if (!["bus_company", "admin"].includes(user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid trip id" });

    // Prefer explicit patch; fall back to stored payload
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const patch = req.body?.patch ?? trip.editRequestPayload ?? {};

    const allowed = [
      "tripType",
      "customType",
      "destination",
      "date",
      "returnDate",
      "departureTime",
      "returnTime",
      "students",
      "notes",
      "boosterSeats",
    ];

    const data = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) {
        data[k] = (k === "date" || k === "returnDate") ? coerceDate(patch[k]) : patch[k];
      }
    }

    const row = await prisma.trip.update({
      where: { id },
      data: {
        ...data,
        editRequested: false,
        editRequestPayload: Prisma.JsonNull,
        editHandledAt: new Date(),
      },
      include: tripInclude,
    });

    return res.json(row);
  } catch (e) {
    console.error("[TRIPS] apply-edit error:", e);
    return res.status(500).json({ error: "Failed to apply edit" });
  }
}
