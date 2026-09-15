// Pure planning helpers for the legacy-global -> canonical-v2 access migration.
//
// IMPORTANT: this module does not write to PostgreSQL. It converts legacy rows
// into deterministic canonical records so the migration can be reviewed and
// tested before any production backfill is allowed.

import { canonicalRoleKey } from "./accessCatalog.js";
import { canonicalOrganizationType, CANONICAL_ORGANIZATION_TYPES } from "../lib/legacyOrganizations.js";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "approved"]);
const AMBIGUOUS_LEGACY_ROLES = new Set(["trip_manager"]);

export function canonicalMembershipStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ACTIVE_MEMBERSHIP_STATUSES.has(normalized)) return "ACTIVE";
  if (normalized === "pending") return "PENDING";
  if (normalized === "blocked" || normalized === "suspended") return "SUSPENDED";
  if (normalized === "revoked") return "REVOKED";
  return "PENDING";
}

export function planTenants(legacyTenants = []) { return legacyTenants.map((row) => ({ id: row.id, name: row.name, slug: row.slug, status: row.status || "active", timezone: row.timezone || "Asia/Dubai" })); }
export function planOrganizations(legacyOrganizations = []) { return legacyOrganizations.map((row) => ({ id: row.id, tenantId: row.tenantId, type: canonicalOrganizationType(row.type), displayName: row.name, fullName: row.name, legalName: null, abbreviation: row.code || null, slug: row.slug, status: "active", parentId: row.parentOrgId || null })); }
export function planAppUsers(legacyUsers = []) { return legacyUsers.map((row) => ({ id: row.id, email: row.email, displayName: row.fullName || row.email, status: row.isActive === false ? "inactive" : "active", legacyUserId: row.legacyUserId ?? null })); }

function membershipKey(row) { return `${row.userId}:${row.orgId}`; }
export function planMemberships(legacyMemberships = []) {
  const grouped = new Map();
  for (const row of legacyMemberships) {
    const key = membershipKey(row);
    const current = grouped.get(key) || { userId: row.userId, organizationId: row.orgId, statuses: [], isPrimary: false };
    current.statuses.push(canonicalMembershipStatus(row.status)); current.isPrimary ||= Boolean(row.isDefault); grouped.set(key, current);
  }
  const rank = { ACTIVE: 4, PENDING: 3, SUSPENDED: 2, REVOKED: 1 };
  return [...grouped.values()].map((row) => ({ userId: row.userId, organizationId: row.organizationId, status: row.statuses.sort((a,b) => rank[b]-rank[a])[0] || "PENDING", isPrimary: row.isPrimary }));
}

function scopedSchoolMap(legacyScopes = []) {
  const map = new Map();
  for (const scope of legacyScopes) {
    const legacyRole = String(scope.role || "").trim().toLowerCase();
    if (AMBIGUOUS_LEGACY_ROLES.has(legacyRole)) continue;
    const role = canonicalRoleKey(scope.role); const key = `${scope.userId}:${scope.orgId}:${role}`; const set = map.get(key) || new Set(); set.add(scope.schoolOrgId); map.set(key, set);
  }
  return map;
}

export function findAmbiguousLegacyRoleMemberships(legacyMemberships = []) {
  return legacyMemberships
    .filter((row) => canonicalMembershipStatus(row.status) === "ACTIVE" && AMBIGUOUS_LEGACY_ROLES.has(String(row.role || "").trim().toLowerCase()))
    .map((row) => ({ userId: row.userId, organizationId: row.orgId, legacyRole: String(row.role).trim().toLowerCase() }));
}

