import { TripNotFoundError, TripValidationError } from "./tripService.js";

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

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new TripValidationError(`${field} is invalid`, field);
  return id;
}

function text(value, field, max, required = false) {
  if (value == null || value === "") {
    if (required) throw new TripValidationError(`${field} is required`, field);
    return null;
  }
  const result = String(value).trim();
  if (!result) {
    if (required) throw new TripValidationError(`${field} is required`, field);
    return null;
  }
  if (result.length > max) throw new TripValidationError(`${field} exceeds ${max} characters`, field);
  return result;
}

function normalizePassenger(input = {}) {
  return {
    fullName: text(input.fullName, "fullName", 200, true),
    guardianName: text(input.guardianName, "guardianName", 200),
    guardianPhone: text(input.guardianPhone, "guardianPhone", 100),
    pickupPoint: text(input.pickupPoint, "pickupPoint", 500),
    dropoffPoint: text(input.dropoffPoint, "dropoffPoint", 500),
    notes: text(input.notes, "notes", 2000),
    checkedIn: false,
  };
}

function normalizePatch(input = {}) {
  const allowed = new Set(["fullName", "guardianName", "guardianPhone", "pickupPoint", "dropoffPoint", "notes", "checkedIn"]);
  const unsupported = Object.keys(input).filter((key) => !allowed.has(key));
  if (unsupported.length) throw new TripValidationError(`Unsupported passenger fields: ${unsupported.join(", ")}`);
  const patch = {};
  if (input.fullName !== undefined) patch.fullName = text(input.fullName, "fullName", 200, true);
  if (input.guardianName !== undefined) patch.guardianName = text(input.guardianName, "guardianName", 200);
  if (input.guardianPhone !== undefined) patch.guardianPhone = text(input.guardianPhone, "guardianPhone", 100);
  if (input.pickupPoint !== undefined) patch.pickupPoint = text(input.pickupPoint, "pickupPoint", 500);
  if (input.dropoffPoint !== undefined) patch.dropoffPoint = text(input.dropoffPoint, "dropoffPoint", 500);
  if (input.notes !== undefined) patch.notes = text(input.notes, "notes", 2000);
  if (input.checkedIn !== undefined) {
    if (typeof input.checkedIn !== "boolean") throw new TripValidationError("checkedIn must be boolean", "checkedIn");
    patch.checkedIn = input.checkedIn;
  }
  if (!Object.keys(patch).length) throw new TripValidationError("No supported passenger fields supplied");
  return patch;
}

export class PassengerNotFoundError extends Error {
  constructor() {
    super("Passenger was not found on this trip");
    this.name = "PassengerNotFoundError";
    this.code = "PASSENGER_NOT_FOUND";
    this.status = 404;
  }
}

export function createPassengerService({ prisma, workspace, tenantId }) {
  if (!prisma || !workspace?.schoolId || !tenantId) throw new TypeError("Scoped operational context with tenant and school is required");

  async function requireTrip(tripId) {
    const id = positiveId(tripId, "tripId");
    const trip = await prisma.trip.findFirst({
      where: { id, tenantId, owningSchoolOrganizationId: workspace.schoolId },
      select: { id: true },
    });
    if (!trip) throw new TripNotFoundError();
    return id;
  }

  return {
    async list(tripId) {
      const id = await requireTrip(tripId);
      return prisma.tripPassenger.findMany({ where: { tripId: id }, orderBy: [{ fullName: "asc" }, { id: "asc" }], select: PASSENGER_SELECT });
    },

    async addMany(tripId, input = {}) {
      const id = await requireTrip(tripId);
      const list = input.passengers;
      if (!Array.isArray(list) || !list.length) throw new TripValidationError("passengers must be a non-empty array", "passengers");
      if (list.length > MAX_PASSENGERS_PER_REQUEST) throw new TripValidationError(`A maximum of ${MAX_PASSENGERS_PER_REQUEST} passengers may be added at once`, "passengers");
      const passengers = list.map(normalizePassenger);
      return prisma.$transaction(passengers.map((passenger) => prisma.tripPassenger.create({ data: { tripId: id, ...passenger }, select: PASSENGER_SELECT })));
    },

    async update(tripId, passengerId, input = {}) {
      const id = await requireTrip(tripId);
      const pid = positiveId(passengerId, "passengerId");
      const existing = await prisma.tripPassenger.findFirst({ where: { id: pid, tripId: id }, select: { id: true } });
      if (!existing) throw new PassengerNotFoundError();
      return prisma.tripPassenger.update({ where: { id: pid }, data: normalizePatch(input), select: PASSENGER_SELECT });
    },

    async remove(tripId, passengerId) {
      const id = await requireTrip(tripId);
      const pid = positiveId(passengerId, "passengerId");
      const result = await prisma.tripPassenger.deleteMany({ where: { id: pid, tripId: id } });
      if (!result.count) throw new PassengerNotFoundError();
    },
  };
}
