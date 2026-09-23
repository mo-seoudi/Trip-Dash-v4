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

const STATUS = Object.freeze({
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
});

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

export class TripTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = "TripTransitionError";
    this.code = "TRIP_TRANSITION_NOT_ALLOWED";
    this.status = 409;
  }
}

function tripId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new TripValidationError("tripId is invalid", "tripId");
  return id;
}

function schoolWhere(workspace, extra = {}) {
  return { owningSchoolOrganizationId: workspace.schoolId, ...extra };
}

function rejectProtectedIdentityFields(input = {}) {
  for (const field of ["owningSchoolOrganizationId", "requestingOrganizationId", "createdByAppUserId", "status"]) {
    if (Object.hasOwn(input, field)) {
      throw new TripValidationError(`${field} is controlled by authenticated workflow context`, field);
    }
  }
}

function statusIs(value, expected) {
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

export function createTripService({ prisma, workspace, user }) {
  if (!prisma || !workspace?.schoolId) {
    throw new TypeError("Scoped operational context with school workspace is required");
  }

  async function existing(id) {
    const trip = await prisma.trip.findFirst({ where: schoolWhere(workspace, { id: tripId(id) }) });
    if (!trip) throw new TripNotFoundError();
    return trip;
  }

  async function transition(id, fromStatus, toStatus) {
    const current = await existing(id);
    if (!statusIs(current.status, fromStatus)) {
      throw new TripTransitionError(`Only a ${fromStatus} trip can move to ${toStatus}`);
    }
    const changed = await prisma.trip.updateMany({
      where: { id: current.id, owningSchoolOrganizationId: workspace.schoolId, status: current.status },
      data: { status: toStatus },
    });
    if (changed.count !== 1) throw new TripTransitionError("Trip changed before the workflow action was recorded");
    return prisma.trip.findUnique({
      where: { id: current.id },
      include: { busAssignments: true, passengers: true, quotations: true, approvalRequests: true },
    });
  }

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

    async get(id) {
      const trip = await prisma.trip.findFirst({
        where: schoolWhere(workspace, { id: tripId(id) }),
        include: { busAssignments: true, passengers: true, quotations: true, approvalRequests: true },
      });
      if (!trip) throw new TripNotFoundError();
      return trip;
    },

    async create(input = {}) {
      rejectProtectedIdentityFields(input);
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
          owningSchoolOrganizationId: workspace.schoolId,
          requestingOrganizationId: user?.organizationId || workspace.schoolId,
          managingOrganizationId: cleanText(input.managingOrganizationId),
          transportProviderOrganizationId: cleanText(input.transportProviderOrganizationId),
          payerOrganizationId: cleanText(input.payerOrganizationId) || workspace.schoolId,
          origin: cleanText(input.origin),
          tripType: cleanText(input.tripType),
          destination,
          date,
          departureTime: cleanText(input.departureTime),
          returnDate: asDate(input.returnDate, "returnDate"),
          returnTime: cleanText(input.returnTime),
          students,
          staff,
          status: STATUS.PENDING,
          notes: cleanText(input.notes),
          boosterSeatsRequested: Boolean(input.boosterSeatsRequested || boosterSeatCount > 0),
          boosterSeatCount,
        },
        include: { busAssignments: true },
      });
    },

    async update(id, input = {}) {
      rejectProtectedIdentityFields(input);
      const current = await existing(id);
      if (!statusIs(current.status, STATUS.PENDING)) {
        throw new TripTransitionError("Only a Pending trip request can be edited");
      }
      const data = {};
      if (Object.hasOwn(input, "destination")) {
        const value = cleanText(input.destination);
        if (!value) throw new TripValidationError("destination is required", "destination");
        data.destination = value;
      }
      if (Object.hasOwn(input, "date")) {
        const value = asDate(input.date, "date");
        if (!value) throw new TripValidationError("date is required", "date");
        data.date = value;
      }
      for (const field of ["origin", "tripType", "departureTime", "returnTime", "notes", "managingOrganizationId", "transportProviderOrganizationId", "payerOrganizationId"]) {
        if (Object.hasOwn(input, field)) data[field] = cleanText(input[field]);
      }
      if (Object.hasOwn(input, "returnDate")) data.returnDate = asDate(input.returnDate, "returnDate");
      if (Object.hasOwn(input, "students")) data.students = asCount(input.students, "students");
      if (Object.hasOwn(input, "staff")) data.staff = asCount(input.staff, "staff");
      if (Object.hasOwn(input, "boosterSeatCount")) data.boosterSeatCount = asCount(input.boosterSeatCount, "boosterSeatCount") ?? 0;
      if (Object.hasOwn(input, "boosterSeatsRequested")) data.boosterSeatsRequested = Boolean(input.boosterSeatsRequested);
      if (data.boosterSeatCount > 0) data.boosterSeatsRequested = true;

      return prisma.trip.update({ where: { id: current.id }, data, include: { busAssignments: true } });
    },

    accept(id) { return transition(id, STATUS.PENDING, STATUS.ACCEPTED); },
    reject(id) { return transition(id, STATUS.PENDING, STATUS.REJECTED); },
    complete(id) { return transition(id, STATUS.CONFIRMED, STATUS.COMPLETED); },

    async cancel(id) {
      const current = await existing(id);
      if (statusIs(current.status, STATUS.CANCELED)) return current;
      if (!statusIs(current.status, STATUS.PENDING)) {
        throw new TripTransitionError("Only a Pending trip can be cancelled directly");
      }
      return prisma.trip.update({ where: { id: current.id }, data: { status: STATUS.CANCELED }, include: { busAssignments: true } });
    },

    async remove(id) {
      const current = await existing(id);
      if (!statusIs(current.status, STATUS.CANCELED)) {
        throw new TripTransitionError("Only a Canceled trip can be deleted");
      }
      await prisma.trip.delete({ where: { id: current.id } });
      return { id: current.id, deleted: true };
    },
  };
}
