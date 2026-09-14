// server/src/routes/trips/trips.core.js
import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  canCreateTrip,
  canDeleteTrip,
  canReadTrip,
  canUpdateTrip,
  creatorWhere,
} from "../../services/legacyAuthorization.js";

const router = Router();

const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true,
};

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseNullableNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildTripPatch(body = {}) {
  const {
    tripType,
    destination,
    origin,
    date,
    departureTime,
    returnDate,
    returnTime,
    students,
    staff,
    status,
    price,
    notes,
    cancelRequest,
    busInfo,
    driverInfo,
    buses,
    boosterSeatsRequested,
    boosterSeatCount,
  } = body;

  return {
    ...(tripType !== undefined && { tripType }),
    ...(destination !== undefined && { destination }),
    ...(origin !== undefined && { origin }),
    ...(date !== undefined && { date: date ? new Date(date) : null }),
    ...(departureTime !== undefined && { departureTime }),
    ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
    ...(returnTime !== undefined && { returnTime }),
    ...(students !== undefined && { students: parseNullableNumber(students) }),
    ...(staff !== undefined && { staff: parseNullableNumber(staff) }),
    ...(status !== undefined && { status }),
    ...(price !== undefined && { price: parseNullableNumber(price, 0) }),
    ...(notes !== undefined && { notes }),
    ...(cancelRequest !== undefined && { cancelRequest: Boolean(cancelRequest) }),
    ...(busInfo !== undefined && { busInfo }),
    ...(driverInfo !== undefined && { driverInfo }),
    ...(buses !== undefined && { buses }),
    ...(boosterSeatsRequested !== undefined && { boosterSeatsRequested: Boolean(boosterSeatsRequested) }),
    ...(boosterSeatCount !== undefined && { boosterSeatCount: parseNullableNumber(boosterSeatCount, 0) }),
  };
}

async function findTrip(id, include = false) {
  return prisma.trip.findUnique({
    where: { id },
    ...(include ? { include: TRIP_REL_INCLUDE } : {}),
  });
}

/** GET /api/trips */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;
    const nameNeedle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const filters = [];
    if (nameNeedle) {
      filters.push({ createdBy: { contains: String(nameNeedle), mode: "insensitive" } });
    }

    // Preserve legacy school-staff visibility while preventing unauthenticated
    // or unknown-role users from enumerating trips.
    if (req.user.role === "school_staff") {
      filters.push(creatorWhere(req.user));
    } else if (!["admin", "bus_operator", "finance", "trip_manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = filters.length ? { AND: filters } : undefined;
    const trips = await prisma.trip.findMany({
      where,
      orderBy: { id: "desc" },
      include: TRIP_REL_INCLUDE,
    });

    return res.json(trips.filter((trip) => canReadTrip(req.user, trip)));
  } catch (e) {
    return next(e);
  }
});

/** GET /api/trips/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });

    const trip = await findTrip(id, true);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadTrip(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    return res.json(trip);
  } catch (e) {
    return next(e);
  }
});

/** POST /api/trips */
router.post("/", async (req, res, next) => {
  try {
    if (!canCreateTrip(req.user)) return res.status(403).json({ message: "Forbidden" });

    const body = req.body || {};
    const data = {
      // Creator identity is server-owned. Never trust client-supplied creator ids/emails.
      createdById: req.user.id,
      createdBy: req.user.name ?? null,
      createdByEmail: req.user.email ?? null,
      tripType: body.tripType ?? null,
      destination: body.destination ?? null,
      origin: body.origin ?? null,
      date: body.date ? new Date(body.date) : null,
      departureTime: body.departureTime ?? null,
      returnDate: body.returnDate ? new Date(body.returnDate) : null,
      returnTime: body.returnTime ?? null,
      students: parseNullableNumber(body.students),
      staff: parseNullableNumber(body.staff),
      status: "Pending",
      price: 0,
      notes: body.notes ?? null,
      cancelRequest: false,
      busInfo: null,
      driverInfo: null,
      buses: null,
      parentId: null,
      boosterSeatsRequested: Boolean(body.boosterSeatsRequested),
      boosterSeatCount: parseNullableNumber(body.boosterSeatCount, 0),
    };

    const created = await prisma.trip.create({ data });
    const withRels = await findTrip(created.id, true);
    return res.status(201).json(withRels ?? created);
  } catch (e) {
    return next(e);
  }
});

/** PATCH /api/trips/:id */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });

    const existing = await findTrip(id);
    if (!existing) return res.status(404).json({ message: "Trip not found" });

    const patch = buildTripPatch(req.body);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "No supported fields supplied" });
    }
    if (!canUpdateTrip(req.user, existing, patch)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.trip.update({ where: { id }, data: patch });
    const withRels = await findTrip(id, true);
    return res.json(withRels);
  } catch (e) {
    return next(e);
  }
});

/** DELETE /api/trips/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });

    const existing = await findTrip(id);
    if (!existing) return res.status(404).json({ message: "Trip not found" });
    if (!canDeleteTrip(req.user, existing)) return res.status(403).json({ message: "Forbidden" });

    await prisma.trip.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
