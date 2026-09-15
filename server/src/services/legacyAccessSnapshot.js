// Read-only extraction boundary for the legacy global/control-plane database.
// The caller must inject the legacy Prisma client explicitly. This prevents a
// migration/rehearsal from silently reading the primary or canonical database.

export async function readLegacyAccessSnapshot(prismaLegacy) {
  if (!prismaLegacy) throw new TypeError("legacy Prisma client is required");

  const [tenants, organizations, users, memberships, scopes, partnerships] = await Promise.all([
    prismaLegacy.tenant.findMany({ orderBy: { id: "asc" } }),
    prismaLegacy.organization.findMany({ orderBy: { id: "asc" } }),
    prismaLegacy.user.findMany({ orderBy: { id: "asc" } }),
    prismaLegacy.userOrgMembership.findMany({ orderBy: { id: "asc" } }),
    prismaLegacy.userOrgScope.findMany({
      orderBy: [{ userId: "asc" }, { orgId: "asc" }, { role: "asc" }, { schoolOrgId: "asc" }],
    }),
    prismaLegacy.partnership.findMany({ orderBy: { id: "asc" } }),
  ]);

  return {
    source: "LEGACY_GLOBAL_CONTROL_PLANE",
    readOnly: true,
    tenants,
    organizations,
    users,
    memberships,
    scopes,
    partnerships,
  };
}
