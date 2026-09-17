import test from "node:test";
import assert from "node:assert/strict";

import { createTripService, TripNotFoundError, TripValidationError } from "../src/domain/trips/tripService.js";

function harness() {
  const calls = [];
  const prisma = {
    trip: {
      findMany: async (args) => { calls.push(["findMany", args]); return []; },
      findFirst: async (args) => { calls.push(["findFirst", args]); return args.where.id === 404 ? null : { id: args.where.id || 1, status: "pending" }; },
      create: async (args) => { calls.push(["create", args]); return { id: 10, ...args.data }; },
      update: async (args) => { calls.push(["update", args]); return { id: args.where.id, ...args.data }; },
      delete: async (args) => { calls.push(["delete", args]); return { id: args.where.id }; },
    },
  };
  return { prisma, calls, service: createTripService({ prisma, workspace: { schoolId: "school-a" }, user: { appUserId: "user-1", organizationId: "school-a" } }) };
}

test("canonical trip reads are always scoped to the owning school organization", async () => {
  const { service, calls } = harness();
  await service.list({ status: "pending" });
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", status: "pending" });

  await service.get(12);
  assert.deepEqual(calls[1][1].where, { owningSchoolOrganizationId: "school-a", id: 12 });
});

test("trip creation derives ownership and requester from authenticated context", async () => {
  const { service, calls } = harness();
  const created = await service.create({ destination: "Museum", date: "2026-10-01", requestingOrganizationId: "spoofed", owningSchoolOrganizationId: "spoofed" });
  const data = calls[0][1].data;
  assert.equal(created.id, 10);
  assert.equal(data.owningSchoolOrganizationId, "school-a");
  assert.equal(data.requestingOrganizationId, "school-a");
  assert.equal(data.createdByAppUserId, "user-1");
  assert.equal(data.destination, "Museum");
});

test("trip mutation verifies workspace ownership before update or delete", async () => {
  const { service, calls } = harness();
  await service.update(22, { destination: "Aquarium" });
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", id: 22 });
  assert.equal(calls[1][0], "update");

  calls.length = 0;
  await service.remove(23);
  assert.deepEqual(calls[0][1].where, { owningSchoolOrganizationId: "school-a", id: 23 });
  assert.equal(calls[1][0], "delete");
});

test("trip mutation refuses a trip outside the active school workspace", async () => {
  const { service, calls } = harness();
  await assert.rejects(service.cancel(404), (error) => error instanceof TripNotFoundError && error.status === 404);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "findFirst");
});

test("trip update refuses protected ownership and identity fields", async () => {
  const { service } = harness();
  await assert.rejects(
    service.update(9, { owningSchoolOrganizationId: "school-b" }),
    (error) => error instanceof TripValidationError && error.field === "owningSchoolOrganizationId",
  );
  await assert.rejects(
    service.update(9, { requestingOrganizationId: "partner-x" }),
    (error) => error instanceof TripValidationError && error.field === "requestingOrganizationId",
  );
});
