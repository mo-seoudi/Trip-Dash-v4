// Canonical effective-access resolver.
// Operational access is derived only from user -> organization membership ->
// role assignment -> organization relationships. Tenant scope is deliberately
// excluded from school workspace derivation; it is platform/commercial scope.
import { permissionsForRoles, ROLE_KEYS } from "./accessCatalog.js";

const activeStatus = (value) => String(value || "").trim().toLowerCase() === "active";
const activeMembership = (row) => String(row?.status || "").trim().toUpperCase() === "ACTIVE";
function activeRelationship(row, now = new Date()) {
  if (!activeStatus(row?.status)) return false;
  if (row.validFrom && new Date(row.validFrom) > now) return false;
  if (row.validUntil && new Date(row.validUntil) < now) return false;
  return true;
}
const roleKey = (assignment) => assignment?.role?.key || null;
const orgView = (org) => ({ id: org.id, type: org.type, displayName: org.displayName, fullName: org.fullName || org.displayName, abbreviation: org.abbreviation || null });
function addWorkspace(map, org, role, detail) {
  if (!org || org.type !== "SCHOOL" || !role) return;
  const current = map.get(org.id) || { organization: orgView(org), roles: new Set(), access: [] };
  current.roles.add(role);
  const signature = JSON.stringify(detail);
  if (!current.access.some((item) => JSON.stringify(item) === signature)) current.access.push(detail);
  map.set(org.id, current);
}
function addOrganization(map, org, detail) {
  if (!org) return;
  const current = map.get(org.id) || { organization: orgView(org), access: [] };
  const signature = JSON.stringify(detail);
  if (!current.access.some((item) => JSON.stringify(item) === signature)) current.access.push(detail);
  map.set(org.id, current);
}
function inheritedGroupRole(role) { if (role === ROLE_KEYS.FINANCE) return ROLE_KEYS.FINANCE; if (role === ROLE_KEYS.TENANT_ADMIN) return ROLE_KEYS.TENANT_ADMIN; return ROLE_KEYS.GROUP_STAFF; }
const inheritedOperatorRole = (role) => role === ROLE_KEYS.FINANCE ? ROLE_KEYS.FINANCE : ROLE_KEYS.BUS_OPERATOR;
const inheritedPartnerRole = (role) => role === ROLE_KEYS.FINANCE ? ROLE_KEYS.FINANCE : ROLE_KEYS.SERVICE_PARTNER;
async function activeChildrenOfGroups(prisma, groupIds, now) {
  const childIds = new Set();
  for (const groupId of groupIds) {
    const rows = await prisma.organizationRelationship.findMany({ where: { toOrganizationId: groupId, type: "BELONGS_TO_GROUP" }, include: { fromOrganization: true } });
    for (const row of rows.filter((item) => activeRelationship(item, now))) childIds.add(row.fromOrganizationId || row.fromOrganization?.id);
  }
  return childIds;
}
async function transportSchoolsForOperator(prisma, operatorId, now) {
  const canonical = await prisma.organizationRelationship.findMany({ where: { toOrganizationId: operatorId, type: "TRANSPORT_PROVIDER" }, include: { fromOrganization: true } });
  const legacyReversed = await prisma.organizationRelationship.findMany({ where: { fromOrganizationId: operatorId, type: "TRANSPORT_PROVIDER" }, include: { toOrganization: true } });
  const schools = [];
  for (const row of canonical.filter((item) => activeRelationship(item, now))) if (row.fromOrganization?.type === "SCHOOL") schools.push({ relationship: row, school: row.fromOrganization, direction: "canonical" });
  for (const row of legacyReversed.filter((item) => activeRelationship(item, now))) if (row.toOrganization?.type === "SCHOOL") schools.push({ relationship: row, school: row.toOrganization, direction: "legacy_reversed" });
  return schools;
}

