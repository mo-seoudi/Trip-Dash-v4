import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS, ROLE_KEYS, ROLE_PERMISSION_CATALOG } from "../src/services/accessCatalog.js";
import { buildControlPlaneReferenceSeed } from "../src/services/controlPlaneSeed.js";

test("control-plane seed exactly covers canonical roles and permissions", () => {
  const seed = buildControlPlaneReferenceSeed();
  assert.deepEqual(
    new Set(seed.permissions.map((row) => row.key)),
    new Set(Object.values(PERMISSIONS)),
  );
  assert.deepEqual(
    new Set(seed.roles.map((row) => row.key)),
    new Set(Object.values(ROLE_KEYS)),
  );
});

test("each seeded system role uses the application permission catalog exactly", () => {
  const seed = buildControlPlaneReferenceSeed();
  for (const role of seed.roles) {
    assert.equal(role.isSystem, true);
    assert.deepEqual(
      new Set(role.permissions),
      new Set(ROLE_PERMISSION_CATALOG[role.key]),
    );
  }
});

test("bus operator seed retains operational access without passenger permissions", () => {
  const seed = buildControlPlaneReferenceSeed();
  const role = seed.roles.find((row) => row.key === ROLE_KEYS.BUS_OPERATOR);
  assert.ok(role.permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_MANAGE));
  assert.equal(role.permissions.includes(PERMISSIONS.PASSENGER_READ), false);
  assert.equal(role.permissions.includes(PERMISSIONS.PASSENGER_MANAGE), false);
});
