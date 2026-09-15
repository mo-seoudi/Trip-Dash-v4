import test from "node:test";
import assert from "node:assert/strict";

import { canonicalShadowEnabled, resolveRuntimeAccess } from "../src/services/accessRuntime.js";

const legacy = {
  tenantId: "t1",
  permissions: ["trip.read"],
  workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
};

test("canonical shadow is explicit opt-in only", () => {
  assert.equal(canonicalShadowEnabled({}), false);
  assert.equal(canonicalShadowEnabled({ CANONICAL_ACCESS_SHADOW: "false" }), false);
  assert.equal(canonicalShadowEnabled({ CANONICAL_ACCESS_SHADOW: "TRUE" }), true);
});

test("runtime skips canonical database entirely while shadow is disabled", async () => {
  let canonicalCalls = 0;
  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "user@example.com" },
    legacyPrisma: { marker: "legacy" },
    controlPrisma: null,
    shadowEnabled: false,
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => { canonicalCalls += 1; throw new Error("must not run"); },
  });
  assert.equal(result, legacy);
  assert.equal(canonicalCalls, 0);
});

test("runtime shadow reports canonical mismatch but legacy remains authoritative", async () => {
  let report;
  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "private@example.com" },
    legacyPrisma: {},
    controlPrisma: {},
    shadowEnabled: true,
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => ({
      ...legacy,
      workspaces: [{ schoolId: "s1", permissions: ["trip.read", "passenger.read"] }],
    }),
    onShadowResult: async (value) => { report = value; },
  });
  assert.equal(result, legacy);
  assert.equal(report.safe, false);
  assert.equal(report.exact, false);
  assert.deepEqual(report.issueCodes, ["CANONICAL_EXTRA_WORKSPACE_PERMISSION"]);
  assert.equal(JSON.stringify(report).includes("private@example.com"), false);
});

test("canonical shadow failure never denies or broadens legacy authorization", async () => {
  let failure;
  const result = await resolveRuntimeAccess({
    user: { id: 7 },
    legacyPrisma: {},
    controlPrisma: {},
    shadowEnabled: true,
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => { throw Object.assign(new Error("control unavailable"), { code: "CONTROL_DOWN" }); },
    onShadowError: async (value) => { failure = value; },
  });
  assert.equal(result, legacy);
  assert.deepEqual(failure, { userId: "7", code: "CONTROL_DOWN" });
});
