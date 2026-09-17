function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asDate(value, field) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TripValidationError(`${field} is invalid`, field);
  return date;
}

function asCount(value, field) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TripValidationError(`${field} must be a non-negative integer`, field);
  return number;
}

export class TripValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "TripValidationError";
    this.code = "TRIP_VALIDATION_FAILED";
    this.status = 400;
    this.field = field;
  }
}

export class TripNotFoundError extends Error {
  constructor() {
    super("Trip was not found in this school workspace");
    this.name = "TripNotFoundError";
    this.code = "TRIP_NOT_FOUND";
    this.status = 404;
  }
}

function schoolWhere(workspace, extra = {}) {
  return { owningSchoolOrganizationId: workspace.schoolId, ...extra };
}

export function createTripService({ prisma, workspace, user, tenantId }) {
  if (!prisma || !workspace?.schoolId) throw new TypeError("Scoped operational context is required");

  return {
    async list({ status = null, from = null, to = null, take = 100 } = {}) {
      const limit = Math.max(1, Math.min(Number(take) || 100, 250));
      const where = schoolWhere(workspace, {
        ...(status ? { status: cleanText(status) } : {}),
        ...((from || to) ? { date: { ...(from ? { gte: asDate(from, "from") } : {}), ...(to ? { lte: asDate(to, "to") } : {}) } } : {}),
      });
      return prisma.trip.findMany({
        where,
        orderBy: [{ date: "asc" }, { departureTime: "asc" }, { id: "asc" }],
        take: limit,
        include: { busAssignments: true },
      });
    },

    async get(tripId) {
      const id = Number(tripId);
      if (!Number.isInteger(id) || id <= 0) throw new TripValidationError("tripId is invalid", "tripId");
      const trip = await prisma.trip.findFirst({
        where: schoolWhere(workspace, { id }),
        include: { busAssignments: true, passengers: true, quotations: true, approvalRequests: true },
      });
      if (!trip) throw new TripNotFoundError();
      return trip;
    },

    async create(input = {}) {
      const destination = cleanText(input.destination);
      const date = asDate(input.date, "date");
      if (!destination) throw new TripValidationError("destination is required", "destination");
      if (!date) throw new TripValidationError("date is required", "date");

      const students = asCount(input.students, "students");
      const staff = asCount(input.staff, "staff");
      const boosterSeatCount = asCount(input.boosterSeatCount, "boosterSeatCount") ?? 0;

      return prisma.trip.create({
        data: {
          createdByAppUserId: user?.appUserId || null,
          tenantId: tenantId || null,
          owningSchoolOrganizationId: workspace.schoolId,
          managingOrganizationId: cleanText(input.managingOrganizationId),
          transportProviderOrganizationId: cleanText(input.transportProviderOrganizationId),
          origin: cleanText(input.origin),
          tripType: cleanText(input.tripType),
          destination,
          date,
          departureTime: cleanText(input.departureTime),
          returnDate: asDate(input.returnDate, "returnDate"),
          returnTime: cleanText(input.returnTime),
          students,
          staff,
          status: "pending",
          notes: cleanText(input.notes),
          boosterSeatsRequested: Boolean(input.boosterSeatsRequested || boosterSeatCount > 0),
          boosterSeatCount,
        },
        include: { busAssignments: true },
      });
    },
  };
}
