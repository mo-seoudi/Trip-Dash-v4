// Workspace-routed passenger API.
//
// Passenger data is deliberately behind its own scoped permissions. A bus
// operator may be able to read a trip and manage bus assignments without ever
// receiving access to names, guardian details, phone numbers, or pickup notes.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { canManagePassengers, canReadPassengers } from "../services/legacyAuthorization.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

const MAX_PASSENGERS_PER_REQUEST = 250;
const PASSENGER_SELECT = {
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
};

function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

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
    checkedIn: false,
  };
}

function passengerPatch(body = {}) {
  const allowed = new Set([
    "fullName", "guardianName", "guardianPhone", "pickupPoint",
    "dropoffPoint", "notes", "checkedIn",
  ]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) {
    const error = new Error(`Unsupported passenger fields: ${unknown.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const patch = {};
  if (body.fullName !== undefined) patch.fullName = cleanRequired(body.fullName, "fullName", 200);
  if (body.guardianName !== undefined) patch.guardianName = cleanOptional(body.guardianName, 200);
  if (body.guardianPhone !== undefined) patch.guardianPhone = cleanOptional(body.guardianPhone, 100);
  if (body.pickupPoint !== undefined) patch.pickupPoint = cleanOptional(body.pickupPoint, 500);
  if (body.dropoffPoint !== undefined) patch.dropoffPoint = cleanOptional(body.dropoffPoint, 500);
  if (body.notes !== undefined) patch.notes = cleanOptional(body.notes, 2_000);
  if (body.checkedIn !== undefined) {
    if (typeof body.checkedIn !== "boolean") {
      const error = new Error("checkedIn must be boolean");
      error.status = 400;
      throw error;
    }
    patch.checkedIn = body.checkedIn;
  }
  return patch;
}

async function loadSchoolTrip(prisma, schoolId, tripId) {
  return prisma.trip.findFirst({
    where: { id: tripId, owningSchoolOrganizationId: schoolId },
    select: { id: true, createdById: true, createdByEmail: true, status: true },
  });
}

async function contextAndTrip(req, permission) {
  const tripId = positiveInt(req.params.tripId, "trip id");
  const context = await operationalPrismaForWorkspace(req.user, req.params.schoolId, permission);
  const trip = await loadSchoolTrip(context.prisma, context.workspace.schoolId, tripId);
  return { ...context, tripId, trip };
}

// GET /api/workspaces/:schoolId/trips/:tripId/passengers
router.get("/", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.PASSENGER_READ);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadPassengers(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const rows = await prisma.tripPassenger.findMany({
      where: { tripId },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: PASSENGER_SELECT,
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

// POST /api/workspaces/:schoolId/trips/:tripId/passengers
router.post("/", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.PASSENGER_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManagePassengers(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const list = req.body?.passengers;
    if (!Array.isArray(list) || !list.length) {
      return res.status(400).json({ message: "passengers must be a non-empty array" });
    }
    if (list.length > MAX_PASSENGERS_PER_REQUEST) {
      return res.status(400).json({ message: `A maximum of ${MAX_PASSENGERS_PER_REQUEST} passengers may be added at once` });
    }

    const passengers = list.map(normalizePassenger);
    const created = await prisma.$transaction(
      passengers.map((passenger) => prisma.tripPassenger.create({
        data: { tripId, ...passenger },
        select: PASSENGER_SELECT,
      }))
    );
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/workspaces/:schoolId/trips/:tripId/passengers/:passengerId
router.patch("/:passengerId", async (req, res, next) => {
  try {
    const passengerId = positiveInt(req.params.passengerId, "passenger id");
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.PASSENGER_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManagePassengers(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const patch = passengerPatch(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ message: "No supported fields supplied" });

    const existing = await prisma.tripPassenger.findFirst({ where: { id: passengerId, tripId }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Passenger not found" });

    const updated = await prisma.tripPassenger.update({
      where: { id: passengerId },
      data: patch,
      select: PASSENGER_SELECT,
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/workspaces/:schoolId/trips/:tripId/passengers/:passengerId
router.delete("/:passengerId", async (req, res, next) => {
  try {
    const passengerId = positiveInt(req.params.passengerId, "passenger id");
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.PASSENGER_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManagePassengers(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const result = await prisma.tripPassenger.deleteMany({ where: { id: passengerId, tripId } });
    if (!result.count) return res.status(404).json({ message: "Passenger not found" });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default router;
