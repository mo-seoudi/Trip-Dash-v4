import test from "node:test";
import assert from "node:assert/strict";
import { assertNoAccessExpansion, compareEffectiveAccessParity } from "../src/services/accessParity.js";

function workspace(schoolId, permissions = [], roles = []) { return { schoolId, permissions, roles }; }
function organization(id) { return { id }; }
function access({ tenantId = "t1", permissions = [], workspaces = [], organizations = [] } = {}) { return { tenantId, permissions, workspaces, organizations }; }

test("exact legacy-v2 match is safe and exact", () => {
  const legacy = access({ permissions: ["trip.read"], organizations: [organization("s1")], workspaces: [workspace("s1", ["trip.read", "trip.create"], ["school_staff"])] });
  const canonical = access({ permissions: ["trip.read"], organizations: [organization("s1")], workspaces: [workspace("s1", ["trip.create", "trip.read"], ["school_staff"])] });
  const result = compareEffectiveAccessParity(legacy, canonical); assert.equal(result.safe, true); assert.equal(result.exact, true); assert.deepEqual(result.issues, []);
});

test("canonical extra school is a security expansion", () => {
  const legacy = access({ workspaces: [workspace("s1", ["trip.read"])] });
  const canonical = access({ workspaces: [workspace("s1", ["trip.read"]), workspace("s2", ["trip.read"])] });
  const result = compareEffectiveAccessParity(legacy, canonical); assert.equal(result.safe, false); assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_WORKSPACE" && issue.schoolId === "s2"));
  assert.throws(() => assertNoAccessExpansion(legacy, canonical), (error) => error.code === "ACCESS_PARITY_SECURITY_EXPANSION");
});

test("canonical extra workspace permission is a security expansion", () => {
  const result = compareEffectiveAccessParity(access({ workspaces: [workspace("s1", ["trip.read"])] }), access({ workspaces: [workspace("s1", ["trip.read", "passenger.read"])] }));
  assert.equal(result.safe, false); assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_WORKSPACE_PERMISSION"));
});

test("workspace role widening is detected even when permissions happen to match", () => {
  const result = compareEffectiveAccessParity(access({ workspaces: [workspace("s1", ["trip.read"], ["school_staff"])] }), access({ workspaces: [workspace("s1", ["trip.read"], ["school_staff", "tenant_admin"])] }));
  assert.equal(result.safe, false); assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_WORKSPACE_ROLE" && issue.roles.includes("tenant_admin")));
});

test("direct organization visibility expansion is detected", () => {
  const result = compareEffectiveAccessParity(access({ organizations: [organization("school-1")] }), access({ organizations: [organization("school-1"), organization("operator-1")] }));
  assert.equal(result.safe, false); assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_ORGANIZATION" && issue.organizationId === "operator-1"));
});

test("canonical extra global permission is a security expansion", () => {
  const result = compareEffectiveAccessParity(access({ permissions: ["trip.read"] }), access({ permissions: ["trip.read", "access.admin"] }));
  assert.equal(result.safe, false); assert.ok(result.securityExpansions.some((issue) => issue.code === "CANONICAL_EXTRA_GLOBAL_PERMISSION"));
});

test("missing canonical access is not expansion but blocks exact cutover parity", () => {
  const legacy = access({ permissions: ["trip.read", "trip.create"], organizations: [organization("s1"), organization("s2")], workspaces: [workspace("s1", ["trip.read", "trip.create"], ["school_staff"]), workspace("s2", ["trip.read"], ["school_staff"])] });
  const canonical = access({ permissions: ["trip.read"], organizations: [organization("s1")], workspaces: [workspace("s1", ["trip.read"], ["school_staff"])] });
  const result = compareEffectiveAccessParity(legacy, canonical); assert.equal(result.safe, true); assert.equal(result.exact, false); assert.ok(result.issues.some((issue) => issue.code === "CANONICAL_MISSING_ORGANIZATION")); assert.ok(result.issues.some((issue) => issue.code === "CANONICAL_MISSING_WORKSPACE")); assert.doesNotThrow(() => assertNoAccessExpansion(legacy, canonical));
});

test("tenant mismatch is a security isolation failure", () => {
  const result = compareEffectiveAccessParity(access({ tenantId: "t1" }), access({ tenantId: "t2" })); assert.equal(result.safe, false); assert.equal(result.exact, false);
  assert.ok(result.securityExpansions.some((issue) => issue.code === "TENANT_MISMATCH"));
});
