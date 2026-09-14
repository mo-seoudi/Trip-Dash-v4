// Deterministic canonical Role / Permission seed for the dedicated control plane.
// The catalog in accessCatalog.js remains the application source of truth.

import { PERMISSIONS, ROLE_KEYS, ROLE_PERMISSION_CATALOG } from "./accessCatalog.js";

const ROLE_NAMES = Object.freeze({
  [ROLE_KEYS.SUPER_ADMIN]: "Super Admin",
  [ROLE_KEYS.TENANT_ADMIN]: "Tenant Admin",
  [ROLE_KEYS.GROUP_STAFF]: "Group Staff",
  [ROLE_KEYS.SCHOOL_STAFF]: "School Staff",
  [ROLE_KEYS.BUS_OPERATOR]: "Bus Operator",
  [ROLE_KEYS.SERVICE_PARTNER]: "Service Partner",
  [ROLE_KEYS.FINANCE]: "Finance",
});

export function buildControlPlaneReferenceSeed() {
  const permissions = Object.values(PERMISSIONS)
    .sort()
    .map((key) => ({ key, description: null }));

  const roles = Object.values(ROLE_KEYS)
    .sort()
    .map((key) => ({
      key,
      name: ROLE_NAMES[key] || key,
      description: null,
      isSystem: true,
      permissions: [...(ROLE_PERMISSION_CATALOG[key] || [])].sort(),
    }));

  return { permissions, roles };
}

export async function seedControlPlaneReferenceData(prisma) {
  const seed = buildControlPlaneReferenceSeed();

  await prisma.$transaction(async (tx) => {
    for (const permission of seed.permissions) {
      await tx.permission.upsert({
        where: { key: permission.key },
        create: permission,
        update: { description: permission.description },
      });
    }

    for (const role of seed.roles) {
      const storedRole = await tx.role.upsert({
        where: { key: role.key },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        },
        update: {
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        },
      });

      const storedPermissions = await tx.permission.findMany({
        where: { key: { in: role.permissions } },
        select: { id: true },
      });

      // System-role permission membership is fully owned by the code catalog.
      // Replacing the join rows makes reruns deterministic and removes obsolete
      // permissions if the catalog is deliberately tightened later.
      await tx.rolePermission.deleteMany({ where: { roleId: storedRole.id } });
      if (storedPermissions.length) {
        await tx.rolePermission.createMany({
          data: storedPermissions.map(({ id }) => ({
            roleId: storedRole.id,
            permissionId: id,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  return seed;
}