export function planRoleAssignments(legacyMemberships = [], legacyScopes = []) {
  const scopes = scopedSchoolMap(legacyScopes), planned = [], seen = new Set();
  const push = (assignment) => { const key = [assignment.userId, assignment.roleKey, assignment.scopeType, assignment.tenantId || "", assignment.organizationId || ""].join(":"); if (!seen.has(key)) { seen.add(key); planned.push(assignment); } };
  for (const membership of legacyMemberships) {
    if (canonicalMembershipStatus(membership.status) !== "ACTIVE") continue;
    const legacyRole = String(membership.role || "").trim().toLowerCase();
    // trip_manager is intentionally NOT auto-mapped. Its historical meaning is
    // ambiguous (service partner vs school-side coordinator). Evidence and an
    // explicit approved mapping are required before a migration may proceed.
    if (AMBIGUOUS_LEGACY_ROLES.has(legacyRole)) continue;
    const roleKey = canonicalRoleKey(membership.role); if (!roleKey) continue;
    const schoolScopes = scopes.get(`${membership.userId}:${membership.orgId}:${roleKey}`);
    if (schoolScopes?.size) { for (const organizationId of schoolScopes) push({ userId: membership.userId, roleKey, scopeType: "ORGANIZATION", tenantId: null, organizationId, isActive: true, source: "legacy_school_scope" }); continue; }
    push({ userId: membership.userId, roleKey, scopeType: "ORGANIZATION", tenantId: null, organizationId: membership.orgId, isActive: true, source: "legacy_membership" });
  }
  return planned;
}

export function planRelationships(legacyOrganizations = [], legacyPartnerships = []) {
  const organizations = new Map(legacyOrganizations.map((row) => [row.id, row])), planned = [];
  for (const organization of legacyOrganizations) {
    if (!organization.parentOrgId || canonicalOrganizationType(organization.type) !== CANONICAL_ORGANIZATION_TYPES.SCHOOL) continue;
    planned.push({ id: `hierarchy:${organization.id}:${organization.parentOrgId}`, fromOrganizationId: organization.id, toOrganizationId: organization.parentOrgId, type: "BELONGS_TO_GROUP", status: "active", notes: "Backfilled from legacy organization parent" });
  }
  for (const partnership of legacyPartnerships) {
    const school = organizations.get(partnership.schoolOrgId), operator = organizations.get(partnership.busCompanyOrgId); if (!school || !operator) continue;
    planned.push({ id: partnership.id, fromOrganizationId: partnership.schoolOrgId, toOrganizationId: partnership.busCompanyOrgId, type: "TRANSPORT_PROVIDER", status: String(partnership.status || "active").toLowerCase(), notes: partnership.notes || null });
  }
  return planned;
}

export function validateBackfillPlan(plan) {
  const errors = [], tenantIds = new Set(plan.tenants.map((r) => r.id)), userIds = new Set(plan.users.map((r) => r.id)), orgIds = new Set(plan.organizations.map((r) => r.id));
  for (const org of plan.organizations) { if (!tenantIds.has(org.tenantId)) errors.push(`Organization ${org.id} references missing tenant ${org.tenantId}`); if (org.parentId && !orgIds.has(org.parentId)) errors.push(`Organization ${org.id} references missing parent ${org.parentId}`); }
  for (const membership of plan.memberships) { if (!userIds.has(membership.userId)) errors.push(`Membership references missing user ${membership.userId}`); if (!orgIds.has(membership.organizationId)) errors.push(`Membership references missing organization ${membership.organizationId}`); }
  for (const assignment of plan.roleAssignments) { if (!userIds.has(assignment.userId)) errors.push(`Role assignment references missing user ${assignment.userId}`); if (assignment.organizationId && !orgIds.has(assignment.organizationId)) errors.push(`Role assignment references missing organization ${assignment.organizationId}`); }
  for (const relationship of plan.relationships) { if (!orgIds.has(relationship.fromOrganizationId)) errors.push(`Relationship references missing source ${relationship.fromOrganizationId}`); if (!orgIds.has(relationship.toOrganizationId)) errors.push(`Relationship references missing target ${relationship.toOrganizationId}`); }
  for (const unresolved of plan.unresolvedLegacyRoles || []) errors.push(`Ambiguous legacy role ${unresolved.legacyRole} for user ${unresolved.userId} at organization ${unresolved.organizationId} requires explicit mapping`);
  return errors;
}

export function buildAccessV2BackfillPlan({ tenants = [], organizations = [], users = [], memberships = [], scopes = [], partnerships = [] } = {}) {
  const plan = { tenants: planTenants(tenants), organizations: planOrganizations(organizations), users: planAppUsers(users), memberships: planMemberships(memberships), roleAssignments: planRoleAssignments(memberships, scopes), relationships: planRelationships(organizations, partnerships), unresolvedLegacyRoles: findAmbiguousLegacyRoleMemberships(memberships) };
  return { ...plan, errors: validateBackfillPlan(plan) };
}
