// server/src/routes/trips/trips.busAssignments.js
// First-class multi-bus resources for a single Trip.
//
// IMPORTANT: this route requires the additive TripBusAssignment schema to be
// migrated before it can be enabled in a deployed environment. It is mounted
// only after that migration is available.

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  canManageBusAssignments,
  canManagePassengerAllocations,
  canReadBusAssignments,
} from "../../services/legacyAuthorization.js";

const router = Router();
const ASSIGNMENT_STATUSES = new Set(["assigned", "confirmed", "completed", "cancelled"]);

function parsePositiveId(value, field = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return id;
}

function optionalString(value, field, max) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) {
    const error = new Error(`${field} is too long`);
    error.status = 400;
    throw error;
  }
  return text;
}

function optionalNonNegativeInt(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    const error = new Error(`${field} must be a non-negative integer`);
    error.status = 400;
    throw error;
  }
  return number;
}

function optionalMoney(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) {
    const error = new Error(`${field} must be a valid non-negative amount`);
    error.status = 400;
    throw error;
  }
  return number.toFixed(2);
}

function assignmentPatch(input, { creating = false } = {}) {
  const allowed = new Set([
    "vehicleLabel",
    "vehicleRegistration",
    "busType",
    "seatCapacity",
    "driverName",
    "driverPhone",
    "price",
    "currency",
    "status",
    "notes",
  ]);
  const unknown = Object.keys(input || {}).filter((key) => !allowed.has(key));
  if (unknown.length) {
    const error = new Error(`Unsupported bus assignment fields: ${unknown.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const patch = {};
  const stringFields = [
    ["vehicleLabel", 120],
    ["vehicleRegistration", 80],
    ["busType", 100],
    ["driverName", 160],
    ["driverPhone", 50],
    ["notes", 2000],
  ];
  for (const [field, max] of stringFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      patch[field] = optionalString(input[field], field, max);
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "seatCapacity")) {
    patch.seatCapacity = optionalNonNegativeInt(input.seatCapacity, "seatCapacity");
  }
  if (Object.prototype.hasOwnProperty.call(input, "price")) {
    patch.price = optionalMoney(input.price, "price");
  }
  if (Object.prototype.hasOwnProperty.call(input, "currency")) {
    const currency = optionalString(input.currency, "currency", 3);
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) {
      const error = new Error("currency must be a three-letter currency code");
      error.status = 400;
      throw error;
    }
    patch.currency = currency?.toUpperCase() || "AED";
  }
  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    const status = optionalString(input.status, "status", 30)?.toLowerCase();
    if (!status || !ASSIGNMENT_STATUSES.has(status)) {
      const error = new Error("Invalid bus assignment status");
      error.status = 400;
      throw error;
    }
    patch.status = status;
  }

  if (creating) {
    if (!patch.status) patch.status = "assigned";
    if (!patch.currency) patch.currency = "AED";
  }
  return patch;
}

async function loadTrip(tripId) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      createdById: true,
      createdByEmail: true,
      transportProviderOrganizationId: true,
    },
  });
}

async function requireTrip(req, res) {
  const tripId = parsePositiveId(req.params.id, "trip id");
  const trip = await loadTrip(tripId);
  if (!trip) {
    res.status(404).json({ message: "Trip not found" });
    return null;
  }
  return trip;
}

const publicAssignmentSelect = {
  id: true,
  tripId: true,
  vehicleLabel: true,
  vehicleRegistration: true,
  busType: true,
  seatCapacity: true,
  driverName: true,
  driverPhone: true,
  price: true,
  currency: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

// GET /api/trips/:id/bus-assignments
router.get("/:id/bus-assignments", async (req, res, next) => {
  try {
    const trip = await requireTrip(req, res);
    if (!trip) return;
    if (!canReadBusAssignments(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rows = await prisma.tripBusAssignment.findMany({
      where: { tripId: trip.id },
      select: publicAssignmentSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

// POST /api/trips/:id/bus-assignments
router.post("/:id/bus-assignments", async (req, res, next) => {
  try {
    const trip = await requireTrip(req, res);
    if (!trip) return;
    if (!canManageBusAssignments(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = assignmentPatch(req.body || {}, { creating: true });
    const created = await prisma.tripBusAssignment.create({
      data: {
        tripId: trip.id,
        transportProviderOrganizationId: trip.transportProviderOrganizationId,
        ...data,
      },
      select: publicAssignmentSelect,
    });
    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

// PATCH /api/trips/:id/bus-assignments/:assignmentId
router.patch("/:id/bus-assignments/:assignmentId", async (req, res, next) => {
  try {
    const trip = await requireTrip(req, res);
    if (!trip) return;
    if (!canManageBusAssignments(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const assignmentId = parsePositiveId(req.params.assignmentId, "assignment id");
    const existing = await prisma.tripBusAssignment.findFirst({
      where: { id: assignmentId, tripId: trip.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ message: "Bus assignment not found" });

    const data = assignmentPatch(req.body || {});
    if (!Object.keys(data).length) {
      return res.status(400).json({ message: "No supported fields to update" });
    }
    const updated = await prisma.tripBusAssignment.update({
      where: { id: assignmentId },
      data,
      select: publicAssignmentSelect,
    });
    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

// DELETE /api/trips/:id/bus-assignments/:assignmentId
router.delete("/:id/bus-assignments/:assignmentId", async (req, res, next) => {
  try {
    const trip = await requireTrip(req, res);
    if (!trip) return;
    if (!canManageBusAssignments(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const assignmentId = parsePositiveId(req.params.assignmentId, "assignment id");
    const result = await prisma.tripBusAssignment.deleteMany({
      where: { id: assignmentId, tripId: trip.id },
    });
    if (!result.count) return res.status(404).json({ message: "Bus assignment not found" });
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
});

// PUT /api/trips/:id/bus-assignments/:assignmentId/passengers
// Replaces the passenger allocation for one bus atomically. Passenger records
// must belong to the same trip; cross-trip IDs are rejected.
router.put("/:id/bus-assignments/:assignmentId/passengers", async (req, res, next) => {
  try {
    const trip = await requireTrip(req, res);
    if (!trip) return;
    if (!canManagePassengerAllocations(req.user, trip)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const assignmentId = parsePositiveId(req.params.assignmentId, "assignment id");
    const assignment = await prisma.tripBusAssignment.findFirst({
      where: { id: assignmentId, tripId: trip.id },
      select: { id: true, seatCapacity: true },
    });
    if (!assignment) return res.status(404).json({ message: "Bus assignment not found" });

    const rawIds = req.body?.passengerIds;
    if (!Array.isArray(rawIds)) {
      return res.status(400).json({ message: "passengerIds must be an array" });
    }
    if (rawIds.length > 500) {
      return res.status(400).json({ message: "Too many passengers in one allocation request" });
    }
    const passengerIds = [...new Set(rawIds.map((id) => parsePositiveId(id, "passenger id")))];
    if (assignment.seatCapacity != null && passengerIds.length > assignment.seatCapacity) {
      return res.status(409).json({ message: "Passenger allocation exceeds bus seat capacity" });
    }

    const matchingPassengers = passengerIds.length
      ? await prisma.tripPassenger.count({ where: { tripId: trip.id, id: { in: passengerIds } } })
      : 0;
    if (matchingPassengers !== passengerIds.length) {
      return res.status(400).json({ message: "One or more passengers do not belong to this trip" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.tripBusPassengerAllocation.deleteMany({ where: { busAssignmentId: assignment.id } });
      if (passengerIds.length) {
        await tx.tripBusPassengerAllocation.createMany({
          data: passengerIds.map((tripPassengerId) => ({
            busAssignmentId: assignment.id,
            tripPassengerId,
          })),
        });
      }
    });

    return res.json({ assignmentId: assignment.id, passengerIds });
  } catch (e) {
    return next(e);
  }
});

export default router;
