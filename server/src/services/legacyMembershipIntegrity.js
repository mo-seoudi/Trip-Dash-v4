// Transitional integrity helpers for the legacy global access tables.
//
// UserOrgScope is not foreign-keyed to UserOrgMembership. Without explicit
// cleanup, changing or deleting a membership can leave stale role scopes that
// no longer correspond to a real membership. Keep the two structures in sync
// transactionally until the canonical v2 access model replaces them.

export async function updateLegacyMembershipWithScopes(prisma, { membershipId, existing, data }) {
  return prisma.$transaction(async (tx) => {
    const roleChanged = data.role !== undefined && data.role !== existing.role;
    let scopedSchoolIds = [];

    if (roleChanged) {
      const oldScopes = await tx.userOrgScope.findMany({
        where: { userId: existing.userId, orgId: existing.orgId, role: existing.role },
        select: { schoolOrgId: true },
      });
      scopedSchoolIds = [...new Set(oldScopes.map((row) => row.schoolOrgId))];
    }

    const updated = await tx.userOrgMembership.update({
      where: { id: membershipId },
      data,
    });

    if (roleChanged) {
      await tx.userOrgScope.deleteMany({
        where: { userId: existing.userId, orgId: existing.orgId, role: existing.role },
      });

      if (scopedSchoolIds.length) {
        await tx.userOrgScope.createMany({
          data: scopedSchoolIds.map((schoolOrgId) => ({
            userId: existing.userId,
            orgId: existing.orgId,
            role: updated.role,
            schoolOrgId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });
}

export async function deleteLegacyMembershipWithScopes(prisma, existing) {
  return prisma.$transaction(async (tx) => {
    await tx.userOrgScope.deleteMany({
      where: {
        userId: existing.userId,
        orgId: existing.orgId,
        role: existing.role,
      },
    });

    return tx.userOrgMembership.delete({ where: { id: existing.id } });
  });
}
