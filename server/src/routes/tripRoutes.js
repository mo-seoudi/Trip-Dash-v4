// server/src/routes/tripRoutes.js
import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/trips?createdBy=<name>
 * Note: createdBy is matched case-insensitively. If your UI passes "Joe Smith"
 * but your data says "Joseph Smith", you can pass ?createdBy=Joe or see the
 * "needle" logic below to loosen the match.
 */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    // Loosen matching a bit: if "First Last", use the first token (e.g., "Joe")
    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    const trips = await prisma.trip.findMany({
      where: needle
        ? { createdBy: { contains: String(needle), mode: "insensitive" } }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        // Only relations go here
        createdByUser: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true } },
        children: { select: { id: true } },
        subTripDocs: true,
      },
    });

    res.json(trips);
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

    const trip = await prisma.trip.create({
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
        students: students ?? null,
        status: status ?? null,
        price: typeof price === "number" ? price : price ? Number(price) : null,
        notes: notes ?? null,
        cancelRequest: !!cancelRequest,
        busInfo: busInfo ?? null,     // JSON
        driverInfo: driverInfo ?? null, // JSON
        buses: buses ?? null,         // JSON array
        parentId: parentId ?? null,
      },
      include: {
        createdByUser: { select: { id: true, name: true, email: true} },
        parent: { select: { id: true } },
        children: { select: { id: true } },
        subTripDocs: true,
      },
    });

    res.status(201).json(trip);
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

    const trip = await prisma.trip.update({
      where: { id },
      data,
      include: {
        createdByUser: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true } },
        children: { select: { id: true } },
        subTripDocs: true,
      },
    });

    res.json(trip);
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

export default router;
