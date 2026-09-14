import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAccessV2BackfillPlan,
  canonicalMembershipStatus,
  planRoleAssignments,
} from "../src/services/accessV2BackfillPlan.js";

test("legacy membership statuses map without granting blocked users active access", () => {
  assert.equal(canonicalMembershipStatus("approved"), "ACTIVE");
  assert.equal(canonicalMembershipStatus("active"), "ACTIVE");
  assert.equal(canonicalMembershipStatus("pending"), "PENDING");
  assert.equal(canonicalMembershipStatus("blocked"), "SUSPENDED");
  assert.equal(canonicalMembershipStatus("revoked"), "REVOKED");
});

test("explicit school scopes remain restrictive canonical organization assignments", () => {
  const assignments = planRoleAssignments(
    [{ userId: "u1", orgId: "group1", role: "staff", status: "approved" }],
    [
      { userId: "u1", orgId: "group1", role: "staff", schoolOrgId: "school1" },
      { userId: "u1", orgId: "group1", role: "staff", schoolOrgId: "school2" },
    ],
  );

  assert.deepEqual(assignments.map((row) => row.organizationId).sort(), ["school1", "school2"]);
  assert.ok(assignments.every((row) => row.scopeType === "ORGANIZATION"));
  assert.ok(assignments.every((row) => row.roleKey === "school_staff"));
});

test("unscoped active membership remains organization-scoped and inactive membership grants nothing", () => {
  const assignments = planRoleAssignments([
    { userId: "u1", orgId: "operator1", role: "bus_company", status: "approved" },
    { userId: "u2", orgId: "school1", role: "school_staff", status: "blocked" },
  ]);

  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].organizationId, "operator1");
  assert.equal(assignments[0].roleKey, "bus_operator");
});

test("backfill preserves ids, canonicalizes organization types, deduplicates memberships and creates relationships", () => {
  const result = buildAccessV2BackfillPlan({
    tenants: [{ id: "t1", name: "Tenant", slug: "tenant" }],
    organizations: [
      { id: "g1", tenantId: "t1", type: "edu_group", name: "Group", slug: "group" },
      { id: "s1", tenantId: "t1", type: "school", name: "School", code: "SCH", slug: "school", parentOrgId: "g1" },
      { id: "b1", tenantId: "t1", type: "bus_company", name: "Operator", slug: "operator" },
    ],
    users: [{ id: "u1", email: "u@example.com", fullName: "User", isActive: true, legacyUserId: 7 }],
    memberships: [
      { userId: "u1", orgId: "s1", role: "school_staff", status: "approved", isDefault: true },
      { userId: "u1", orgId: "s1", role: "finance", status: "approved", isDefault: false },
    ],
    partnerships: [{ id: "p1", schoolOrgId: "s1", busCompanyOrgId: "b1", status: "active" }],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.organizations.find((row) => row.id === "b1").type, "BUS_OPERATOR");
  assert.equal(result.organizations.find((row) => row.id === "s1").parentId, "g1");
  assert.equal(result.users[0].id, "u1");
  assert.equal(result.users[0].legacyUserId, 7);
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].isPrimary, true);
  assert.deepEqual(new Set(result.roleAssignments.map((row) => row.roleKey)), new Set(["school_staff", "finance"]));
  assert.deepEqual(new Set(result.relationships.map((row) => row.type)), new Set(["BELONGS_TO_GROUP", "TRANSPORT_PROVIDER"]));
});

test("plan validation fails closed on dangling references", () => {
  const result = buildAccessV2BackfillPlan({
    tenants: [{ id: "t1", name: "Tenant", slug: "tenant" }],
    organizations: [{ id: "s1", tenantId: "missing", type: "school", name: "School", slug: "school" }],
    users: [],
    memberships: [{ userId: "missing-user", orgId: "s1", role: "school_staff", status: "approved" }],
  });

  assert.ok(result.errors.some((error) => error.includes("missing tenant")));
  assert.ok(result.errors.some((error) => error.includes("missing user")));
});
