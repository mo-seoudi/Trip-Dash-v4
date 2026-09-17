import { PassengerNotFoundError } from "./passengerService.js";
import { TripNotFoundError, TripValidationError } from "./tripService.js";

function positiveId(value, field) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new TripValidationError(`${field} is invalid`, field);
  return id;
}

export class BusAssignmentNotFoundError extends Error {
  constructor() {
    super("Bus assignment was not found on this trip");
    this.name = "BusAssignmentNotFoundError";
    this.code = "BUS_ASSIGNMENT_NOT_FOUND";
    this.status = 404;
  }
}

export class PassengerAllocationConflictError extends Error {
  constructor() {
    super("Passenger is already allocated to a bus on this trip");
    this.name = "PassengerAllocationConflictError";
    this.code = "PASSENGER_ALREADY_ALLOCATED";
    this.status = 409;
  }
}

export function createPassengerAllocationService({ prisma, workspace, tenantId }) {
  if (!prisma || !workspace?.schoolId || !tenantId) throw new TypeError("Scoped operational context with tenant and school is required");

  async function requireTrip(tripId) {
    const id = positiveId(tripId, "tripId");
    const trip = await prisma.trip.findFirst({ where: { id, tenantId, owningSchoolOrganizationId: workspace.schoolId }, select: { id: true } });
    if (!trip) throw new TripNotFoundError();
    return id;
  }

  async function requireBus(tripId, busAssignmentId) {
    const id = String(busAssignmentId || "").trim();
    if (!id) throw new TripValidationError("busAssignmentId is required", "busAssignmentId");
    const bus = await prisma.tripBusAssignment.findFirst({ where: { id, tripId }, select: { id: true, seatCapacity: true } });
    if (!bus) throw new BusAssignmentNotFoundError();
    return bus;
  }

  async function requirePassenger(tripId, passengerId) {
    const id = positiveId(passengerId, "passengerId");
    const passenger = await prisma.tripPassenger.findFirst({ where: { id, tripId }, select: { id: true } });
    if (!passenger) throw new PassengerNotFoundError();
    return passenger;
  }

  return {
    async list(tripId) {
      const id = await requireTrip(tripId);
      return prisma.tripBusPassengerAllocation.findMany({
        where: { busAssignment: { tripId: id } },
        orderBy: [{ busAssignment: { sequence: "asc" } }, { passenger: { fullName: "asc" } }],
        include: {
          busAssignment: { select: { id: true, sequence: true, busType: true, seatCapacity: true, vehicleNumber: true, plateNumber: true } },
          passenger: { select: { id: true, fullName: true, checkedIn: true } },
        },
      });
    },

    async allocate(tripId, busAssignmentId, passengerId) {
      const id = await requireTrip(tripId);
      const bus = await requireBus(id, busAssignmentId);
      const passenger = await requirePassenger(id, passengerId);

      const existing = await prisma.tripBusPassengerAllocation.findFirst({
        where: { tripPassengerId: passenger.id, busAssignment: { tripId: id } },
        select: { busAssignmentId: true },
      });
      if (existing) {
        if (existing.busAssignmentId === bus.id) return prisma.tripBusPassengerAllocation.findUnique({
          where: { busAssignmentId_tripPassengerId: { busAssignmentId: bus.id, tripPassengerId: passenger.id } },
        });
        throw new PassengerAllocationConflictError();
      }

      if (bus.seatCapacity) {
        const occupied = await prisma.tripBusPassengerAllocation.count({ where: { busAssignmentId: bus.id } });
        if (occupied >= bus.seatCapacity) {
          const error = new TripValidationError("Bus assignment has no remaining passenger seats", "busAssignmentId");
          error.code = "BUS_CAPACITY_REACHED";
          error.status = 409;
          throw error;
        }
      }

      return prisma.tripBusPassengerAllocation.create({ data: { busAssignmentId: bus.id, tripPassengerId: passenger.id } });
    },

    async move(tripId, passengerId, busAssignmentId) {
      const id = await requireTrip(tripId);
      const passenger = await requirePassenger(id, passengerId);
      const bus = await requireBus(id, busAssignmentId);

      return prisma.$transaction(async (tx) => {
        const existing = await tx.tripBusPassengerAllocation.findFirst({ where: { tripPassengerId: passenger.id, busAssignment: { tripId: id } } });
        if (existing?.busAssignmentId === bus.id) return existing;
        if (bus.seatCapacity) {
          const occupied = await tx.tripBusPassengerAllocation.count({ where: { busAssignmentId: bus.id } });
          if (occupied >= bus.seatCapacity) {
            const error = new TripValidationError("Bus assignment has no remaining passenger seats", "busAssignmentId");
            error.code = "BUS_CAPACITY_REACHED";
            error.status = 409;
            throw error;
          }
        }
        if (existing) await tx.tripBusPassengerAllocation.delete({ where: { busAssignmentId_tripPassengerId: { busAssignmentId: existing.busAssignmentId, tripPassengerId: passenger.id } } });
        return tx.tripBusPassengerAllocation.create({ data: { busAssignmentId: bus.id, tripPassengerId: passenger.id } });
      });
    },

    async unallocate(tripId, passengerId) {
      const id = await requireTrip(tripId);
      const passenger = await requirePassenger(id, passengerId);
      await prisma.tripBusPassengerAllocation.deleteMany({ where: { tripPassengerId: passenger.id, busAssignment: { tripId: id } } });
    },
  };
}
