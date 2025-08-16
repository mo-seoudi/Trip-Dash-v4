// server/src/lib/access.js
import { PrismaClient as GlobalPrisma } from "../prisma-global/index.js";
const g = new GlobalPrisma();

/**
 * Get the roles the user holds on the active org (e.g., ADMIN on parent_org).
 */
async function getUserRolesOnActiveOrg(userId, activeOrgId) {
  const roles = await g.user_roles.findMany({
    where: { user_id: String(userId), org_id: String(activeOrgId) },
    select: { role: true },
  });
  // returns e.g. [{role:'ADMIN'},{role:'FINANCE'}]
  return roles.map(r => r.role);
}

/**
 * Base inheritance from the active org:
 * - PARENT_ORG    => all child SCHOOLS under it
 * - BUS_COMPANY   => SCHOOLS linked via partnerships
 * - SCHOOL        => itself
 */
async function inheritedSchoolIds(tenantId, activeOrg) {
  if (activeOrg.type === "PARENT_ORG") {
    const schools = await g.organizations.findMany({
      where: { tenant_id: tenantId, type: "SCHOOL", parent_org_id: activeOrg.id },
      select: { id: true },
    });
    return schools.map(s => s.id);
  }

  if (activeOrg.type === "BUS_COMPANY") {
    const links = await g.partnerships.findMany({
      where: { tenant_id: tenantId, bus_company_id: activeOrg.id },
      select: { school_org_id: true },
    });
    return links.map(l => l.school_org_id);
  }

  // SCHOOL (or any other) => itself
  return [activeOrg.id];
}

/**
 * Resolve effective school org ids for the current user+active org.
 * If any user_role_scopes exist for (user, org, role in rolesHeld), we limit to that set.
 */
export async function resolveEffectiveSchoolIds({ userId, tenantId, activeOrgId }) {
  const activeOrg = await g.organizations.findUnique({ where: { id: String(activeOrgId) } });
  if (!activeOrg) return [];

  const baseSet = new Set(await inheritedSchoolIds(String(tenantId), activeOrg));
  if (baseSet.size === 0) return [];

  const rolesHeld = await getUserRolesOnActiveOrg(String(userId), String(activeOrgId));
  if (!rolesHeld.length) return [];

  // Pull any scopes for any role the user holds on this active org
  const scopes = await g.user_role_scopes.findMany({
    where: {
      user_id: String(userId),
      org_id: String(activeOrgId),
      role: { in: rolesHeld }, // RoleType enum (uppercase)
    },
    select: { school_org_id: true },
  });

  if (!scopes.length) {
    // No scopes defined -> full inherited set
    return Array.from(baseSet);
  }

  // Scopes exist -> intersect
  const allowed = new Set(scopes.map(s => s.school_org_id));
  return Array.from(baseSet).filter(id => allowed.has(id));
}
