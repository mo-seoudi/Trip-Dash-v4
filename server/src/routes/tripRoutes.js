// server/src/routes/tripRoutes.js
import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Reusable, minimal include you *want* when the DB has those relations.
// We try this first; if it throws (missing FKs/tables), we fall back to no-include.
const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  // NOTE: subTripDocs intentionally omitted here; add back after the table exists.
};

/**
 * GET /api/trips?createdBy=<name>
 * Case-insensitive match; if "First Last" is sent, match on the first token too.
 */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;
    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    // Try with includes; fall back to a plain query if the include breaks
    try {
      const trips = await prisma.trip.findMany({
        where: needle
          ? { createdBy: { contains: String(needle), mode: "insensitive" } }
          : undefined,
        orderBy: { createdAt: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch (includeErr) {
      console.warn("GET /api/trips include failed; retrying without include:", includeErr.message);
      const trips = await prisma.trip.findMany({
        where: needle
          ? { createdBy: { contains: String(needle), mode: "insensitive" } }
          : undefined,
        orderBy: { createdAt: "desc" },
      });
      return res.json(trips);
    }
  } catch (e) {
    console.error("GET /api/trips failed:", e);
    next(e);
  }
});

/**
 * POST /api/trips
 * Body can include the Firestore-like fields; JSON blobs are accepted as-is.
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      createdById,
      createdBy,
      createdByEmail,
      tripType,
      destination,
      date,
      departureTime,
      returnDate,
      returnTime,
      students,
      status,
      price,
      notes,
      cancelRequest,
      busInfo,
      driverInfo,
      buses,
      parentId,
    } = req.body;

    // Create first, then (optionally) refetch with include to return richer data
    const created = await prisma.trip.create({
      data: {
        createdById: createdById ?? null,
        createdBy: createdBy ?? null,
        createdByEmail: createdByEmail ?? null,
        tripType: tripType ?? null,
        destination: destination ?? null,
        date: date ? new Date(date) : null,
        departureTime: departureTime ?? null,
        returnDate: returnDate ? new Date(returnDate) : null,
        returnTime: returnTime ?? null,
        students: typeof students === "number" ? students : students ? Number(students) : null,
        status: status ?? "Pending",
        price: typeof price === "number" ? price : price ? Number(price) : 0,
        notes: notes ?? null,
        cancelRequest: !!cancelRequest,
        busInfo: busInfo ?? null,      // JSON
        driverInfo: driverInfo ?? null, // JSON
        buses: buses ?? null,          // JSON array
        parentId: parentId ?? null,
      },
    });

    // Try to return with relations; fall back to the raw created row
    try {
      const withRels = await prisma.trip.findUnique({
        where: { id: created.id },
        include: TRIP_REL_INCLUDE,
      });
      return res.status(201).json(withRels ?? created);
    } catch {
      return res.status(201).json(created);
    }
  } catch (e) {
    console.error("POST /api/trips failed:", e);
    next(e);
  }
});

/**
 * PATCH /api/trips/:id
 * Partial updates. Converts date strings to Date.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };

    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("returnDate" in data) data.returnDate = data.returnDate ? new Date(data.returnDate) : null;

    const updated = await prisma.trip.update({
      where: { id },
      data,
    });

    // Try to return with relations; fall back to the plain row
    try {
      const withRels = await prisma.trip.findUnique({
        where: { id },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(withRels ?? updated);
    } catch {
      return res.json(updated);
    }
  } catch (e) {
    console.error("PATCH /api/trips/:id failed:", e);
    next(e);
  }
});

/** DELETE /api/trips/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.trip.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/trips/:id failed:", e);
    next(e);
  }
});

/** GET /api/trips/:id/subtrips */
router.get("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = Number(req.params.id);
    const subs = await prisma.subTrip.findMany({
      where: { parentTripId },
      orderBy: { createdAt: "asc" },
    });
    res.json(subs);
  } catch (e) {
    console.error("GET /api/trips/:id/subtrips failed:", e);
    next(e);
  }
});

