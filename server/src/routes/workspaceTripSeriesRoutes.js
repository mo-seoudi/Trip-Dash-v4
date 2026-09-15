// Dedicated recurring-trip creation path. A TripSeries owns the recurrence
// definition and generates ordinary Trip rows for each occurrence.
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PERMISSIONS } from "../services/accessCatalog.js";
import { operationalPrismaForWorkspace } from "../services/workspaceOperationalContext.js";
import { canCreateWorkspaceTrip, canReadWorkspaceTrip } from "../services/workspaceAuthorization.js";
import { generateOccurrenceDates } from "../services/tripRecurrence.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function nullableNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) { const error = new Error("Passenger counts must be non-negative whole numbers"); error.status = 400; throw error; }
  return parsed;
}

function seriesReadAllowed(access, workspace, series) {
  return canReadWorkspaceTrip({ access, workspace, trip: { createdByAppUserId: series.createdByAppUserId } });
}

router.get("/", async (req, res, next) => {
  try {
    const { prisma, access, workspace } = await operationalPrismaForWorkspace(req.user, req.params.schoolId, PERMISSIONS.TRIP_READ);
    const all = await prisma.tripSeries.findMany({ where: { owningSchoolOrganizationId: workspace.schoolId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { trips: true } } } });
    return res.json(all.filter((series) => seriesReadAllowed(access, workspace, series)));
  } catch (error) { return next(error); }
});

router.get("/:seriesId", async (req, res, next) => {
  try {
    const { prisma, access, workspace } = await operationalPrismaForWorkspace(req.user, req.params.schoolId, PERMISSIONS.TRIP_READ);
    const series = await prisma.tripSeries.findFirst({ where: { id: req.params.seriesId, owningSchoolOrganizationId: workspace.schoolId }, include: { trips: { orderBy: { seriesOccurrenceDate: "asc" } } } });
    if (!series) return res.status(404).json({ message: "Recurring trip not found" });
    if (!seriesReadAllowed(access, workspace, series)) return res.status(403).json({ message: "Forbidden" });
    return res.json(series);
  } catch (error) { return next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const { prisma, access, workspace } = await operationalPrismaForWorkspace(req.user, req.params.schoolId, PERMISSIONS.TRIP_CREATE);
    if (!canCreateWorkspaceTrip({ workspace })) return res.status(403).json({ message: "Forbidden" });
    const body = req.body || {};
    const { rule, dates } = generateOccurrenceDates(body);
    const students = nullableNumber(body.students);
    const staff = nullableNumber(body.staff);
    const boosterSeatCount = nullableNumber(body.boosterSeatCount, 0);
    const common = {
      createdByAppUserId: access.user?.appUserId || null,
      tenantId: access.tenantId || null,
      owningSchoolOrganizationId: workspace.schoolId,
      managingOrganizationId: null,
      transportProviderOrganizationId: null,
      origin: body.origin ?? null,
      tripType: body.tripType ?? null,
      destination: body.destination ?? null,
      departureTime: body.departureTime ?? null,
      returnTime: body.returnTime ?? null,
      students,
      staff,
      notes: body.notes ?? null,
      boosterSeatsRequested: Boolean(body.boosterSeatsRequested),
      boosterSeatCount,
    };

    const result = await prisma.$transaction(async (tx) => {
      const series = await tx.tripSeries.create({ data: {
        ...common,
        recurrenceType: rule.recurrenceType,
        interval: rule.interval,
        daysOfWeek: rule.daysOfWeek,
        startDate: rule.startDate,
        endDate: rule.endDate,
        status: "active",
      }});
      const legacyCreatorId = Number(req.user.id);
      for (const occurrenceDate of dates) {
        await tx.trip.create({ data: {
          ...common,
          tripSeriesId: series.id,
          seriesOccurrenceDate: occurrenceDate,
          createdById: Number.isInteger(legacyCreatorId) ? legacyCreatorId : null,
          createdBy: req.user.name ?? null,
          createdByEmail: req.user.email ?? null,
          date: occurrenceDate,
          returnDate: occurrenceDate,
          status: "Pending",
          price: "0.00",
          cancelRequest: false,
          busInfo: null,
          driverInfo: null,
          buses: null,
        }});
      }
      return { series, occurrenceCount: dates.length };
    });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
});

export default router;
