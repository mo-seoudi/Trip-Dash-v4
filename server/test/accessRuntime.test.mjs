import test from "node:test";
import assert from "node:assert/strict";

import { resolveRuntimeAccess } from "../src/services/accessRuntime.js";

test("runtime uses only canonical control-plane access", async () => {
  const canonical = {
    permissions: ["trip.read"],
    workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
  };

  const result = await resolveRuntimeAccess({
    user: { id: 7, email: "user@example.com" },
    controlPrisma: {},
    resolveCanonical: async (_prisma, identity) => {
      assert.deepEqual(identity, { id: "7", email: "user@example.com" });
      return canonical;
    },
  });

  assert.equal(result, canonical);
});

test("runtime forwards the evaluation time to canonical access", async () => {
  const now = new Date("2026-09-19T00:00:00.000Z");
  let receivedNow;

  await resolveRuntimeAccess({
    user: { id: 7 },
    controlPrisma: {},
    now,
    resolveCanonical: async (_prisma, _identity, options) => {
      receivedNow = options.now;
      return { permissions: [], workspaces: [] };
    },
  });

  assert.equal(receivedNow, now);
});

test("runtime fails closed when the control plane client is unavailable", async () => {
  await assert.rejects(
    resolveRuntimeAccess({ user: { id: 7 }, controlPrisma: null }),
    (error) => error?.code === "CANONICAL_ACCESS_UNAVAILABLE" && error?.status === 503,
  );
});

test("runtime fails closed when canonical access resolution fails", async () => {
  await assert.rejects(
    resolveRuntimeAccess({
      user: { id: 7 },
      controlPrisma: {},
      resolveCanonical: async () => { throw new Error("control unavailable"); },
    }),
    (error) => error?.code === "CANONICAL_ACCESS_UNAVAILABLE" && error?.status === 503,
  );
});
