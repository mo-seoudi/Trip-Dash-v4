// Canonical v2 effective-access resolver for the dedicated control plane.
//
// This module is intentionally dependency-injected: callers pass the canonical
// control-plane Prisma client. That lets parity tests exercise the resolver
// before any production cutover and prevents accidental fallback to legacy DBs.

import { permissionsForRoles, ROLE_KEYS } from "./accessCatalog.js";

function activeStatus(value) {
  return String(value || "").trim().toLowerCase() === "active";
}

function activeMembership(row) {
  return String(row?.status || "").trim().toUpperCase() === "ACTIVE";
}

function activeRelationship(row, now = new Date()) {
  if (!activeStatus(row?.status)) return false;
  if (row.validFrom && new Date(row.validFrom) > now) return false;
  if (row.validUntil && new Date(row.validUntil) < now) return false;
  return true;
}

function orgView(org) {
  return {
    id: org.id,
    tenantId: org.tenantId,
    type: org.type,
    displayName: org.displayName,
    fullName: org.fullName || org.displayName,
    abbreviation: org.abbreviation || null,
    parentId: org.parentId || null,
  };
}

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

function roleKey(assignment) {
  return assignment?.role?.key || null;
}

export async function resolveEffectiveAccessV2(prisma, identity, { now = new Date() } = {}) {
  if (!prisma) throw new Error("Canonical control-plane Prisma client is required");
  const legacyUserId = Number(identity?.id);
  const email = String(identity?.email || "").trim();

  const user = await prisma.appUser.findFirst({
    where: {
      OR: [
        ...(Number.isInteger(legacyUserId) && legacyUserId > 0 ? [{ legacyUserId }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    include: {
      memberships: { include: { organization: true } },
      roleAssignments: { include: { role: true, organization: true, tenant: true } },
    },
  });

  if (!user || !activeStatus(user.status)) {
    return {
      source: "canonical-v2",
      user: user ? { id: String(identity?.id || ""), appUserId: user.id, email: user.email, displayName: user.displayName } : null,
      tenantId: null, roles: [], permissions: [], organizations: [], workspaces: [],
      portfolio: { enabled: false, schoolCount: 0 },
    };
  }

  const memberships = (user.memberships || []).filter(activeMembership);
  const membershipOrgIds = new Set(memberships.map((row) => row.organizationId));
  const assignments = (user.roleAssignments || []).filter((row) => row.isActive && roleKey(row));
  const platformAssignments = assignments.filter((row) => row.scopeType === "PLATFORM");
  const tenantAssignments = assignments.filter((row) => row.scopeType === "TENANT" && row.tenantId);
  const organizationAssignments = assignments.filter((row) => row.scopeType === "ORGANIZATION" && row.organizationId);
  const tenantIdsFromMemberships = new Set(memberships.map((row) => row.organization?.tenantId).filter(Boolean));
  const validOrganizationAssignments = organizationAssignments.filter((assignment) => {
    if (membershipOrgIds.has(assignment.organizationId)) return true;
    return assignment.organization?.type === "SCHOOL" && tenantIdsFromMemberships.has(assignment.organization.tenantId);
  });

  const tenantIds = new Set([...tenantIdsFromMemberships, ...tenantAssignments.map((row) => row.tenantId)]);
  const tenantId = tenantIds.size === 1 ? [...tenantIds][0] : null;
  const workspaceMap = new Map();
  const organizationMap = new Map();

  // Preserve directly visible organizations (group/operator/partner/school), not
  // only derived school workspaces. This keeps the access/bootstrap contract
  // useful for admin and organization-aware UI after canonical cutover.
  for (const assignment of validOrganizationAssignments) {
    addOrganization(organizationMap, assignment.organization, {
      kind: "direct", role: roleKey(assignment), viaOrganizationId: assignment.organizationId,
    });
    if (assignment.organization?.type === "SCHOOL") {
      addWorkspace(workspaceMap, assignment.organization, roleKey(assignment), {
        kind: "direct", role: roleKey(assignment), viaOrganizationId: assignment.organizationId,
      });
    }
  }

  const groupAssignments = validOrganizationAssignments.filter((row) => row.organization?.type === "SCHOOL_GROUP");
  for (const assignment of groupAssignments) {
    const relationships = await prisma.organizationRelationship.findMany({
      where: { toOrganizationId: assignment.organizationId, type: "BELONGS_TO_GROUP" }, include: { fromOrganization: true },
    });
    for (const relationship of relationships.filter((row) => activeRelationship(row, now))) {
      const inheritedRole = roleKey(assignment) === ROLE_KEYS.TENANT_ADMIN ? ROLE_KEYS.TENANT_ADMIN : ROLE_KEYS.GROUP_STAFF;
      const detail = { kind: "relationship", role: inheritedRole, viaOrganizationId: assignment.organizationId, viaRelationship: "BELONGS_TO_GROUP" };
      addWorkspace(workspaceMap, relationship.fromOrganization, inheritedRole, detail);
      addOrganization(organizationMap, relationship.fromOrganization, detail);
    }
  }

  for (const assignment of tenantAssignments) {
    const schools = await prisma.organization.findMany({ where: { tenantId: assignment.tenantId, type: "SCHOOL", status: "active" } });
    for (const school of schools) {
      const detail = { kind: "tenant", role: roleKey(assignment), viaTenantId: assignment.tenantId };
      addWorkspace(workspaceMap, school, roleKey(assignment), detail);
      addOrganization(organizationMap, school, detail);
    }
  }

  const operatorAssignments = validOrganizationAssignments.filter((row) => row.organization?.type === "BUS_OPERATOR");
  for (const assignment of operatorAssignments) {
    const relationships = await prisma.organizationRelationship.findMany({
      where: { toOrganizationId: assignment.organizationId, type: "TRANSPORT_PROVIDER" }, include: { fromOrganization: true },
    });
    for (const relationship of relationships.filter((row) => activeRelationship(row, now))) {
      const detail = { kind: "relationship", role: ROLE_KEYS.BUS_OPERATOR, viaOrganizationId: assignment.organizationId, viaRelationship: "TRANSPORT_PROVIDER" };
      addWorkspace(workspaceMap, relationship.fromOrganization, ROLE_KEYS.BUS_OPERATOR, detail);
      addOrganization(organizationMap, relationship.fromOrganization, detail);
    }
  }

  const partnerAssignments = validOrganizationAssignments.filter((row) => row.organization?.type === "SERVICE_PARTNER");
  for (const assignment of partnerAssignments) {
    const relationships = await prisma.organizationRelationship.findMany({
      where: { toOrganizationId: assignment.organizationId, type: "TRIP_MANAGER" }, include: { fromOrganization: true },
    });
    for (const relationship of relationships.filter((row) => activeRelationship(row, now))) {
      const detail = { kind: "relationship", role: ROLE_KEYS.SERVICE_PARTNER, viaOrganizationId: assignment.organizationId, viaRelationship: "TRIP_MANAGER" };
      addWorkspace(workspaceMap, relationship.fromOrganization, ROLE_KEYS.SERVICE_PARTNER, detail);
      addOrganization(organizationMap, relationship.fromOrganization, detail);
    }
  }

  const workspaces = [...workspaceMap.values()]
    .sort((a, b) => a.organization.displayName.localeCompare(b.organization.displayName))
    .map(({ organization, roles, access }) => {
      const workspaceRoles = [...roles].sort();
      return { schoolId: organization.id, displayName: organization.displayName, fullName: organization.fullName,
        abbreviation: organization.abbreviation, roles: workspaceRoles, permissions: permissionsForRoles(workspaceRoles), access };
    });

  const directRoles = assignments.map(roleKey).filter(Boolean);
  const roles = [...new Set(directRoles)].sort();
  const organizations = [...organizationMap.values()]
    .sort((a, b) => a.organization.displayName.localeCompare(b.organization.displayName))
    .map(({ organization, access }) => ({ ...organization, access }));

  return {
    source: "canonical-v2",
    user: { id: String(identity?.id || ""), appUserId: user.id, email: user.email, displayName: user.displayName },
    tenantId, roles,
    permissions: permissionsForRoles([...roles, ...platformAssignments.map(roleKey)]),
    organizations, workspaces,
    portfolio: { enabled: workspaces.length > 0, schoolCount: workspaces.length },
  };
}