export async function resolveEffectiveAccess(prisma, identity, { now = new Date() } = {}) {
  if (!prisma) throw new Error("Canonical control-plane Prisma client is required");
  const legacyUserId = Number(identity?.id);
  const email = String(identity?.email || "").trim();
  const selectors = [...(Number.isInteger(legacyUserId) && legacyUserId > 0 ? [{ legacyUserId }] : []), ...(email ? [{ email }] : [])];
  const empty = { source: "canonical", user: null, roles: [], permissions: [], organizations: [], workspaces: [], portfolio: { enabled: false, schoolCount: 0 } };
  if (!selectors.length) return empty;
  const user = await prisma.appUser.findFirst({ where: { OR: selectors }, include: { memberships: { include: { organization: true } }, roleAssignments: { include: { role: true, organization: true, tenant: true } } } });
  if (!user || !activeStatus(user.status)) return { ...empty, user: user ? { id: String(identity?.id || ""), appUserId: user.id, email: user.email, displayName: user.displayName } : null };
  const memberships = (user.memberships || []).filter(activeMembership);
  const memberOrgIds = new Set(memberships.map((item) => item.organizationId));
  const memberGroupIds = memberships.filter((item) => item.organization?.type === "SCHOOL_GROUP").map((item) => item.organizationId);
  const childSchoolIds = await activeChildrenOfGroups(prisma, memberGroupIds, now);
  const assignments = (user.roleAssignments || []).filter((item) => item.isActive && roleKey(item));
  const platformAssignments = assignments.filter((item) => item.scopeType === "PLATFORM");
  const tenantAssignments = assignments.filter((item) => item.scopeType === "TENANT");
  const validAssignments = assignments.filter((item) => item.scopeType === "ORGANIZATION" && item.organizationId).filter((assignment) => memberOrgIds.has(assignment.organizationId) || childSchoolIds.has(assignment.organizationId));
  const workspaceMap = new Map(); const organizationMap = new Map();
  for (const membership of memberships) addOrganization(organizationMap, membership.organization, { kind: "membership", viaOrganizationId: membership.organizationId });
  for (const assignment of validAssignments) { const detail = { kind: "direct", role: roleKey(assignment), viaOrganizationId: assignment.organizationId }; addOrganization(organizationMap, assignment.organization, detail); if (assignment.organization?.type === "SCHOOL") addWorkspace(workspaceMap, assignment.organization, roleKey(assignment), detail); }
  for (const assignment of validAssignments.filter((item) => item.organization?.type === "SCHOOL_GROUP")) { const rows = await prisma.organizationRelationship.findMany({ where: { toOrganizationId: assignment.organizationId, type: "BELONGS_TO_GROUP" }, include: { fromOrganization: true } }); for (const relationship of rows.filter((item) => activeRelationship(item, now))) { const role = inheritedGroupRole(roleKey(assignment)); const detail = { kind: "relationship", role, viaOrganizationId: assignment.organizationId, viaRelationship: "BELONGS_TO_GROUP" }; addWorkspace(workspaceMap, relationship.fromOrganization, role, detail); addOrganization(organizationMap, relationship.fromOrganization, detail); } }
  for (const assignment of validAssignments.filter((item) => item.organization?.type === "BUS_OPERATOR")) { const links = await transportSchoolsForOperator(prisma, assignment.organizationId, now); for (const link of links) { const role = inheritedOperatorRole(roleKey(assignment)); const detail = { kind: "relationship", role, viaOrganizationId: assignment.organizationId, viaRelationship: "TRANSPORT_PROVIDER", relationshipDirection: link.direction }; addWorkspace(workspaceMap, link.school, role, detail); addOrganization(organizationMap, link.school, detail); } }
  for (const assignment of validAssignments.filter((item) => item.organization?.type === "SERVICE_PARTNER")) { const rows = await prisma.organizationRelationship.findMany({ where: { toOrganizationId: assignment.organizationId, type: "TRIP_MANAGER" }, include: { fromOrganization: true } }); for (const relationship of rows.filter((item) => activeRelationship(item, now))) { const role = inheritedPartnerRole(roleKey(assignment)); const detail = { kind: "relationship", role, viaOrganizationId: assignment.organizationId, viaRelationship: "TRIP_MANAGER" }; addWorkspace(workspaceMap, relationship.fromOrganization, role, detail); addOrganization(organizationMap, relationship.fromOrganization, detail); } }
  const workspaces = [...workspaceMap.values()].sort((a,b)=>a.organization.displayName.localeCompare(b.organization.displayName)).map(({ organization, roles, access }) => { const resolvedRoles=[...roles].sort(); return { schoolId: organization.id, displayName: organization.displayName, fullName: organization.fullName, abbreviation: organization.abbreviation, roles: resolvedRoles, permissions: permissionsForRoles(resolvedRoles), access }; });
  const operationalRoles = [...new Set(validAssignments.map(roleKey).filter(Boolean))].sort();
  const organizations = [...organizationMap.values()].sort((a,b)=>a.organization.displayName.localeCompare(b.organization.displayName)).map(({ organization, access }) => ({ ...organization, access }));
  return { source: "canonical", user: { id: String(identity?.id || ""), appUserId: user.id, email: user.email, displayName: user.displayName }, roles: operationalRoles, permissions: permissionsForRoles([...operationalRoles, ...platformAssignments.map(roleKey)]), organizations, workspaces, platformAccess: { roles: [...new Set(platformAssignments.map(roleKey).filter(Boolean))].sort(), tenantScopes: tenantAssignments.map((item) => ({ tenantId: item.tenantId, role: roleKey(item) })) }, portfolio: { enabled: workspaces.length > 0, schoolCount: workspaces.length } };
}
