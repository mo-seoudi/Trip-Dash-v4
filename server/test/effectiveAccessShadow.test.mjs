import test from "node:test";
import assert from "node:assert/strict";

import { resolveEffectiveAccessShadow } from "../src/services/effectiveAccessShadow.js";

const legacy = {
  tenantId: "t1",
  permissions: ["trip.read"],
  workspaces: [{ schoolId: "s1", permissions: ["trip.read"] }],
};

const canonical = structuredClone(legacy);

test("shadow mode always returns legacy as the authoritative access decision", async () => {
  const legacyPrisma = { marker: "legacy" };
  const controlPrisma = { marker: "control" };
  let legacyClient;
  let controlClient;

  const result = await resolveEffectiveAccessShadow({
    legacyPrisma,
    controlPrisma,
    legacyUser: { id: 7, email: "user@example.com" },
    resolveLegacy: async (client) => { legacyClient = client; return legacy; },
    resolveCanonical: async (client) => { controlClient = client; return canonical; },
  });

  assert.equal(legacyClient, legacyPrisma);
  assert.equal(controlClient, controlPrisma);
  assert.equal(result.authoritativeSource, "legacy");
  assert.equal(result.access, legacy);
  assert.equal(result.shadow.safe, true);
  assert.equal(result.shadow.exact, true);
});

test("canonical expansion is reported but never becomes the access decision", async () => {
  const expanded = {
    ...canonical,
    permissions: ["trip.read", "passenger.read"],
  };
  const result = await resolveEffectiveAccessShadow({
    legacyPrisma: {},
    controlPrisma: {},
    legacyUser: { id: 7 },
    resolveLegacy: async () => legacy,
    resolveCanonical: async () => expanded,
  });

  assert.equal(result.access, legacy);
  assert.equal(result.shadow.safe, false);
  assert.equal(result.shadow.exact, false);
  assert.equal(result.shadow.issues[0].code, "CANONICAL_EXTRA_GLOBAL_PERMISSION");
});

test("shadow mode fails closed when either database boundary is missing", async () => {
  await assert.rejects(
    resolveEffectiveAccessShadow({ controlPrisma: {}, legacyUser: { id: 7 } }),
    /legacy global Prisma client is required/,
  );
  await assert.rejects(
    resolveEffectiveAccessShadow({ legacyPrisma: {}, legacyUser: { id: 7 } }),
    /canonical control-plane Prisma client is required/,
  );
});
