import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient as PrismaOperational } from "../src/prisma-operational/index.js";

const enabled = process.env.OPERATIONAL_DATABASE_SMOKE === "true";

function assertDisposableUrl(url) {
  const value = String(url || "");
  if (!value || !/localhost|127\.0\.0\.1/.test(value) || !/validation|test|smoke/.test(value)) {
    const error = new Error("Operational smoke test requires an explicit local disposable database URL");
    error.code = "OPERATIONAL_SMOKE_UNSAFE_DATABASE_URL";
    throw error;
  }
}

async function reset(prisma) {
  await prisma.$transaction([
    prisma.tripBusPassengerAllocation.deleteMany(), prisma.tripPassengerPayment.deleteMany(),
    prisma.tripBusAssignment.deleteMany(), prisma.tripPassenger.deleteMany(),
    prisma.busBooking.deleteMany(), prisma.trip.deleteMany(),
  ]);
}

test("operational database enforces one bus per passenger within a trip", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const trip = await prisma.trip.create({ data: { owningSchoolOrganizationId: "school-a", destination: "Museum" } });
    const otherTrip = await prisma.trip.create({ data: { owningSchoolOrganizationId: "school-a", destination: "Sports City" } });
    const passenger = await prisma.tripPassenger.create({ data: { tripId: trip.id, fullName: "Passenger A" } });
    const samePersonOtherTrip = await prisma.tripPassenger.create({ data: { tripId: otherTrip.id, fullName: "Passenger A" } });
    const bus1 = await prisma.tripBusAssignment.create({ data: { tripId: trip.id, sequence: 1, seatCapacity: 30 } });
    const bus2 = await prisma.tripBusAssignment.create({ data: { tripId: trip.id, sequence: 2, seatCapacity: 30 } });
    const otherTripBus = await prisma.tripBusAssignment.create({ data: { tripId: otherTrip.id, sequence: 1, seatCapacity: 30 } });

    await prisma.tripBusPassengerAllocation.create({ data: { tripId: trip.id, tripPassengerId: passenger.id, busAssignmentId: bus1.id } });
    await assert.rejects(
      prisma.tripBusPassengerAllocation.create({ data: { tripId: trip.id, tripPassengerId: passenger.id, busAssignmentId: bus2.id } }),
      (error) => error?.code === "P2002",
    );

    // PostgreSQL may report either compound FK first: passenger+trip or bus+trip.
    // Both are the desired fail-closed result: an allocation cannot cross Trip boundaries.
    await assert.rejects(
      prisma.tripBusPassengerAllocation.create({ data: { tripId: otherTrip.id, tripPassengerId: passenger.id, busAssignmentId: otherTripBus.id } }),
      (error) => error?.code === "P2003" || /Foreign key constraint violated/.test(String(error?.message || "")),
    );

    await prisma.tripBusPassengerAllocation.create({ data: { tripId: otherTrip.id, tripPassengerId: samePersonOtherTrip.id, busAssignmentId: otherTripBus.id } });
    assert.equal(await prisma.tripBusPassengerAllocation.count(), 2);
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});

test("deleting a trip cascades its assignments passengers and allocations", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const trip = await prisma.trip.create({ data: { owningSchoolOrganizationId: "school-a" } });
    const passenger = await prisma.tripPassenger.create({ data: { tripId: trip.id, fullName: "Passenger" } });
    const bus = await prisma.tripBusAssignment.create({ data: { tripId: trip.id, sequence: 1 } });
    await prisma.tripBusPassengerAllocation.create({ data: { tripId: trip.id, tripPassengerId: passenger.id, busAssignmentId: bus.id } });
    await prisma.trip.delete({ where: { id: trip.id } });
    assert.equal(await prisma.tripBusAssignment.count(), 0);
    assert.equal(await prisma.tripPassenger.count(), 0);
    assert.equal(await prisma.tripBusPassengerAllocation.count(), 0);
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});
