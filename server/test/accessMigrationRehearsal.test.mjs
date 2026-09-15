import test from "node:test";
import assert from "node:assert/strict";

import { rehearseAccessMigration } from "../src/services/accessMigrationRehearsal.js";

const snapshot = {
  tenants: [{ id: "t1", name: "Tenant One", slug: "tenant-one" }],
  organizations: [{ id: "s1", tenantId: "t1", type: "school", name: "School One", code: "S1" }],
  users: [{ id: "g1", legacyUserId: 1, tenantId: "t1", email: "one@example.com", fullName: "One", isActive: true }],
  memberships: [{ id: 1, userId: "g1", orgId: "s1", role: "school_staff", status: "active", isDefault: true }],
  scopes: [],
  partnerships: [],
};

const exactAccess = {
  tenantId: "t1",
  permissions: ["trip.read"],
  workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
};

test("rehearsal builds a plan and exact parity report without writes", async () => {
  let legacyCalls = 0;
  let canonicalCalls = 0;
  const result = await rehearseAccessMigration({
    legacySnapshot: snapshot,
    legacyUsers: [{ id: 1, email: "one@example.com", role: "school_staff" }],
    resolveLegacyAccess: async () => {
      legacyCalls += 1;
      return exactAccess;
    },
    resolveCanonicalAccessFromPlan: async ({ plan, identity }) => {
      canonicalCalls += 1;
      assert.equal(plan.appUsers.length, 1);
      assert.equal(identity.id, "1");
      return exactAccess;
    },
  });

  assert.equal(result.mode, "READ_ONLY_REHEARSAL");
  assert.equal(result.writesPerformed, false);
  assert.equal(result.plan.counts.appUsers, 1);
  assert.equal(result.plan.counts.roleAssignments, 1);
  assert.equal(result.parity.cutoverReady, true);
  assert.equal(legacyCalls, 1);
  assert.equal(canonicalCalls, 1);
});

test("rehearsal exposes a canonical access expansion as unsafe", async () => {
  const result = await rehearseAccessMigration({
    legacySnapshot: snapshot,
    legacyUsers: [{ id: 1, email: "one@example.com", role: "school_staff" }],
    resolveLegacyAccess: async () => exactAccess,
    resolveCanonicalAccessFromPlan: async () => ({
      ...exactAccess,
      workspaces: [
        ...exactAccess.workspaces,
        { schoolId: "s2", permissions: ["trip.read"] },
      ],
    }),
  });

  assert.equal(result.parity.safe, false);
  assert.equal(result.parity.cutoverReady, false);
  assert.equal(result.parity.issueCounts.CANONICAL_EXTRA_WORKSPACE, 1);
});

test("rehearsal validates required dependencies before doing work", async () => {
  await assert.rejects(
    rehearseAccessMigration({ legacySnapshot: snapshot, legacyUsers: [] }),
    /resolveLegacyAccess is required/,
  );
});
