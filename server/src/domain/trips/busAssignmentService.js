import { TripNotFoundError, TripValidationError } from "./tripService.js";

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function optionalPositiveInt(value, field) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new TripValidationError(`${field} must be a positive integer`, field);
  return number;
}

function optionalMoney(value, field) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TripValidationError(`${field} must be zero or greater`, field);
  return number.toFixed(2);
}

export function createBusAssignmentService({ prisma, workspace }) {
  if (!prisma || !workspace?.schoolId) throw new TypeError("Scoped operational context is required");

  async function requireTrip(tripId) {
    const id = Number(tripId);
    if (!Number.isInteger(id) || id <= 0) throw new TripValidationError("tripId is invalid", "tripId");
    const trip = await prisma.trip.findFirst({ where: { id, owningSchoolOrganizationId: workspace.schoolId }, select: { id: true } });
    if (!trip) throw new TripNotFoundError();
    return trip;
  }

  return {
    async list(tripId) {
      const trip = await requireTrip(tripId);
      return prisma.tripBusAssignment.findMany({ where: { tripId: trip.id }, orderBy: { sequence: "asc" } });
    },

    async create(tripId, input = {}) {
      const trip = await requireTrip(tripId);
      const seatCapacity = optionalPositiveInt(input.seatCapacity, "seatCapacity");
      const price = optionalMoney(input.price, "price");

      return prisma.$transaction(async (tx) => {
        const latest = await tx.tripBusAssignment.findFirst({
          where: { tripId: trip.id },
          orderBy: { sequence: "desc" },
          select: { sequence: true },
        });
        return tx.tripBusAssignment.create({
          data: {
            tripId: trip.id,
            sequence: (latest?.sequence || 0) + 1,
            busType: cleanText(input.busType),
            seatCapacity,
            vehicleNumber: cleanText(input.vehicleNumber),
            plateNumber: cleanText(input.plateNumber),
            driverName: cleanText(input.driverName),
            driverPhone: cleanText(input.driverPhone),
            price,
            currency: cleanText(input.currency)?.toUpperCase() || "AED",
            status: cleanText(input.status) || "assigned",
            notes: cleanText(input.notes),
          },
        });
      });
    },
  };
}
