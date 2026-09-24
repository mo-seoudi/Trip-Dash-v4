import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../src/services/accessCatalog.js";
import { resolveEffectiveAccess } from "../src/services/effectiveAccess.js";
import { workspaceFromAccess } from "../src/services/workspaceOperationalContext.js";

const operator = { id: "sts", type: "BUS_OPERATOR", displayName: "STS", fullName: "STS", abbreviation: "STS", status: "active" };
const school = (id, name) => ({ id, type: "SCHOOL", displayName: name, fullName: name, abbreviation: id.toUpperCase(), status: "active" });
const rdx = school("rdxb", "Repton Dubai");
const testSchool = school("test-school", "Test School");

function user() {
  return {
    id: "luke", legacyUserId: 77, email: "luke@example.com", displayName: "Luke Mann", status: "active",
    memberships: [{ organizationId: operator.id, status: "ACTIVE", organization: operator }],
    roleAssignments: [{ isActive: true, scopeType: "ORGANIZATION", organizationId: operator.id, tenantId: null, role: { key: "bus_operator" }, organization: operator, tenant: null }],
  };
}

function fakePrisma(relationships) {
  return {
    appUser: { findFirst: async () => user() },
    organizationRelationship: {
      findMany: async ({ where }) => relationships.filter((row) => {
        if (row.type !== where.type) return false;
        if (where.toOrganizationId !== undefined && row.toOrganizationId !== where.toOrganizationId) return false;
        if (where.fromOrganizationId !== undefined && row.fromOrganizationId !== where.fromOrganizationId) return false;
        return true;
      }),
    },
  };
}

test("bus operator receives every actively linked school with operator permissions", async () => {
  const relationships = [
    { fromOrganizationId: rdx.id, toOrganizationId: operator.id, type: "TRANSPORT_PROVIDER", status: "active", fromOrganization: rdx, toOrganization: operator },
    { fromOrganizationId: testSchool.id, toOrganizationId: operator.id, type: "TRANSPORT_PROVIDER", status: "active", fromOrganization: testSchool, toOrganization: operator },
  ];
  const access = await resolveEffectiveAccess(fakePrisma(relationships), { id: 77, email: "luke@example.com" });
  assert.deepEqual(access.workspaces.map((row) => row.schoolId).sort(), [rdx.id, testSchool.id].sort());
  for (const workspace of access.workspaces) {
    assert.deepEqual(workspace.roles, ["bus_operator"]);
    assert.ok(workspace.permissions.includes(PERMISSIONS.TRIP_READ));
    assert.ok(workspace.permissions.includes(PERMISSIONS.TRIP_READ_ALL));
    assert.ok(workspace.permissions.includes(PERMISSIONS.TRIP_RESPOND));
    assert.ok(workspace.permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_READ));
    assert.ok(workspace.permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_MANAGE));
    assert.equal(workspace.permissions.includes(PERMISSIONS.TRIP_CREATE), false);
    assert.equal(workspace.permissions.includes(PERMISSIONS.TRIP_EDIT_REQUEST), false);
  }
  assert.doesNotThrow(() => workspaceFromAccess(access, rdx.id, PERMISSIONS.BUS_ASSIGNMENT_MANAGE));
  assert.throws(() => workspaceFromAccess(access, rdx.id, PERMISSIONS.TRIP_CREATE), /permission/i);
});

test("legacy reversed transport-provider links remain readable during normalization", async () => {
  const relationships = [
    { fromOrganizationId: operator.id, toOrganizationId: rdx.id, type: "TRANSPORT_PROVIDER", status: "active", fromOrganization: operator, toOrganization: rdx },
    { fromOrganizationId: operator.id, toOrganizationId: testSchool.id, type: "TRANSPORT_PROVIDER", status: "active", fromOrganization: operator, toOrganization: testSchool },
  ];
  const access = await resolveEffectiveAccess(fakePrisma(relationships), { id: 77, email: "luke@example.com" });
  assert.deepEqual(access.workspaces.map((row) => row.schoolId).sort(), [rdx.id, testSchool.id].sort());
  assert.ok(access.workspaces.every((row) => row.access.some((entry) => entry.relationshipDirection === "legacy_reversed")));
});

test("inactive transport links do not grant bus operator school access", async () => {
  const relationships = [{ fromOrganizationId: operator.id, toOrganizationId: rdx.id, type: "TRANSPORT_PROVIDER", status: "inactive", fromOrganization: operator, toOrganization: rdx }];
  const access = await resolveEffectiveAccess(fakePrisma(relationships), { id: 77, email: "luke@example.com" });
  assert.deepEqual(access.workspaces, []);
});