/** POST /api/trips/:id/subtrips  (body: { buses?: Array }) */
router.post("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = Number(req.params.id);
    const { buses = [] } = req.body;

    if (!Array.isArray(buses) || buses.length === 0) {
      const created = await prisma.subTrip.create({
        data: { parentTripId, status: "Pending" },
      });
      return res.status(201).json([created]);
    }

    const created = await prisma.$transaction(
      buses.map((b) =>
        prisma.subTrip.create({
          data: {
            parentTripId,
            status: "Confirmed",
            busSeats: b.busSeats ?? null,
            busType: b.busType ?? null,
            tripPrice: b.tripPrice ? Number(b.tripPrice) : null,
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/trips/:id/subtrips failed:", e);
    next(e);
  }
});

/* ===========================================================================
 * PASSENGERS (backend equivalents for your client/src/services/tripService.js)
 * ===========================================================================*/

/** GET /api/trips/:id/passengers */
router.get("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const passengers = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      // include: { passenger: true }, // enable if you have a relation to directory
    });
    res.json({ passengers });
  } catch (e) {
    console.error("GET /api/trips/:id/passengers failed:", e);
    next(e);
  }
});

/** POST /api/trips/:id/passengers  { items: [...], createDirectory?: boolean } */
router.post("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    const { items = [], createDirectory = true } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    // Create TripPassenger rows
    const created = await prisma.$transaction(
      items.map((p) =>
        prisma.tripPassenger.create({
          data: {
            tripId,
            fullName: p.fullName ?? null,
            grade: p.grade ?? null,
            guardianName: p.guardianName ?? null,
            guardianPhone: p.guardianPhone ?? null,
            pickupPoint: p.pickupPoint ?? null,
            dropoffPoint: p.dropoffPoint ?? null,
            seatNumber: p.seatNumber ?? null,
            notes: p.notes ?? null,
            checkedIn: false,
            checkedOut: false,
          },
        })
      )
    );

    // Optionally mirror to a Passenger directory table (best-effort)
    if (createDirectory) {
      for (const p of items) {
        try {
          await prisma.passenger.upsert({
            // ⚠️ Replace where with your real unique constraint if you have one.
            where: { fullName: p.fullName },
            update: { grade: p.grade ?? undefined },
            create: { fullName: p.fullName, grade: p.grade ?? null },
          });
        } catch {
          // ignore if no unique constraint fits your data model
        }
      }
    }

    res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/trips/:id/passengers failed:", e);
    next(e);
  }
});

/** PATCH /api/trips/:id/passengers/:rowId */
router.patch("/:id/passengers/:rowId", async (req, res, next) => {
  try {
    const id = Number(req.params.rowId);
    const patch = { ...req.body };
    const updated = await prisma.tripPassenger.update({
      where: { id },
      data: patch,
    });
    res.json(updated);
  } catch (e) {
    console.error("PATCH /api/trips/:id/passengers/:rowId failed:", e);
    next(e);
  }
});

/** POST /api/trips/:id/passengers/:rowId/payment */
router.post("/:id/passengers/:rowId/payment", async (req, res, next) => {
  try {
    const tripPassengerId = Number(req.params.rowId);
    const {
      amountDue,
      amountPaid = 0,
      status = "unpaid",
      method = null,
      reference = null,
      currency = "USD",
    } = req.body;

    const payment = await prisma.tripPassengerPayment.create({
      data: {
        tripPassengerId,
        amountDue: Number(amountDue),
        amountPaid: Number(amountPaid),
        status,
        method,
        reference,
        currency,
      },
    });

    res.status(201).json(payment);
  } catch (e) {
    console.error("POST /api/trips/:id/passengers/:rowId/payment failed:", e);
    next(e);
  }
});

export default router;
