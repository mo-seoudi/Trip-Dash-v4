// Clean-PostgreSQL smoke test for the provider-neutral operational schema.
// This deliberately tests database invariants that must hold regardless of
// whether the PostgreSQL host is Supabase, Neon, or another provider.

import { PrismaClient } from "../src/prisma-operational/index.js";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectUniqueViolation(operation, label) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === "P2002") return;
    throw new Error(`${label}: expected Prisma P2002, received ${error?.code || error?.message || error}`);
  }
  throw new Error(`${label}: expected a uniqueness violation but the write succeeded`);
}

async function main() {
  await prisma.tripBusPassengerAllocation.deleteMany();
  await prisma.tripBusAssignment.deleteMany();
  await prisma.tripPassengerPayment.deleteMany();
  await prisma.tripPassenger.deleteMany();
  await prisma.trip.deleteMany();

  const schoolA = "school-a";
  const schoolB = "school-b";

  const tripA = await prisma.trip.create({
    data: {
      owningSchoolOrganizationId: schoolA,
      requestingOrganizationId: schoolA,
      destination: "Museum",
      status: "Pending",
    },
  });
  const tripB = await prisma.trip.create({
    data: {
      owningSchoolOrganizationId: schoolB,
      requestingOrganizationId: schoolB,
      destination: "Stadium",
      status: "Pending",
    },
  });

  const [aBus1, aBus2, bBus1] = await Promise.all([
    prisma.tripBusAssignment.create({ data: { tripId: tripA.id, sequence: 1, seatCapacity: 30 } }),
    prisma.tripBusAssignment.create({ data: { tripId: tripA.id, sequence: 2, seatCapacity: 30 } }),
    prisma.tripBusAssignment.create({ data: { tripId: tripB.id, sequence: 1, seatCapacity: 30 } }),
  ]);

  const passengerA = await prisma.tripPassenger.create({ data: { tripId: tripA.id, fullName: "Passenger A" } });
  const passengerB = await prisma.tripPassenger.create({ data: { tripId: tripB.id, fullName: "Passenger A" } });

  // Same human name on another trip is normal: each trip owns its own passenger
  // record. The uniqueness rule is only about bus allocation inside one trip.
  assert(passengerA.id !== passengerB.id, "Passengers on separate trips should be independent records");

  await prisma.tripBusPassengerAllocation.create({
    data: { busAssignmentId: aBus1.id, tripPassengerId: passengerA.id, tripId: tripA.id },
  });

  // A passenger cannot be allocated to two buses on the same trip.
  await expectUniqueViolation(
    () => prisma.tripBusPassengerAllocation.create({
      data: { busAssignmentId: aBus2.id, tripPassengerId: passengerA.id, tripId: tripA.id },
    }),
    "same-trip duplicate passenger allocation",
  );

  // Composite foreign keys must prevent joining a passenger from one trip to a
  // bus assignment belonging to another trip, even if ids are supplied manually.
  try {
    await prisma.tripBusPassengerAllocation.create({
      data: { busAssignmentId: bBus1.id, tripPassengerId: passengerA.id, tripId: tripB.id },
    });
    throw new Error("cross-trip passenger allocation unexpectedly succeeded");
  } catch (error) {
    if (error?.message === "cross-trip passenger allocation unexpectedly succeeded") throw error;
    assert(["P2003", "P2014"].includes(error?.code), `Expected cross-trip FK rejection, received ${error?.code || error?.message}`);
  }

  console.log("Operational schema smoke test passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
