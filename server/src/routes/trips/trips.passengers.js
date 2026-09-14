// server/src/routes/trips/trips.passengers.js
import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  canReadPassengers,
  canManagePassengers,
} from "../../services/legacyAuthorization.js";

const router = Router();

const MAX_PASSENGERS_PER_REQUEST = 250;

function cleanOptional(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    const error = new Error(`Value exceeds maximum length of ${maxLength}`);
    error.status = 400;
    throw error;
  }
  return text;
}

function cleanRequired(value, field, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  if (text.length > maxLength) {
    const error = new Error(`${field} exceeds maximum length of ${maxLength}`);
    error.status = 400;
    throw error;
  }
  return text;
}

function normalizePassenger(input) {
  return {
    fullName: cleanRequired(input?.fullName, "fullName", 200),
    guardianName: cleanOptional(input?.guardianName, 200),
    guardianPhone: cleanOptional(input?.guardianPhone, 100),
    pickupPoint: cleanOptional(input?.pickupPoint, 500),
    dropoffPoint: cleanOptional(input?.dropoffPoint, 500),
    notes: cleanOptional(input?.notes, 2_000),
    // Check-in is an operational action and must not be spoofed during passenger creation.
    checkedIn: false,
  };
}

async function loadTrip(tripId) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      createdById: true,
      createdByEmail: true,
      status: true,
    },
  });
}

/** GET /api/trips/:id/passengers -> TripPassenger[] */
router.get("/:id/passengers", async (req, res, next) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      return res.status(400).json({ message: "Invalid trip id" });
    }

    const trip = await loadTrip(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadPassengers(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rows = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        tripId: true,
        createdAt: true,
        fullName: true,
        guardianName: true,
        guardianPhone: true,
        pickupPoint: true,
        dropoffPoint: true,
        notes: true,
        checkedIn: true,
      },
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
      return res.status(400).json({ message: "Invalid trip id" });
    }

    const trip = await loadTrip(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManagePassengers(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const list = req.body?.passengers;
    if (!Array.isArray(list) || !list.length) {
      return res.status(400).json({ message: "passengers must be a non-empty array" });
    }
    if (list.length > MAX_PASSENGERS_PER_REQUEST) {
      return res.status(400).json({
        message: `A maximum of ${MAX_PASSENGERS_PER_REQUEST} passengers may be added at once`,
      });
    }

    const passengers = list.map(normalizePassenger);

    // Use create() rather than createMany()+"last N rows". The latter can return
    // unrelated concurrent inserts and cannot reliably identify the newly-created rows.
    const created = await prisma.$transaction(
      passengers.map((passenger) =>
        prisma.tripPassenger.create({
          data: { tripId, ...passenger },
          select: {
            id: true,
            tripId: true,
            createdAt: true,
            fullName: true,
            guardianName: true,
            guardianPhone: true,
            pickupPoint: true,
            dropoffPoint: true,
            notes: true,
            checkedIn: true,
          },
        })
      )
    );

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

export default router;
