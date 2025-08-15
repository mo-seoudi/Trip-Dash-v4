// server/src/routes/trips/trips.core.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// Relations returned with each trip (when available)
const TRIP_REL_INCLUDE = {
  createdByUser: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true } },
  children: { select: { id: true } },
  subTripDocs: true, // keep this name to match your schema relation
};

/**
 * GET /api/trips?createdBy=Name
 * Matches createdBy case-insensitively; if "First Last" is passed, uses the first token.
 */
router.get("/", async (req, res, next) => {
  try {
    const { createdBy } = req.query;

    const needle =
      createdBy && String(createdBy).includes(" ")
        ? String(createdBy).split(" ")[0]
        : createdBy;

    // Prefer full response with relations; if that fails (e.g., schema drift), fall back gracefully.
    try {
      const trips = await prisma.trip.findMany({
        where: needle
          ? { createdBy: { contains: String(needle), mode: "insensitive" } }
          : undefined,
        orderBy: { id: "desc" },
        include: TRIP_REL_INCLUDE,
      });
      return res.json(trips);
    } catch (err) {
      console.warn("GET /api/trips include failed; falling back:", err?.message);
      const trips = await prisma.trip.findMany({
        where: needle
          ? { createdBy: { contains: String(needle), mode: "insensitive" } }
          : undefined,
        orderBy: { id: "desc" },
      });
      return res.json(trips);
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/trips
 * Accepts Firestore-like payload; JSON blobs are stored as-is.
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      createdById, createdBy, createdByEmail,
      tripType, destination, date, departureTime,
      returnDate, returnTime, students, status, price,
      notes, cancelRequest, busInfo, driverInfo, buses, parentId,
    } = req.body;

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
        driverInfo: driverInfo ?? null,// JSON
        buses: buses ?? null,          // JSON array
        parentId: parentId ?? null,
      },
    });

    // Return with relations when possible
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
    next(e);
  }
});

/**
 * PATCH /api/trips/:id
 * Partial updates. Converts date-ish strings to Date.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };

    if ("date" in data) data.date = data.date ? new Date(data.date) : null;
    if ("returnDate" in data) data.returnDate = data.returnDate ? new Date(data.returnDate) : null;

    const updated = await prisma.trip.update({ where: { id }, data });

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
    next(e);
  }
});

export default router;
