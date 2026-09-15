import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient as PrismaOperational } from "../src/prisma-operational/index.js";
import { buildOperationalMigrationPlan } from "../src/services/operationalMigrationPlan.js";
import { writeOperationalMigration } from "../src/services/operationalMigrationWriter.js";
import { assertOperationalMigrationVerified } from "../src/services/operationalMigrationVerification.js";

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

test("JSON buses plus historical SubTrips reconcile, write, and verify exactly in PostgreSQL", { skip: !enabled }, async () => {
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
    const subTrips = [
      // Exact duplicate of JSON bus 2: must collapse, not create a third copy.
      { id: 7001, parentTripId: 501, busType: "White Bus", busSeats: 20, tripPrice: "450.50", driverName: "Driver Two", driverPhone: "0500000002" },
      // Distinct historical vehicle: must become assignment 3 on the same Trip.
      { id: 7002, parentTripId: 501, busType: "Mini Bus", busSeats: 14, tripPrice: 250 },
    ];
    const plan = buildOperationalMigrationPlan(legacyTrips, () => ({
      owningSchoolOrganizationId: "school-smoke", tenantId: "tenant-smoke", subTrips,
    }));
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.warnings.length, 1);
    assert.equal(plan.warnings[0].code, "LEGACY_BUS_DUPLICATE_COLLAPSED");
    assert.equal(plan.counts.busAssignments, 3);

    const result = await writeOperationalMigration(prisma, plan, { allowWrite: true, environment: "ci-smoke" });
    assert.deepEqual(result.counts, { trips: 1, busAssignments: 3 });
    const verification = await assertOperationalMigrationVerified(prisma, plan);
    assert.equal(verification.exact, true);
    assert.deepEqual(verification.issues, []);

    const stored = await prisma.trip.findUnique({ where: { id: 501 }, include: { busAssignments: { orderBy: { sequence: "asc" } } } });
    assert.equal(stored.busAssignments.length, 3);
    assert.deepEqual(stored.busAssignments.map((row) => row.busType), ["Internal Yellow Bus", "White Bus", "Mini Bus"]);
    assert.equal(await prisma.trip.count(), 1);
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});

test("conflicting SubTrip source blocks PostgreSQL migration before writes", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const legacyTrips = [{ id: 503, buses: [{ busType: "White Bus", busSeats: 20, tripPrice: 400 }] }];
    const plan = buildOperationalMigrationPlan(legacyTrips, () => ({
      owningSchoolOrganizationId: "school-smoke",
      subTrips: [{ id: 7003, parentTripId: 503, busType: "White Bus", busSeats: 35, tripPrice: 400 }],
    }));
    assert.equal(plan.errors.length, 1);
    assert.equal(plan.errors[0].code, "OPERATIONAL_MIGRATION_BUS_SOURCE_CONFLICT");
    await assert.rejects(
      writeOperationalMigration(prisma, plan, { allowWrite: true, environment: "ci-smoke" }),
      (error) => error?.code === "OPERATIONAL_MIGRATION_PLAN_HAS_ERRORS",
    );
    assert.equal(await prisma.trip.count(), 0);
    assert.equal(await prisma.tripBusAssignment.count(), 0);
  } finally {
    await prisma.$disconnect();
  }
});

test("verification catches post-write assignment drift", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.OPERATIONAL_DATABASE_URL);
  const prisma = new PrismaOperational();
  try {
    await reset(prisma);
    const plan = buildOperationalMigrationPlan([{ id: 502, buses: [{ busType: "White Bus", busSeats: 20, tripPrice: 400 }] }], () => ({ owningSchoolOrganizationId: "school-smoke" }));
    await writeOperationalMigration(prisma, plan, { allowWrite: true, environment: "ci-smoke" });
    await prisma.tripBusAssignment.updateMany({ where: { tripId: 502 }, data: { seatCapacity: 99 } });
    await assert.rejects(assertOperationalMigrationVerified(prisma, plan), (error) => error?.code === "OPERATIONAL_MIGRATION_VERIFICATION_FAILED" && error.verification.issues.some((issue) => issue.code === "BUS_ASSIGNMENT_DATA_MISMATCH"));
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
