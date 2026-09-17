import test from "node:test";
import assert from "node:assert/strict";

import {
  assertControlPlaneBackfillVerified,
  verifyControlPlaneBackfill,
} from "../src/services/controlPlanePostWriteVerification.js";

const users = [{ id: "u1", email: "private@example.com" }];
const exact = {
  tenantId: "t1",
  permissions: ["trip.read"],
  workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
};

test("post-write verification declares exact access cutover-ready without exposing email", async () => {
  const result = await verifyControlPlaneBackfill({
    legacyUsers: users,
    resolveLegacyAccess: async () => exact,
    resolveCanonicalAccess: async () => exact,
  });

  assert.equal(result.writesPerformed, false);
  assert.equal(result.cutoverReady, true);
  assert.deepEqual(result.report.users[0].identity, { id: "u1" });
  assert.equal(JSON.stringify(result).includes("private@example.com"), false);
});

test("post-write verification blocks canonical passenger permission expansion", async () => {
  const canonical = {
    ...exact,
    workspaces: [{ schoolId: "s1", permissions: ["trip.read", "passenger.read"] }],
  };

  await assert.rejects(
    assertControlPlaneBackfillVerified({
      legacyUsers: users,
      resolveLegacyAccess: async () => exact,
      resolveCanonicalAccess: async () => canonical,
    }),
    (error) => error.code === "CONTROL_VERIFY_SECURITY_EXPANSION",
  );
});

test("post-write verification ignores tenant coverage mismatch for operational cutover", async () => {
  const result = await assertControlPlaneBackfillVerified({
    legacyUsers: users,
    resolveLegacyAccess: async () => exact,
    resolveCanonicalAccess: async () => ({ ...exact, tenantId: "t2" }),
  });

  assert.equal(result.cutoverReady, true);
  assert.equal(result.report.hasSecurityExpansion, false);
});

test("post-write verification refuses an empty user set", async () => {
  await assert.rejects(
    verifyControlPlaneBackfill({
      legacyUsers: [],
      resolveLegacyAccess: async () => exact,
      resolveCanonicalAccess: async () => exact,
    }),
    (error) => error.code === "CONTROL_VERIFY_EMPTY_USER_SET",
  );
});
