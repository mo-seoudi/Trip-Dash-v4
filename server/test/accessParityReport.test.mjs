import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAccessParityCutoverReady,
  buildAccessParityReport,
} from "../src/services/accessParityReport.js";

const workspace = (schoolId, permissions = ["trip.read"]) => ({ schoolId, permissions });
const access = ({ tenantId = "t1", permissions = ["trip.read"], workspaces = [] } = {}) => ({
  tenantId,
  permissions,
  workspaces,
});
const row = (legacyAccess, canonicalAccess, id = "1") => ({
  identity: { id, email: `u${id}@example.com` },
  legacyAccess,
  canonicalAccess,
});

test("exact parity is safe and cutover-ready", () => {
  const same = access({ workspaces: [workspace("s1", ["trip.read", "trip.create"])] });
  const report = buildAccessParityReport([row(same, same)]);
  assert.equal(report.safe, true);
  assert.equal(report.exact, true);
  assert.equal(report.cutoverReady, true);
  assert.equal(report.counts.nonExactUsers, 0);
  assert.deepEqual(report.issueCounts, {});
});

test("security expansion blocks cutover and identifies affected user", () => {
  const report = buildAccessParityReport([
    row(
      access({ workspaces: [workspace("s1")] }),
      access({ workspaces: [workspace("s1"), workspace("s2")] }),
    ),
  ]);
  assert.equal(report.safe, false);
  assert.equal(report.cutoverReady, false);
  assert.equal(report.counts.unsafeUsers, 1);
  assert.equal(report.issueCounts.CANONICAL_EXTRA_WORKSPACE, 1);
  assert.equal(report.users[0].identity.email, "u1@example.com");
});

test("missing canonical access is safe but still blocks exact cutover", () => {
  const report = buildAccessParityReport([
    row(
      access({ workspaces: [workspace("s1"), workspace("s2")] }),
      access({ workspaces: [workspace("s1")] }),
    ),
  ]);
  assert.equal(report.safe, true);
  assert.equal(report.exact, false);
  assert.equal(report.cutoverReady, false);
  assert.equal(report.issueCounts.CANONICAL_MISSING_WORKSPACE, 1);
});

test("empty comparison set can never be declared cutover-ready", () => {
  const report = buildAccessParityReport([]);
  assert.equal(report.safe, true);
  assert.equal(report.exact, true);
  assert.equal(report.cutoverReady, false);
});

test("cutover assertion distinguishes expansion from safe mismatch", () => {
  assert.throws(
    () => assertAccessParityCutoverReady([
      row(access({ workspaces: [workspace("s1")] }), access({ workspaces: [workspace("s1"), workspace("s2")]) }),
    ]),
    (error) => error.code === "ACCESS_PARITY_SECURITY_EXPANSION",
  );

  assert.throws(
    () => assertAccessParityCutoverReady([
      row(access({ workspaces: [workspace("s1"), workspace("s2")] }), access({ workspaces: [workspace("s1")]) }),
    ]),
    (error) => error.code === "ACCESS_PARITY_NOT_EXACT",
  );
});
