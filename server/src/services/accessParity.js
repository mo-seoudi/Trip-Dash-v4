// Compare legacy and canonical-v2 effective-access outputs without mutating data.
// Cutover requires exact tenant, organization, workspace-role and permission parity.

function setOf(values = []) { return new Set((values || []).filter(Boolean)); }
function workspaceMap(access) { return new Map((access?.workspaces || []).map((workspace) => [workspace.schoolId, workspace])); }
function organizationMap(access) { return new Map((access?.organizations || []).map((organization) => [organization.id, organization])); }
function difference(left, right) { return [...left].filter((value) => !right.has(value)).sort(); }

export function compareEffectiveAccessParity(legacyAccess, canonicalAccess) {
  const issues = [];
  const securityExpansions = [];
  const legacyWorkspaces = workspaceMap(legacyAccess);
  const canonicalWorkspaces = workspaceMap(canonicalAccess);
  const legacyOrganizations = organizationMap(legacyAccess);
  const canonicalOrganizations = organizationMap(canonicalAccess);
  const addIssue = (issue, { expansion = false } = {}) => { issues.push(issue); if (expansion) securityExpansions.push(issue); };

  if ((legacyAccess?.tenantId || null) !== (canonicalAccess?.tenantId || null)) addIssue({ code: "TENANT_MISMATCH", legacyTenantId: legacyAccess?.tenantId || null, canonicalTenantId: canonicalAccess?.tenantId || null }, { expansion: true });

  for (const organizationId of canonicalOrganizations.keys()) if (!legacyOrganizations.has(organizationId)) addIssue({ code: "CANONICAL_EXTRA_ORGANIZATION", organizationId }, { expansion: true });
  for (const organizationId of legacyOrganizations.keys()) if (!canonicalOrganizations.has(organizationId)) addIssue({ code: "CANONICAL_MISSING_ORGANIZATION", organizationId });

  for (const [schoolId, canonicalWorkspace] of canonicalWorkspaces) {
    const legacyWorkspace = legacyWorkspaces.get(schoolId);
    if (!legacyWorkspace) { addIssue({ code: "CANONICAL_EXTRA_WORKSPACE", schoolId }, { expansion: true }); continue; }
    const extraRoles = difference(setOf(canonicalWorkspace.roles), setOf(legacyWorkspace.roles));
    if (extraRoles.length) addIssue({ code: "CANONICAL_EXTRA_WORKSPACE_ROLE", schoolId, roles: extraRoles }, { expansion: true });
    const missingRoles = difference(setOf(legacyWorkspace.roles), setOf(canonicalWorkspace.roles));
    if (missingRoles.length) addIssue({ code: "CANONICAL_MISSING_WORKSPACE_ROLE", schoolId, roles: missingRoles });
    const extraPermissions = difference(setOf(canonicalWorkspace.permissions), setOf(legacyWorkspace.permissions));
    if (extraPermissions.length) addIssue({ code: "CANONICAL_EXTRA_WORKSPACE_PERMISSION", schoolId, permissions: extraPermissions }, { expansion: true });
    const missingPermissions = difference(setOf(legacyWorkspace.permissions), setOf(canonicalWorkspace.permissions));
    if (missingPermissions.length) addIssue({ code: "CANONICAL_MISSING_WORKSPACE_PERMISSION", schoolId, permissions: missingPermissions });
  }
  for (const schoolId of legacyWorkspaces.keys()) if (!canonicalWorkspaces.has(schoolId)) addIssue({ code: "CANONICAL_MISSING_WORKSPACE", schoolId });

  const extraGlobalPermissions = difference(setOf(canonicalAccess?.permissions), setOf(legacyAccess?.permissions));
  if (extraGlobalPermissions.length) addIssue({ code: "CANONICAL_EXTRA_GLOBAL_PERMISSION", permissions: extraGlobalPermissions }, { expansion: true });
  const missingGlobalPermissions = difference(setOf(legacyAccess?.permissions), setOf(canonicalAccess?.permissions));
  if (missingGlobalPermissions.length) addIssue({ code: "CANONICAL_MISSING_GLOBAL_PERMISSION", permissions: missingGlobalPermissions });

  return { safe: securityExpansions.length === 0, exact: issues.length === 0, issues, securityExpansions,
    counts: { legacyOrganizations: legacyOrganizations.size, canonicalOrganizations: canonicalOrganizations.size, legacyWorkspaces: legacyWorkspaces.size, canonicalWorkspaces: canonicalWorkspaces.size, issues: issues.length, securityExpansions: securityExpansions.length } };
}

export function assertNoAccessExpansion(legacyAccess, canonicalAccess) {
  const result = compareEffectiveAccessParity(legacyAccess, canonicalAccess);
  if (!result.safe) { const error = new Error("Canonical access expands beyond legacy access"); error.code = "ACCESS_PARITY_SECURITY_EXPANSION"; error.parity = result; throw error; }
  return result;
}
