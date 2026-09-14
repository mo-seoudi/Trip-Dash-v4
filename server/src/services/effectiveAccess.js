// server/src/services/effectiveAccess.js
// Transitional effective-access engine backed by the legacy global/control data.
//
// This gives the frontend a backend-owned workspace contract now, before the
// additive v2 access tables are migrated. After migration this service can swap
// its data source without changing the client contract.

import { prismaGlobal } from "../lib/prismaGlobal.js";
import { canonicalOrganizationType, CANONICAL_ORGANIZATION_TYPES } from "../lib/legacyOrganizations.js";
import { canonicalRoleKey, permissionsForRoles, ROLE_KEYS } from "./accessCatalog.js";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "approved"]);
const ACTIVE_RELATIONSHIP_STATUS = "active";

function activeMembership(row) {
  return ACTIVE_MEMBERSHIP_STATUSES.has(String(row?.status || "").toLowerCase());
}

function organizationView(org) {
  return {
    id: org.id,
    tenantId: org.tenantId,
    type: canonicalOrganizationType(org.type),
    displayName: org.name,
    fullName: org.name,
    abbreviation: org.code || null,
    parentId: org.parentOrgId || null,
  };
}

function addAccess(map, org, detail) {
  if (!org) return;
  const existing = map.get(org.id);
  if (!existing) {
    map.set(org.id, { organization: organizationView(org), access: [detail] });
    return;
  }
  const signature = JSON.stringify(detail);
  if (!existing.access.some((item) => JSON.stringify(item) === signature)) {
    existing.access.push(detail);
  }
}

function membershipRole(row) {
  return canonicalRoleKey(row.role);
}

async function findGlobalUser(legacyUser) {
  return (
    (await prismaGlobal.user.findFirst({
      where: { legacyUserId: Number(legacyUser.id) },
      select: { id: true, tenantId: true, email: true, fullName: true, isActive: true },
    })) ||
    (await prismaGlobal.user.findFirst({
      where: { email: legacyUser.email },
      select: { id: true, tenantId: true, email: true, fullName: true, isActive: true },
    }))
  );
}

function workspacePermissions(roles) {
  return permissionsForRoles(roles);
}

