import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalMigrationPlan, planLegacyBusAssignments, planOperationalTrip, reconcileLegacyBusAssignments } from "../src/services/operationalMigrationPlan.js";

test("legacy buses JSON becomes normalized assignments on one trip", () => {
  const trip = { id: 41, destination: "Museum", buses: [
    { busType: "Internal Yellow Bus", busSeats: 30, tripPrice: 550, driverName: "Driver One", driverPhone: "0500000000" },
    { busType: "White Bus", busSeats: "18", tripPrice: "325.50", driverName: "Driver Two" },
  ] };
  const assignments = planLegacyBusAssignments(trip);
  assert.equal(assignments.length, 2);
  assert.deepEqual(assignments.map((row) => row.sequence), [1, 2]);
  assert.ok(assignments.every((row) => row.legacyTripId === 41));
  assert.equal(assignments[0].seatCapacity, 30);
  assert.equal(assignments[1].price, "325.50");
});

test("exact SubTrip duplicate is collapsed rather than creating another bus", () => {
  const trip = { id: 50, buses: [{ busType: "White Bus", busSeats: 20, tripPrice: 400, status: "Assigned" }] };
  const result = reconcileLegacyBusAssignments(trip, [{ id: 7, parentTripId: 50, busType: "White Bus", busSeats: 20, tripPrice: 400, status: "Assigned" }]);
  assert.equal(result.assignments.length, 1);
  assert.deepEqual(result.warnings, [{ code: "LEGACY_BUS_DUPLICATE_COLLAPSED", legacySubTripId: 7 }]);
  assert.deepEqual(result.conflicts, []);
});

test("distinct historical SubTrip becomes another assignment on the same Trip", () => {
  const trip = { id: 51, buses: [{ busType: "Yellow Bus", busSeats: 30, tripPrice: 500 }] };
  const result = reconcileLegacyBusAssignments(trip, [{ id: 8, parentTripId: 51, busType: "White Bus", busSeats: 20, tripPrice: 350 }]);
  assert.equal(result.assignments.length, 2);
  assert.deepEqual(result.assignments.map((row) => row.sequence), [1, 2]);
});

test("conflicting legacy bus sources stop migration instead of guessing", () => {
  const trip = { id: 52, buses: [{ busType: "White Bus", busSeats: 20, tripPrice: 400 }] };
  assert.throws(
    () => planOperationalTrip(trip, { owningSchoolOrganizationId: "school-a", subTrips: [{ id: 9, parentTripId: 52, busType: "White Bus", busSeats: 35, tripPrice: 400 }] }),
    (error) => error.code === "OPERATIONAL_MIGRATION_BUS_SOURCE_CONFLICT" && error.conflicts.length === 1,
  );
});

test("trip migration preserves id and requires resolved owning school", () => {
  const planned = planOperationalTrip({ id: 12, students: 20, staff: 3, status: "Confirmed" }, { tenantId: "t1", owningSchoolOrganizationId: "school-1", createdByAppUserId: "u1" });
  assert.equal(planned.trip.id, 12);
  assert.equal(planned.trip.owningSchoolOrganizationId, "school-1");
  assert.equal(planned.trip.createdByAppUserId, "u1");
  assert.throws(() => planOperationalTrip({ id: 13 }, {}), (error) => error.code === "OPERATIONAL_MIGRATION_MISSING_SCHOOL");
});

test("bulk planner fails individual unresolved trips without guessing school ownership", () => {
  const result = buildOperationalMigrationPlan([{ id: 1, buses: [{ busSeats: 20 }] }, { id: 2, buses: [] }], (trip) => trip.id === 1 ? { owningSchoolOrganizationId: "school-a", tenantId: "t1" } : {});
  assert.equal(result.writesPerformed, false);
  assert.deepEqual(result.counts, { sourceTrips: 2, plannedTrips: 1, busAssignments: 1, warnings: 0, errors: 1 });
  assert.equal(result.errors[0].legacyTripId, 2);
  assert.equal(result.errors[0].code, "OPERATIONAL_MIGRATION_MISSING_SCHOOL");
});

test("same legacy trip remains one trip regardless of bus count", () => {
  const result = planOperationalTrip({ id: 99, buses: [{ busType: "A" }, { busType: "B" }, { busType: "C" }] }, { owningSchoolOrganizationId: "school-a" });
  assert.equal(result.trip.id, 99);
  assert.equal(result.busAssignments.length, 3);
  assert.equal("children" in result.trip, false);
  assert.equal("subTrips" in result, false);
});
