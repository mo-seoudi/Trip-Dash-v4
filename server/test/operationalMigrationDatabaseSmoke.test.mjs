import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient as PrismaOperational } from "../src/prisma-operational/index.js";
import { buildOperationalMigrationPlan } from "../src/services/operationalMigrationPlan.js";
import { writeOperationalMigration } from "../src/services/operationalMigrationWriter.js";

const enabled = process.env.OPERATIONAL_DATABASE_SMOKE === "true";

function assertDisposableUrl(url) {
  const value = String(url || "");
  if (!value || !/localhost|127\.0\.0\.1/.test(value) || !/validation|test|smoke/.test(value)) {
    const error = new Error("Operational migration smoke test requires a local disposable database URL");
    error.code = "OPERATIONAL_SMOKE_UNSAFE_DATABASE_URL";
    throw error;
  }
}

async function reset(prisma) {
  await prisma.$transaction([
    prisma.tripBusPassengerAllocation.deleteMany(), prisma.tripPassengerPayment.deleteMany(),
    prisma.tripBusAssignment.deleteMany(), prisma.tripPassenger.deleteMany(), prisma.busBooking.deleteMany(), prisma.trip.deleteMany(),
  ]);
}

test("legacy buses become normalized assignments in real PostgreSQL", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const legacyTrips = [{
      id: 501, destination: "Expo City", status: "Confirmed", students: 42, staff: 3,
      buses: [
        { busType: "Internal Yellow Bus", busSeats: 30, tripPrice: 500, driverName: "Driver One", driverPhone: "0500000001" },
        { busType: "White Bus", busSeats: 20, tripPrice: "450.50", driverName: "Driver Two", driverPhone: "0500000002" },
      ],
    }];
    const plan = buildOperationalMigrationPlan(legacyTrips, () => ({ owningSchoolOrganizationId: "school-smoke", tenantId: "tenant-smoke" }));
    assert.deepEqual(plan.errors, []);
    const result = await writeOperationalMigration(prisma, plan, { allowWrite: true, environment: "ci-smoke" });
    assert.deepEqual(result.counts, { trips: 1, busAssignments: 2 });

    const stored = await prisma.trip.findUnique({ where: { id: 501 }, include: { busAssignments: { orderBy: { sequence: "asc" } } } });
    assert.equal(stored.destination, "Expo City");
    assert.equal(stored.owningSchoolOrganizationId, "school-smoke");
    assert.equal(stored.busAssignments.length, 2);
    assert.equal(stored.busAssignments[0].sequence, 1);
    assert.equal(stored.busAssignments[0].seatCapacity, 30);
    assert.equal(stored.busAssignments[0].price.toString(), "500");
    assert.equal(stored.busAssignments[1].sequence, 2);
    assert.equal(stored.busAssignments[1].busType, "White Bus");
    assert.equal(stored.busAssignments[1].price.toString(), "450.5");
    assert.equal(await prisma.trip.count(), 1);
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});

test("writer refuses unresolved migration plans before touching the database", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const plan = buildOperationalMigrationPlan([{ id: 999, destination: "Unknown school" }], () => ({}));
    await assert.rejects(writeOperationalMigration(prisma, plan, { allowWrite: true, environment: "ci-smoke" }), (error) => error?.code === "OPERATIONAL_MIGRATION_PLAN_HAS_ERRORS");
    assert.equal(await prisma.trip.count(), 0);
  } finally {
    await prisma.$disconnect();
  }
});
