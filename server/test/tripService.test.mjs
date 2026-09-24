import test from "node:test";
import assert from "node:assert/strict";

import { createTripService, TripNotFoundError, TripValidationError } from "../src/domain/trips/tripService.js";

function harness({ permissions = [] } = {}) {
  const calls = [];
  const prisma = {
    trip: {
      findMany: async (args) => { calls.push(["findMany", args]); return []; },
      findFirst: async (args) => {
        calls.push(["findFirst", args]);
        if (args.where.id === 404) return null;
        return { id: args.where.id || 1, status: args.where.id === 23 ? "Canceled" : "Pending", createdByAppUserId: "user-1" };
      },
      create: async (args) => { calls.push(["create", args]); return { id: 10, ...args.data }; },
      updateMany: async (args) => { calls.push(["updateMany", args]); return { count: 1 }; },
      deleteMany: async (args) => { calls.push(["deleteMany", args]); return { count: 1 }; },
    },
  };
  return { prisma, calls, service: createTripService({ prisma, workspace: { schoolId: "school-a", permissions }, user: { appUserId: "user-1", organizationId: "school-a" } }) };
}

test("canonical trip reads are scoped to the school and creator for ordinary users", async () => {
  const { service, calls } = harness();
  await service.list({ status: "pending" });
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", createdByAppUserId: "user-1", status: "pending" });
  await service.get(12);
  assert.deepEqual(calls[1][1].where, { owningSchoolOrganizationId: "school-a", createdByAppUserId: "user-1", id: 12 });
});

test("trip.read_all permits workspace-wide reads while preserving school scope", async () => {
  const { service, calls } = harness({ permissions: ["trip.read_all"] });
  await service.list({ status: "pending" });
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", status: "pending" });
  await service.get(12);
  assert.deepEqual(calls[1][1].where, { owningSchoolOrganizationId: "school-a", id: 12 });
});

test("trip creation derives ownership and requester from authenticated context", async () => {
  const { service, calls } = harness();
  const created = await service.create({ destination: "Museum", date: "2026-10-01" });
  const data = calls[0][1].data;
  assert.equal(created.id, 10);
  assert.equal(data.owningSchoolOrganizationId, "school-a");
  assert.equal(data.requestingOrganizationId, "school-a");
  assert.equal(data.createdByAppUserId, "user-1");
  assert.equal(data.destination, "Museum");
});

test("trip creation refuses client-supplied ownership and requester identity", async () => {
  const { service, calls } = harness();
  await assert.rejects(service.create({ destination: "Museum", date: "2026-10-01", owningSchoolOrganizationId: "school-b" }), (error) => error instanceof TripValidationError && error.field === "owningSchoolOrganizationId");
  await assert.rejects(service.create({ destination: "Museum", date: "2026-10-01", requestingOrganizationId: "partner-x" }), (error) => error instanceof TripValidationError && error.field === "requestingOrganizationId");
  assert.equal(calls.length, 0);
});

test("trip mutation verifies creator and workspace ownership before update or delete", async () => {
  const { service, calls } = harness();
  await service.update(22, { destination: "Aquarium" });
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", createdByAppUserId: "user-1", id: 22 });
  assert.equal(calls[1][0], "updateMany");
  assert.equal(calls[2][0], "findFirst");

  calls.length = 0;
  await service.remove(23);
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", createdByAppUserId: "user-1", id: 23 });
  assert.equal(calls[1][0], "deleteMany");
  assert.deepEqual(calls[1][1].where, { owningSchoolOrganizationId: "school-a", createdByAppUserId: "user-1", id: 23 });
});

test("trip mutation refuses a trip outside the active school workspace", async () => {
  const { service, calls } = harness();
  await assert.rejects(service.cancel(404), (error) => error instanceof TripNotFoundError && error.status === 404);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "findFirst");
});

test("trip update refuses protected ownership and identity fields", async () => {
  const { service, calls } = harness();
  await assert.rejects(service.update(9, { owningSchoolOrganizationId: "school-b" }), (error) => error instanceof TripValidationError && error.field === "owningSchoolOrganizationId");
  await assert.rejects(service.update(9, { requestingOrganizationId: "partner-x" }), (error) => error instanceof TripValidationError && error.field === "requestingOrganizationId");
  assert.equal(calls.length, 0);
});
