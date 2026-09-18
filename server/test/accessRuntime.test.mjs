import test from "node:test";
import assert from "node:assert/strict";

import { accessRuntimeMode, canonicalShadowEnabled, resolveRuntimeAccess } from "../src/services/accessRuntime.js";

const legacy = {
  tenantId: "t1",
  permissions: ["trip.read"],
  workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
};

test("runtime mode defaults to canonical and requires explicit legacy or shadow mode", () => {
  assert.equal(accessRuntimeMode({}), "canonical");
  assert.equal(accessRuntimeMode({ CANONICAL_ACCESS_SHADOW: "TRUE" }), "canonical");
  assert.equal(accessRuntimeMode({ ACCESS_RUNTIME_MODE: "canonical" }), "canonical");
  assert.equal(accessRuntimeMode({ ACCESS_RUNTIME_MODE: "shadow" }), "shadow");
  assert.equal(accessRuntimeMode({ ACCESS_RUNTIME_MODE: "legacy" }), "legacy");
  assert.equal(canonicalShadowEnabled({ ACCESS_RUNTIME_MODE: "shadow" }), true);
});

test("runtime skips canonical database entirely in legacy mode", async () => {
  let canonicalCalls = 0;
  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "user@example.com" }, legacyPrisma: { marker: "legacy" }, controlPrisma: null,
    mode: "legacy", resolveLegacy: async () => legacy,
    resolveCanonical: async () => { canonicalCalls += 1; throw new Error("must not run"); },
  });
  assert.equal(result, legacy);
  assert.equal(canonicalCalls, 0);
});

test("runtime shadow reports canonical mismatch but legacy remains authoritative", async () => {
  let report;
  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "private@example.com" }, legacyPrisma: {}, controlPrisma: {}, mode: "shadow",
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => ({ ...legacy, workspaces: [{ schoolId: "s1", permissions: ["trip.read", "passenger.read"] }] }),
    onShadowResult: async (value) => { report = value; },
  });
  assert.equal(result, legacy);
  assert.equal(report.safe, false);
  assert.equal(report.exact, false);
  assert.deepEqual(report.issueCodes, ["CANONICAL_EXTRA_WORKSPACE_PERMISSION"]);
  assert.equal(JSON.stringify(report).includes("private@example.com"), false);
});

test("canonical shadow failure never changes legacy authorization", async () => {
  let failure;
  const result = await resolveRuntimeAccess({
    user: { id: 7 }, legacyPrisma: {}, controlPrisma: {}, mode: "shadow",
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => { throw Object.assign(new Error("control unavailable"), { code: "CONTROL_DOWN" }); },
    onShadowError: async (value) => { failure = value; },
  });
  assert.equal(result, legacy);
  assert.deepEqual(failure, { userId: "7", code: "CONTROL_DOWN" });
});

test("canonical mode uses only canonical control-plane access", async () => {
  const canonical = { permissions: ["trip.read"], workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }] };
  let legacyCalls = 0;
  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "user@example.com" }, legacyPrisma: null, controlPrisma: {}, mode: "canonical",
    resolveLegacy: async () => { legacyCalls += 1; throw new Error("legacy must not run"); },
    resolveCanonical: async (_prisma, identity) => {
      assert.deepEqual(identity, { id: "7", email: "user@example.com" });
      return canonical;
    },
  });
  assert.equal(result, canonical);
  assert.equal(legacyCalls, 0);
});

test("canonical mode does not require runtime parity with legacy", async () => {
  let legacyCalls = 0;
  const canonical = { permissions: [], workspaces: [] };
  const result = await resolveRuntimeAccess({
    user: { id: 7 }, legacyPrisma: {}, controlPrisma: {}, mode: "canonical",
    resolveLegacy: async () => { legacyCalls += 1; return legacy; },
    resolveCanonical: async () => canonical,
  });
  assert.equal(result, canonical);
  assert.equal(legacyCalls, 0);
});

test("canonical mode fails closed if the control plane is unavailable", async () => {
  await assert.rejects(
    resolveRuntimeAccess({
      user: { id: 7 }, legacyPrisma: null, controlPrisma: {}, mode: "canonical",
      resolveCanonical: async () => { throw new Error("control unavailable"); },
    }),
    (error) => error?.code === "CANONICAL_ACCESS_UNAVAILABLE" && error?.status === 503,
  );
});
