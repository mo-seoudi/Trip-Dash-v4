import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteLegacyMembershipWithScopes,
  updateLegacyMembershipWithScopes,
} from "../src/services/legacyMembershipIntegrity.js";

function fakePrisma({ scopes = [] } = {}) {
  const calls = [];
  const tx = {
    userOrgScope: {
      async findMany(args) {
        calls.push(["scope.findMany", args]);
        return scopes;
      },
      async deleteMany(args) {
        calls.push(["scope.deleteMany", args]);
        return { count: scopes.length };
      },
      async createMany(args) {
        calls.push(["scope.createMany", args]);
        return { count: args.data.length };
      },
    },
    userOrgMembership: {
      async update(args) {
        calls.push(["membership.update", args]);
        return { id: args.where.id, userId: "u1", orgId: "o1", role: args.data.role ?? "staff" };
      },
      async delete(args) {
        calls.push(["membership.delete", args]);
        return { id: args.where.id };
      },
    },
  };
  return {
    calls,
    async $transaction(fn) {
      calls.push(["transaction.begin"]);
      const result = await fn(tx);
      calls.push(["transaction.end"]);
      return result;
    },
  };
}

const existing = { id: 7, userId: "u1", orgId: "o1", role: "staff" };

test("role change moves existing school scopes to the new stored role", async () => {
  const prisma = fakePrisma({ scopes: [{ schoolOrgId: "s1" }, { schoolOrgId: "s2" }] });
  await updateLegacyMembershipWithScopes(prisma, {
    membershipId: 7,
    existing,
    data: { role: "school_staff" },
  });

  const names = prisma.calls.map(([name]) => name);
  assert.deepEqual(names, [
    "transaction.begin",
    "scope.findMany",
    "membership.update",
    "scope.deleteMany",
    "scope.createMany",
    "transaction.end",
  ]);
  const create = prisma.calls.find(([name]) => name === "scope.createMany")[1];
  assert.deepEqual(create.data, [
    { userId: "u1", orgId: "o1", role: "school_staff", schoolOrgId: "s1" },
    { userId: "u1", orgId: "o1", role: "school_staff", schoolOrgId: "s2" },
  ]);
});

test("non-role membership edits do not touch school scopes", async () => {
  const prisma = fakePrisma({ scopes: [{ schoolOrgId: "s1" }] });
  await updateLegacyMembershipWithScopes(prisma, {
    membershipId: 7,
    existing,
    data: { status: "blocked" },
  });
  assert.deepEqual(prisma.calls.map(([name]) => name), [
    "transaction.begin",
    "membership.update",
    "transaction.end",
  ]);
});

test("deleting membership removes its matching role scopes first", async () => {
  const prisma = fakePrisma({ scopes: [{ schoolOrgId: "s1" }] });
  await deleteLegacyMembershipWithScopes(prisma, existing);
  assert.deepEqual(prisma.calls.map(([name]) => name), [
    "transaction.begin",
    "scope.deleteMany",
    "membership.delete",
    "transaction.end",
  ]);
  const cleanup = prisma.calls.find(([name]) => name === "scope.deleteMany")[1];
  assert.deepEqual(cleanup.where, { userId: "u1", orgId: "o1", role: "staff" });
});
