// Workspace-routed Trip API.
//
// This is the provider-neutral path for the rebuilt application. It resolves
// the requested school through effective access first, then selects exactly one
// operational PostgreSQL data source for that school. The existing /api/trips
// routes remain untouched during migration so live v4 behavior is preserved.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import {
  canCreateTrip,
  canDeleteTrip,
  canReadTrip,
  canUpdateTrip,
  creatorWhere,
} from "../services/legacyAuthorization.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nullableNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableDate(value, field) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${field} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function buildTripPatch(body = {}) {
  const supported = [
    "tripType", "destination", "origin", "date", "departureTime", "returnDate",
    "returnTime", "students", "staff", "status", "price", "notes",
    "cancelRequest", "busInfo", "driverInfo", "buses", "boosterSeatsRequested",
    "boosterSeatCount",
  ];
  const patch = {};
  for (const key of supported) {
    if (body[key] === undefined) continue;
    if (key === "date" || key === "returnDate") patch[key] = nullableDate(body[key], key);
    else if (["students", "staff"].includes(key)) patch[key] = nullableNumber(body[key]);
    else if (key === "price") patch[key] = nullableNumber(body[key], 0);
    else if (key === "boosterSeatCount") patch[key] = nullableNumber(body[key], 0);
    else if (["cancelRequest", "boosterSeatsRequested"].includes(key)) patch[key] = Boolean(body[key]);
    else patch[key] = body[key];
  }
  return patch;
}

function patchPermission(patch) {
  const fields = Object.keys(patch);
  if (fields.length && fields.every((field) => field === "price")) return PERMISSIONS.FINANCE_MANAGE_PRICE;
  if (fields.some((field) => ["status", "busInfo", "driverInfo", "buses"].includes(field))) {
    return PERMISSIONS.TRIP_RESPOND;
  }
  return PERMISSIONS.TRIP_EDIT_REQUEST;
}

function schoolTripWhere(schoolId, extra = null) {
  const base = { owningSchoolOrganizationId: schoolId };
  return extra ? { AND: [base, extra] } : base;
}

async function findSchoolTrip(prisma, schoolId, id) {
  return prisma.trip.findFirst({ where: { id, owningSchoolOrganizationId: schoolId } });
}

// GET /api/workspaces/:schoolId/trips
router.get("/", async (req, res, next) => {
  try {
    const { prisma, workspace } = await operationalPrismaForWorkspace(
      req.user,
      req.params.schoolId,
      PERMISSIONS.TRIP_READ,
    );

    const filters = [];
    const createdBy = String(req.query?.createdBy || "").trim();
    if (createdBy) {
      const needle = createdBy.includes(" ") ? createdBy.split(" ")[0] : createdBy;
      filters.push({ createdBy: { contains: needle, mode: "insensitive" } });
    }

    // Keep the legacy creator restriction during migration. The workspace/data
    // source boundary is additional protection, not a silent behavior change.
    if (req.user.role === "school_staff") filters.push(creatorWhere(req.user));

    const extra = filters.length ? { AND: filters } : null;
    const trips = await prisma.trip.findMany({
      where: schoolTripWhere(workspace.schoolId, extra),
      orderBy: { id: "desc" },
    });

    return res.json(trips.filter((trip) => canReadTrip(req.user, trip)));
  } catch (error) {
    return next(error);
  }
});

// GET /api/workspaces/:schoolId/trips/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });

    const { prisma, workspace } = await operationalPrismaForWorkspace(
      req.user,
      req.params.schoolId,
      PERMISSIONS.TRIP_READ,
    );
    const trip = await findSchoolTrip(prisma, workspace.schoolId, id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (!canReadTrip(req.user, trip)) return res.status(403).json({ message: "Forbidden" });
    return res.json(trip);
  } catch (error) {
    return next(error);
  }
});

// POST /api/workspaces/:schoolId/trips
router.post("/", async (req, res, next) => {
  try {
    if (!canCreateTrip(req.user)) return res.status(403).json({ message: "Forbidden" });

    const { prisma, access, workspace } = await operationalPrismaForWorkspace(
      req.user,
      req.params.schoolId,
      PERMISSIONS.TRIP_CREATE,
    );
    const body = req.body || {};

    const created = await prisma.trip.create({
      data: {
        createdByAppUserId: access.user?.appUserId || null,
        tenantId: access.tenantId || null,
        owningSchoolOrganizationId: workspace.schoolId,
        managingOrganizationId: null,
        transportProviderOrganizationId: null,
        createdById: Number.isInteger(Number(req.user.id)) ? Number(req.user.id) : null,
        createdBy: req.user.name ?? null,
        createdByEmail: req.user.email ?? null,
        tripType: body.tripType ?? null,
        destination: body.destination ?? null,
        origin: body.origin ?? null,
        date: nullableDate(body.date, "date"),
        departureTime: body.departureTime ?? null,
        returnDate: nullableDate(body.returnDate, "returnDate"),
        returnTime: body.returnTime ?? null,
        students: nullableNumber(body.students),
        staff: nullableNumber(body.staff),
        status: "Pending",
        price: 0,
        notes: body.notes ?? null,
        cancelRequest: false,
        busInfo: null,
        driverInfo: null,
        buses: null,
        parentId: null,
        boosterSeatsRequested: Boolean(body.boosterSeatsRequested),
        boosterSeatCount: nullableNumber(body.boosterSeatCount, 0),
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/workspaces/:schoolId/trips/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });
    const patch = buildTripPatch(req.body || {});
    if (!Object.keys(patch).length) return res.status(400).json({ message: "No supported fields supplied" });

    const { prisma, workspace } = await operationalPrismaForWorkspace(
      req.user,
      req.params.schoolId,
      patchPermission(patch),
    );
    const existing = await findSchoolTrip(prisma, workspace.schoolId, id);
    if (!existing) return res.status(404).json({ message: "Trip not found" });
    if (!canUpdateTrip(req.user, existing, patch)) return res.status(403).json({ message: "Forbidden" });

    const updated = await prisma.trip.update({ where: { id }, data: patch });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/workspaces/:schoolId/trips/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid trip id" });

    const { prisma, workspace } = await operationalPrismaForWorkspace(
      req.user,
      req.params.schoolId,
      PERMISSIONS.TRIP_DELETE,
    );
    const existing = await findSchoolTrip(prisma, workspace.schoolId, id);
    if (!existing) return res.status(404).json({ message: "Trip not found" });
    if (!canDeleteTrip(req.user, existing)) return res.status(403).json({ message: "Forbidden" });

    await prisma.trip.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
