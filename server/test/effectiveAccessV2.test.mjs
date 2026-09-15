import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../src/services/accessCatalog.js";
import { resolveEffectiveAccessV2 } from "../src/services/effectiveAccessV2.js";

function fakePrisma({ user, relationships = [], schools = [] }) { return { appUser: { findFirst: async () => user }, organizationRelationship: { findMany: async ({ where }) => relationships.filter((row) => row.toOrganizationId === where.toOrganizationId && row.type === where.type) }, organization: { findMany: async ({ where }) => schools.filter((row) => row.tenantId === where.tenantId && row.type === where.type && row.status === where.status) } }; }
const school = (id, name = id) => ({ id, tenantId: "t1", type: "SCHOOL", displayName: name, fullName: name, abbreviation: id.toUpperCase(), parentId: null, status: "active" });
const org = (id, type) => ({ id, tenantId: "t1", type, displayName: id, fullName: id, abbreviation: null, parentId: null, status: "active" });
function activeUser({ memberships = [], assignments = [] } = {}) { return { id: "u1", legacyUserId: 7, email: "u@example.com", displayName: "User", status: "active", memberships, roleAssignments: assignments }; }
function membership(organization) { return { organizationId: organization.id, status: "ACTIVE", organization }; }
function assignment(role, organization) { return { isActive: true, scopeType: "ORGANIZATION", organizationId: organization.id, tenantId: null, role: { key: role }, organization, tenant: null }; }

test("direct school assignment resolves only that school and its permissions", async () => {
  const s1 = school("s1", "School One"); const prisma = fakePrisma({ user: activeUser({ memberships: [membership(s1)], assignments: [assignment("school_staff", s1)] }) });
  const access = await resolveEffectiveAccessV2(prisma, { id: 7, email: "u@example.com" }); assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["s1"]); assert.deepEqual(access.organizations.map((row) => row.id), ["s1"]); assert.ok(access.workspaces[0].permissions.includes(PERMISSIONS.TRIP_CREATE)); assert.equal(access.workspaces[0].permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_MANAGE), false);
});

test("direct group remains visible while its linked schools become workspaces", async () => {
  const group = org("g1", "SCHOOL_GROUP"); const s1 = school("s1");
  const prisma = fakePrisma({ user: activeUser({ memberships: [membership(group)], assignments: [assignment("group_staff", group)] }), relationships: [{ toOrganizationId: "g1", type: "BELONGS_TO_GROUP", status: "active", fromOrganization: s1 }] });
  const access = await resolveEffectiveAccessV2(prisma, { id: 7 }); assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["s1"]); assert.deepEqual(new Set(access.organizations.map((row) => row.id)), new Set(["g1", "s1"]));
});

test("restrictive school assignment remains valid through same-tenant group membership", async () => {
  const group = org("g1", "SCHOOL_GROUP"); const s1 = school("s1"); const prisma = fakePrisma({ user: activeUser({ memberships: [membership(group)], assignments: [assignment("school_staff", s1)] }) });
  const access = await resolveEffectiveAccessV2(prisma, { id: 7, email: "u@example.com" }); assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["s1"]);
});

test("bus operator reaches only schools linked by active transport relationship and remains visible", async () => {
  const operator = org("b1", "BUS_OPERATOR"); const s1 = school("s1"); const s2 = school("s2"); const prisma = fakePrisma({ user: activeUser({ memberships: [membership(operator)], assignments: [assignment("bus_operator", operator)] }), relationships: [{ toOrganizationId: "b1", type: "TRANSPORT_PROVIDER", status: "active", fromOrganization: s1 }, { toOrganizationId: "b1", type: "TRANSPORT_PROVIDER", status: "inactive", fromOrganization: s2 }] });
  const access = await resolveEffectiveAccessV2(prisma, { id: 7, email: "u@example.com" }); assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["s1"]); assert.deepEqual(new Set(access.organizations.map((row) => row.id)), new Set(["b1", "s1"])); assert.ok(access.workspaces[0].permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_MANAGE)); assert.equal(access.workspaces[0].permissions.includes(PERMISSIONS.PASSENGER_READ), false);
});

test("service partner requires active TRIP_MANAGER relationship", async () => {
  const partner = org("p1", "SERVICE_PARTNER"); const s1 = school("s1"); const prisma = fakePrisma({ user: activeUser({ memberships: [membership(partner)], assignments: [assignment("service_partner", partner)] }), relationships: [{ toOrganizationId: "p1", type: "TRIP_MANAGER", status: "active", fromOrganization: s1 }] });
  const access = await resolveEffectiveAccessV2(prisma, { id: 7, email: "u@example.com" }); assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["s1"]); assert.equal(access.workspaces[0].permissions.includes(PERMISSIONS.PASSENGER_READ), false);
});

test("inactive user receives no canonical access", async () => {
  const prisma = fakePrisma({ user: { ...activeUser(), status: "inactive" } }); const access = await resolveEffectiveAccessV2(prisma, { id: 7, email: "u@example.com" }); assert.deepEqual(access.workspaces, []); assert.deepEqual(access.organizations, []); assert.deepEqual(access.permissions, []); assert.equal(access.portfolio.enabled, false);
});
