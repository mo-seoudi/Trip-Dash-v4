// Workspace-routed first-class bus assignments.
// A Trip remains one Trip even when several buses are required.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import {
  canManageBusAssignments,
  canManagePassengerAllocations,
  canReadBusAssignments,
} from "../services/legacyAuthorization.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

const STATUSES = new Set(["assigned", "confirmed", "completed", "cancelled"]);
const BASE_SELECT = {
  id: true, tripId: true, sequence: true, busType: true, seatCapacity: true,
  vehicleNumber: true, plateNumber: true, driverName: true, driverPhone: true,
  price: true, currency: true, status: true, notes: true, createdAt: true, updatedAt: true,
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

function uuid(value, field) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    const error = new Error(`${field} must be a valid UUID`);
    error.status = 400;
    throw error;
  }
  return text;
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

function patch(input = {}, creating = false) {
  const allowed = new Set(["sequence", "busType", "seatCapacity", "vehicleNumber", "plateNumber", "driverName", "driverPhone", "price", "currency", "status", "notes"]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) {
    const error = new Error(`Unsupported bus assignment fields: ${unknown.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const data = {};
  for (const [field, max] of [["busType",100],["vehicleNumber",120],["plateNumber",80],["driverName",160],["driverPhone",50],["notes",2000]]) {
    if (input[field] !== undefined) data[field] = optionalString(input[field], field, max);
  }
  if (input.sequence !== undefined) data.sequence = positiveInt(input.sequence, "sequence");
  if (input.seatCapacity !== undefined) {
    const n = Number(input.seatCapacity);
    if (!Number.isInteger(n) || n < 0) { const e = new Error("seatCapacity must be a non-negative integer"); e.status = 400; throw e; }
    data.seatCapacity = n;
  }
  if (input.price !== undefined) {
    const n = Number(input.price);
    if (!Number.isFinite(n) || n < 0 || n > 9999999999.99) { const e = new Error("price must be a valid non-negative amount"); e.status = 400; throw e; }
    data.price = n.toFixed(2);
  }
  if (input.currency !== undefined) {
    const currency = optionalString(input.currency, "currency", 3);
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) { const e = new Error("currency must be a three-letter currency code"); e.status = 400; throw e; }
    data.currency = currency?.toUpperCase() || "AED";
  }
  if (input.status !== undefined) {
    const status = optionalString(input.status, "status", 30)?.toLowerCase();
    if (!status || !STATUSES.has(status)) { const e = new Error("Invalid bus assignment status"); e.status = 400; throw e; }
    data.status = status;
  }
  if (creating) {
    if (!data.status) data.status = "assigned";
    if (!data.currency) data.currency = "AED";
  }
  return data;
}

async function contextAndTrip(req, permission) {
  const tripId = positiveInt(req.params.tripId, "trip id");
  const context = await operationalPrismaForWorkspace(req.user, req.params.schoolId, permission);
  const trip = await context.prisma.trip.findFirst({
    where: { id: tripId, owningSchoolOrganizationId: context.workspace.schoolId },
    select: { id: true, status: true, createdById: true, createdByEmail: true },
  });
  return { ...context, tripId, trip };
}

function selectForUser(user) {
  // Finance needs price; bus operators need driver/vehicle details. Ordinary
  // school readers do not receive driver phone or price merely from trip.read.
  if (["admin", "bus_operator"].includes(user.role)) return BASE_SELECT;
  if (user.role === "finance") return { ...BASE_SELECT, driverPhone: false, driverName: false, notes: false };
  return { ...BASE_SELECT, driverPhone: false, price: false };
}

router.get("/", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.BUS_ASSIGNMENT_READ);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadBusAssignments(req.user, trip)) return res.status(403).json({ message: "Forbidden" });
    const rows = await prisma.tripBusAssignment.findMany({ where: { tripId }, select: selectForUser(req.user), orderBy: [{ sequence: "asc" }, { createdAt: "asc" }] });
    return res.json(rows);
  } catch (error) { return next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManageBusAssignments(req.user, trip)) return res.status(403).json({ message: "Forbidden" });
    const data = patch(req.body || {}, true);

    const created = await prisma.$transaction(async (tx) => {
      if (!data.sequence) {
        const last = await tx.tripBusAssignment.findFirst({ where: { tripId }, select: { sequence: true }, orderBy: { sequence: "desc" } });
        data.sequence = (last?.sequence || 0) + 1;
      }
      return tx.tripBusAssignment.create({ data: { tripId, ...data }, select: BASE_SELECT });
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Bus assignment sequence already exists; retry the request" });
    return next(error);
  }
});

router.patch("/:assignmentId", async (req, res, next) => {
  try {
    const assignmentId = uuid(req.params.assignmentId, "assignment id");
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManageBusAssignments(req.user, trip)) return res.status(403).json({ message: "Forbidden" });
    const data = patch(req.body || {});
    if (!Object.keys(data).length) return res.status(400).json({ message: "No supported fields to update" });
    const existing = await prisma.tripBusAssignment.findFirst({ where: { id: assignmentId, tripId }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Bus assignment not found" });
    const updated = await prisma.tripBusAssignment.update({ where: { id: assignmentId }, data, select: BASE_SELECT });
    return res.json(updated);
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "Bus assignment sequence already exists" });
    return next(error);
  }
});

router.delete("/:assignmentId", async (req, res, next) => {
  try {
    const assignmentId = uuid(req.params.assignmentId, "assignment id");
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManageBusAssignments(req.user, trip)) return res.status(403).json({ message: "Forbidden" });
    const result = await prisma.tripBusAssignment.deleteMany({ where: { id: assignmentId, tripId } });
    if (!result.count) return res.status(404).json({ message: "Bus assignment not found" });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.put("/:assignmentId/passengers", async (req, res, next) => {
  try {
    const assignmentId = uuid(req.params.assignmentId, "assignment id");
    const { prisma, tripId, trip } = await contextAndTrip(req, PERMISSIONS.PASSENGER_ALLOCATE);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canManagePassengerAllocations(req.user, trip)) return res.status(403).json({ message: "Forbidden" });

    const rawIds = req.body?.passengerIds;
    if (!Array.isArray(rawIds)) return res.status(400).json({ message: "passengerIds must be an array" });
    if (rawIds.length > 500) return res.status(400).json({ message: "Too many passengers in one allocation request" });
    const passengerIds = [...new Set(rawIds.map((id) => positiveInt(id, "passenger id")))];

    await prisma.$transaction(async (tx) => {
      const assignment = await tx.tripBusAssignment.findFirst({ where: { id: assignmentId, tripId }, select: { id: true, seatCapacity: true } });
      if (!assignment) { const e = new Error("Bus assignment not found"); e.status = 404; throw e; }
      if (assignment.seatCapacity != null && passengerIds.length > assignment.seatCapacity) { const e = new Error("Passenger allocation exceeds bus seat capacity"); e.status = 409; throw e; }

      const count = passengerIds.length ? await tx.tripPassenger.count({ where: { tripId, id: { in: passengerIds } } }) : 0;
      if (count !== passengerIds.length) { const e = new Error("One or more passengers do not belong to this trip"); e.status = 400; throw e; }

      // Keep the friendly application check, while the operational schema also
      // enforces one bus per passenger per trip at the database level.
      const duplicate = passengerIds.length ? await tx.tripBusPassengerAllocation.findFirst({
        where: { tripPassengerId: { in: passengerIds }, tripId, busAssignmentId: { not: assignmentId } },
        select: { tripPassengerId: true },
      }) : null;
      if (duplicate) { const e = new Error(`Passenger ${duplicate.tripPassengerId} is already allocated to another bus on this trip`); e.status = 409; throw e; }

      await tx.tripBusPassengerAllocation.deleteMany({ where: { busAssignmentId: assignmentId, tripId } });
      if (passengerIds.length) {
        await tx.tripBusPassengerAllocation.createMany({
          data: passengerIds.map((tripPassengerId) => ({ busAssignmentId: assignmentId, tripPassengerId, tripId })),
        });
      }
    });

    return res.json({ assignmentId, passengerIds });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ message: "One or more passengers are already allocated to another bus on this trip" });
    return next(error);
  }
});

export default router;
