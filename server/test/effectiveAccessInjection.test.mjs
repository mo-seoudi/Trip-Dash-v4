import test from "node:test";
import assert from "node:assert/strict";

import { resolveEffectiveAccessWithPrisma } from "../src/services/effectiveAccess.js";

test("legacy effective access requires an explicit client when injected API is used", async () => {
  await assert.rejects(
    resolveEffectiveAccessWithPrisma(null, { id: 1, email: "user@example.com", role: "school_staff" }),
    /legacy global Prisma client is required/,
  );
});

test("injected legacy resolver does not require the singleton database", async () => {
  const calls = [];
  const prisma = {
    user: {
      async findFirst(args) {
        calls.push(["user.findFirst", args]);
        return { id: "g1", tenantId: "t1", email: "user@example.com", fullName: "User", isActive: true };
      },
    },
    userOrgMembership: {
      async findMany() {
        calls.push(["membership.findMany"]);
        return [];
      },
    },
    userOrgScope: {
      async findMany() {
        calls.push(["scope.findMany"]);
        return [];
      },
    },
    organization: { async findMany() { throw new Error("unexpected organization query"); } },
    partnership: { async findMany() { throw new Error("unexpected partnership query"); } },
  };

  const result = await resolveEffectiveAccessWithPrisma(prisma, {
    id: 1,
    email: "user@example.com",
    name: "User",
    role: "school_staff",
  });

  assert.equal(result.source, "legacy-global-bridge");
  assert.equal(result.tenantId, "t1");
  assert.deepEqual(result.workspaces, []);
  assert.equal(calls[0][0], "user.findFirst");
  assert.equal(calls[1][0], "membership.findMany");
  assert.equal(calls[2][0], "scope.findMany");
});
