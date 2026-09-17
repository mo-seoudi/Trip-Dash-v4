import test from "node:test";
import assert from "node:assert/strict";

import { writeControlPlaneBackfill } from "../src/services/controlPlaneBackfill.js";

const plan = {
  tenants: [{ id: "t1", name: "Tenant", slug: "tenant", status: "active" }],
  organizations: [{ id: "s1", tenantId: "t1", type: "SCHOOL", displayName: "School", fullName: "School", legalName: null, abbreviation: "S1", slug: "school", status: "active", parentId: null }],
  users: [{ id: "u1", email: "user@example.com", displayName: "User", status: "active", legacyUserId: 1 }],
  memberships: [{ userId: "u1", organizationId: "s1", status: "ACTIVE", isPrimary: true }],
  roleAssignments: [{ userId: "u1", roleKey: "school_staff", scopeType: "ORGANIZATION", tenantId: null, organizationId: "s1", isActive: true }],
  relationships: [],
  errors: [],
};

function fakeControlPrisma() {
  const calls = [];
  const tx = {
    role: { findMany: async () => [{ id: "r1", key: "school_staff" }] },
    tenant: { upsert: async (args) => calls.push(["tenant.upsert", args]) },
    organization: { upsert: async (args) => calls.push(["organization.upsert", args]) },
    tenantOrganization: { upsert: async (args) => calls.push(["tenantOrganization.upsert", args]) },
    appUser: { upsert: async (args) => calls.push(["appUser.upsert", args]) },
    organizationMembership: { upsert: async (args) => calls.push(["membership.upsert", args]) },
    organizationRelationship: { upsert: async (args) => calls.push(["relationship.upsert", args]) },
    roleAssignment: {
      deleteMany: async (args) => calls.push(["roleAssignment.deleteMany", args]),
      create: async (args) => calls.push(["roleAssignment.create", args]),
    },
  };
  return {
    calls,
    async $transaction(callback) {
      calls.push(["transaction.begin"]);
      const result = await callback(tx);
      calls.push(["transaction.commit"]);
      return result;
    },
  };
}

test("backfill is disabled unless explicitly enabled", async () => {
  const prisma = fakeControlPrisma();
  await assert.rejects(writeControlPlaneBackfill(prisma, plan), (error) => {
    assert.equal(error.code, "CONTROL_BACKFILL_DISABLED");
    return true;
  });
  assert.equal(prisma.calls.length, 0);
});

test("backfill remains blocked in production even with allowWrite", async () => {
  const prisma = fakeControlPrisma();
  await assert.rejects(writeControlPlaneBackfill(prisma, plan, { allowWrite: true, environment: "production" }), (error) => {
    assert.equal(error.code, "CONTROL_BACKFILL_PRODUCTION_BLOCKED");
    return true;
  });
  assert.equal(prisma.calls.length, 0);
});

test("invalid plans are rejected before a transaction starts", async () => {
  const prisma = fakeControlPrisma();
  await assert.rejects(writeControlPlaneBackfill(prisma, { ...plan, errors: ["bad reference"] }, { allowWrite: true, environment: "test" }), (error) => {
    assert.equal(error.code, "CONTROL_BACKFILL_INVALID_PLAN");
    return true;
  });
  assert.equal(prisma.calls.length, 0);
});

test("explicit non-production backfill writes graph and subscription coverage atomically", async () => {
  const prisma = fakeControlPrisma();
  const result = await writeControlPlaneBackfill(prisma, plan, { allowWrite: true, environment: "test" });
  assert.equal(result.writesPerformed, true);
  assert.equal(result.counts.appUsers, 1);
  assert.equal(result.counts.tenantCoverage, 1);
  assert.deepEqual(prisma.calls.map(([name]) => name), [
    "transaction.begin",
    "tenant.upsert",
    "organization.upsert",
    "tenantOrganization.upsert",
    "appUser.upsert",
    "membership.upsert",
    "roleAssignment.deleteMany",
    "roleAssignment.create",
    "transaction.commit",
  ]);
});

test("missing seeded roles abort the transaction", async () => {
  const prisma = fakeControlPrisma();
  prisma.$transaction = async (callback) => callback({ role: { findMany: async () => [] } });
  await assert.rejects(writeControlPlaneBackfill(prisma, plan, { allowWrite: true, environment: "test" }), (error) => {
    assert.equal(error.code, "CONTROL_BACKFILL_MISSING_ROLES");
    return true;
  });
});
