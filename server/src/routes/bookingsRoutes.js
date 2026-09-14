// server/src/routes/bookingsRoutes.js
import express from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  canCreateBooking,
  canDeleteBooking,
  canReadBooking,
  canUpdateBooking,
  creatorWhere,
} from "../services/legacyAuthorization.js";

const router = express.Router();
router.use(requireAuth);

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function numberOr(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildBookingPatch(body = {}) {
  const {
    title,
    purpose,
    date,
    startTime,
    endDate,
    endTime,
    durationMinutes,
    students,
    adults,
    pickupPoints,
    dropoffPoints,
    busesRequested,
    busType,
    notes,
    status,
  } = body;

  const patch = {
    ...(title !== undefined && { title }),
    ...(purpose !== undefined && { purpose }),
    ...(date !== undefined && { date: date ? new Date(date) : null }),
    ...(startTime !== undefined && { startTime }),
    ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    ...(endTime !== undefined && { endTime }),
    ...(durationMinutes !== undefined && { durationMinutes: numberOr(durationMinutes, null) }),
    ...(students !== undefined && { students: numberOr(students, 0) }),
    ...(adults !== undefined && { adults: numberOr(adults, 0) }),
    ...(pickupPoints !== undefined && { pickupPoints: Array.isArray(pickupPoints) ? pickupPoints : null }),
    ...(dropoffPoints !== undefined && { dropoffPoints: Array.isArray(dropoffPoints) ? dropoffPoints : null }),
    ...(busesRequested !== undefined && { busesRequested: numberOr(busesRequested, null) }),
    ...(busType !== undefined && { busType }),
    ...(notes !== undefined && { notes }),
    ...(status !== undefined && { status }),
  };

  return patch;
}

async function getBooking(id) {
  return prisma.busBooking.findUnique({ where: { id } });
}

/** GET /api/bookings */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;
    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const filters = [];
    if (needle) filters.push({ createdBy: { contains: String(needle), mode: "insensitive" } });

    if (req.user.role === "school_staff") {
      filters.push(creatorWhere(req.user));
    } else if (!["admin", "trip_manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rows = await prisma.busBooking.findMany({
      where: filters.length ? { AND: filters } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return res.json(rows.filter((booking) => canReadBooking(req.user, booking)));
  } catch (e) {
    return next(e);
  }
});

/** GET /api/bookings/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid booking id" });

    const booking = await getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!canReadBooking(req.user, booking)) return res.status(403).json({ message: "Forbidden" });

    return res.json(booking);
  } catch (e) {
    return next(e);
  }
});

/** POST /api/bookings */
router.post("/", async (req, res, next) => {
  try {
    if (!canCreateBooking(req.user)) return res.status(403).json({ message: "Forbidden" });

    const body = req.body || {};
    const students = numberOr(body.students, 0);
    const adults = numberOr(body.adults, 0);

    const created = await prisma.busBooking.create({
      data: {
        title: body.title ?? null,
        purpose: body.purpose ?? null,
        date: body.date ? new Date(body.date) : null,
        startTime: body.startTime ?? null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        endTime: body.endTime ?? null,
        durationMinutes: numberOr(body.durationMinutes, null),
        students,
        adults,
        totalPassengers: students + adults,
        pickupPoints: Array.isArray(body.pickupPoints) ? body.pickupPoints : null,
        dropoffPoints: Array.isArray(body.dropoffPoints) ? body.dropoffPoints : null,
        busesRequested: numberOr(body.busesRequested, null),
        busType: body.busType ?? null,
        notes: body.notes ?? null,
        // Creator identity is authoritative server context, not request data.
        createdBy: req.user.name ?? null,
        createdByEmail: req.user.email ?? null,
        createdById: req.user.id,
        orgId: null,
        status: "Requested",
      },
    });

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

/** PATCH /api/bookings/:id */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid booking id" });

    const existing = await getBooking(id);
    if (!existing) return res.status(404).json({ message: "Booking not found" });
    if (!canUpdateBooking(req.user, existing)) return res.status(403).json({ message: "Forbidden" });

    const patch = buildBookingPatch(req.body);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "No supported fields supplied" });
    }

    if ("students" in patch || "adults" in patch) {
      const students = "students" in patch ? patch.students : existing.students ?? 0;
      const adults = "adults" in patch ? patch.adults : existing.adults ?? 0;
      patch.totalPassengers = students + adults;
    }

    const updated = await prisma.busBooking.update({ where: { id }, data: patch });
    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

/** DELETE /api/bookings/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid booking id" });

    const existing = await getBooking(id);
    if (!existing) return res.status(404).json({ message: "Booking not found" });
    if (!canDeleteBooking(req.user, existing)) return res.status(403).json({ message: "Forbidden" });

    await prisma.busBooking.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
