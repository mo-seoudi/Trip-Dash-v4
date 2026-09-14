import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoAccessExpansion,
  compareEffectiveAccessParity,
} from "../src/services/accessParity.js";

function workspace(schoolId, permissions = []) {
  return { schoolId, permissions };
}

function access({ tenantId = "t1", permissions = [], workspaces = [] } = {}) {
  return { tenantId, permissions, workspaces };
}

test("exact legacy-v2 match is safe and exact", () => {
  const legacy = access({
    permissions: ["trip.read"],
    workspaces: [workspace("s1", ["trip.read", "trip.create"])],
  });
  const canonical = access({
    permissions: ["trip.read"],
    workspaces: [workspace("s1", ["trip.create", "trip.read"])],
  });

  const result = compareEffectiveAccessParity(legacy, canonical);
  assert.equal(result.safe, true);
  assert.equal(result.exact, true);
  assert.deepEqual(result.issues, []);
});

test("canonical extra school is a security expansion", () => {
  const legacy = access({ workspaces: [workspace("s1", ["trip.read"])] });
  const canonical = access({
    workspaces: [workspace("s1", ["trip.read"]), workspace("s2", ["trip.read"])],
  });

  const result = compareEffectiveAccessParity(legacy, canonical);
  assert.equal(result.safe, false);
  assert.equal(result.exact, false);
  assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_WORKSPACE" && issue.schoolId === "s2"));
  assert.throws(
    () => assertNoAccessExpansion(legacy, canonical),
    (error) => error.code === "ACCESS_PARITY_SECURITY_EXPANSION",
  );
});

test("canonical extra workspace permission is a security expansion", () => {
  const legacy = access({ workspaces: [workspace("s1", ["trip.read"])] });
  const canonical = access({ workspaces: [workspace("s1", ["trip.read", "passenger.read"])] });

  const result = compareEffectiveAccessParity(legacy, canonical);
  assert.equal(result.safe, false);
  assert.deepEqual(result.securityExpansions[0], {
    code: "CANONICAL_EXTRA_WORKSPACE_PERMISSION",
    schoolId: "s1",
    permissions: ["passenger.read"],
  });
});

test("canonical extra global permission is a security expansion", () => {
  const legacy = access({ permissions: ["trip.read"] });
  const canonical = access({ permissions: ["trip.read", "access.admin"] });

  const result = compareEffectiveAccessParity(legacy, canonical);
  assert.equal(result.safe, false);
  assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_GLOBAL_PERMISSION"));
});

test("missing canonical access is not a security expansion but blocks exact cutover parity", () => {
  const legacy = access({
    permissions: ["trip.read", "trip.create"],
    workspaces: [workspace("s1", ["trip.read", "trip.create"]), workspace("s2", ["trip.read"])],
  });
  const canonical = access({
    permissions: ["trip.read"],
    workspaces: [workspace("s1", ["trip.read"])],
  });

  const result = compareEffectiveAccessParity(legacy, canonical);
  assert.equal(result.safe, true);
  assert.equal(result.exact, false);
  assert.ok(result.issues.some((issue) => issue.code === "CANONICAL_MISSING_WORKSPACE" && issue.schoolId === "s2"));
  assert.ok(result.issues.some((issue) => issue.code === "CANONICAL_MISSING_WORKSPACE_PERMISSION"));
  assert.ok(result.issues.some((issue) => issue.code === "CANONICAL_MISSING_GLOBAL_PERMISSION"));
  assert.doesNotThrow(() => assertNoAccessExpansion(legacy, canonical));
});

test("tenant mismatch is reported and prevents exact parity", () => {
  const result = compareEffectiveAccessParity(
    access({ tenantId: "t1" }),
    access({ tenantId: "t2" }),
  );

  assert.equal(result.safe, true);
  assert.equal(result.exact, false);
  assert.deepEqual(result.issues[0], {
    code: "TENANT_MISMATCH",
    legacyTenantId: "t1",
    canonicalTenantId: "t2",
  });
});