export async function resolveEffectiveAccess(legacyUser) {
  const gUser = await findGlobalUser(legacyUser);

  // Migration bridge: users that have not yet been wired into the global model
  // keep their legacy role identity but receive no fabricated organization scope.
  if (!gUser || !gUser.isActive) {
    const role = canonicalRoleKey(legacyUser.role);
    return {
      source: "legacy-unscoped",
      user: {
        id: String(legacyUser.id),
        email: legacyUser.email,
        displayName: legacyUser.name,
      },
      roles: role ? [role] : [],
      permissions: role ? permissionsForRoles([role]) : [],
      organizations: [],
      workspaces: [],
      portfolio: { enabled: false, schoolCount: 0 },
    };
  }

  const memberships = await prismaGlobal.userOrgMembership.findMany({
    where: { userId: gUser.id },
    include: { org: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const activeMemberships = memberships.filter(activeMembership);
  const directRoles = [...new Set(activeMemberships.map(membershipRole).filter(Boolean))];
  const globalLegacyRole = canonicalRoleKey(legacyUser.role);
  const roles = [...new Set([...directRoles, ...(globalLegacyRole ? [globalLegacyRole] : [])])];

  const accessMap = new Map();
  const schoolRoleMap = new Map();
  const tenantId = gUser.tenantId || activeMemberships[0]?.org?.tenantId || null;

  const addSchoolRole = (schoolId, role) => {
    if (!role) return;
    const set = schoolRoleMap.get(schoolId) || new Set();
    set.add(role);
    schoolRoleMap.set(schoolId, set);
  };

  for (const membership of activeMemberships) {
    const org = membership.org;
    if (!org) continue;
    const role = membershipRole(membership);
    addAccess(accessMap, org, { kind: "direct", role, viaOrganizationId: org.id });

    const orgType = canonicalOrganizationType(org.type);
    if (orgType === CANONICAL_ORGANIZATION_TYPES.SCHOOL) {
      addSchoolRole(org.id, role);
    }

    if (orgType === CANONICAL_ORGANIZATION_TYPES.SCHOOL_GROUP) {
      const schools = await prismaGlobal.organization.findMany({
        where: { tenantId: org.tenantId, parentOrgId: org.id, type: "school" },
        orderBy: { name: "asc" },
      });
      for (const school of schools) {
        addAccess(accessMap, school, {
          kind: "relationship",
          role,
          viaOrganizationId: org.id,
          viaRelationship: "BELONGS_TO_GROUP",
        });
        addSchoolRole(school.id, role === ROLE_KEYS.TENANT_ADMIN ? role : ROLE_KEYS.GROUP_STAFF);
      }
    }

    if (orgType === CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR) {
      // Partnership field names are legacy database names; the application-facing
      // relationship remains School -> Bus Operator / TRANSPORT_PROVIDER.
      const links = await prismaGlobal.partnership.findMany({
        where: { busCompanyOrgId: org.id, status: ACTIVE_RELATIONSHIP_STATUS },
        include: { school: true },
      });
      for (const link of links) {
        if (tenantId && link.tenantId !== tenantId) continue;
        addAccess(accessMap, link.school, {
          kind: "relationship",
          role: ROLE_KEYS.BUS_OPERATOR,
          viaOrganizationId: org.id,
          viaRelationship: "TRANSPORT_PROVIDER",
        });
        addSchoolRole(link.schoolOrgId, ROLE_KEYS.BUS_OPERATOR);
      }
    }
  }

  // Legacy fine-grained school scopes restrict an organization's inherited
  // school set when they exist. We expose the restriction now; v2 RoleAssignment
  // will replace this structure after migration.
  const scopes = await prismaGlobal.userOrgScope.findMany({
    where: { userId: gUser.id },
    select: { orgId: true, role: true, schoolOrgId: true },
  });
  const scopedByOrgRole = new Map();
  for (const scope of scopes) {
    const key = `${scope.orgId}:${canonicalRoleKey(scope.role)}`;
    const set = scopedByOrgRole.get(key) || new Set();
    set.add(scope.schoolOrgId);
    scopedByOrgRole.set(key, set);
  }

  for (const [schoolId] of [...schoolRoleMap.entries()]) {
    const access = accessMap.get(schoolId);
    if (!access) continue;
    const permittedRoles = new Set();
    for (const detail of access.access) {
      const key = `${detail.viaOrganizationId}:${canonicalRoleKey(detail.role)}`;
      const restriction = scopedByOrgRole.get(key);
      if (!restriction || restriction.has(schoolId)) permittedRoles.add(canonicalRoleKey(detail.role));
    }
    if (!permittedRoles.size) {
      accessMap.delete(schoolId);
      schoolRoleMap.delete(schoolId);
    } else {
      schoolRoleMap.set(schoolId, permittedRoles);
    }
  }

  const organizations = [...accessMap.values()]
    .sort((a, b) => a.organization.displayName.localeCompare(b.organization.displayName))
    .map(({ organization, access }) => ({ ...organization, access }));

  const workspaces = organizations
    .filter((org) => org.type === CANONICAL_ORGANIZATION_TYPES.SCHOOL)
    .map((school) => {
      const workspaceRoles = [...(schoolRoleMap.get(school.id) || [])].filter(Boolean).sort();
      return {
        schoolId: school.id,
        displayName: school.displayName,
        fullName: school.fullName,
        abbreviation: school.abbreviation,
        roles: workspaceRoles,
        permissions: workspacePermissions(workspaceRoles),
        access: school.access,
      };
    });

  return {
    source: "legacy-global-bridge",
    user: {
      id: String(legacyUser.id),
      appUserId: gUser.id,
      email: legacyUser.email,
      displayName: gUser.fullName || legacyUser.name,
    },
    tenantId,
    roles: roles.sort(),
    permissions: permissionsForRoles(roles),
    organizations,
    workspaces,
    portfolio: { enabled: workspaces.length > 0, schoolCount: workspaces.length },
  };
}
