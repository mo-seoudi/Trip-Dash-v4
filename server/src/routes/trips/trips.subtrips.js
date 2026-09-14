// server/src/routes/trips/trips.subtrips.js

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { canManageSubTrips, canReadSubTrips } from "../../services/legacyAuthorization.js";

const router = Router();

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOptionalNonNegativeNumber(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a non-negative number`);
    error.status = 400;
    throw error;
  }
  return number;
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

// POST /api/trips/:id/subtrips
router.post("/:id/subtrips", async (req, res, next) => {
  try {
    const parentTripId = parsePositiveId(req.params.id);
    if (!parentTripId) return res.status(400).json({ message: "Invalid trip id" });

    const trip = await loadParentTrip(parentTripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManageSubTrips(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const buses = req.body?.buses;
    if (buses !== undefined && !Array.isArray(buses)) {
      return res.status(400).json({ message: "buses must be an array" });
    }

    if (!buses?.length) {
      const created = await prisma.subTrip.create({
        data: { parentTripId, status: "Pending" },
      });
      return res.status(201).json([created]);
    }

    if (buses.length > 100) {
      return res.status(400).json({ message: "Too many buses in one request" });
    }

    const normalized = buses.map((bus, index) => {
      if (!bus || typeof bus !== "object" || Array.isArray(bus)) {
        const error = new Error(`buses[${index}] must be an object`);
        error.status = 400;
        throw error;
      }

      return {
        parentTripId,
        status: "Confirmed",
        busSeats: parseOptionalNonNegativeNumber(bus.busSeats, `buses[${index}].busSeats`),
        busType: bus.busType ? String(bus.busType).trim().slice(0, 100) : null,
        tripPrice: parseOptionalNonNegativeNumber(bus.tripPrice, `buses[${index}].tripPrice`),
      };
    });

    const created = await prisma.$transaction(
      normalized.map((data) => prisma.subTrip.create({ data }))
    );

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

export default router;
