// Canonical control-plane backfill writer.
//
// Safety rules:
// - caller injects the canonical control-plane Prisma client explicitly;
// - execution is disabled unless an explicit non-production gate is supplied;
// - the complete access graph is written in one transaction;
// - reference Role/Permission rows must already exist in the destination.
//
// This module is intentionally not wired to an HTTP route, startup hook or CLI.

function requireExecutionGate({ allowWrite, environment }) {
  if (allowWrite !== true) {
    const error = new Error("Canonical control-plane backfill write is disabled");
    error.code = "CONTROL_BACKFILL_DISABLED";
    throw error;
  }
  if (String(environment || "").toLowerCase() === "production") {
    const error = new Error("Canonical control-plane backfill cannot run in production");
    error.code = "CONTROL_BACKFILL_PRODUCTION_BLOCKED";
    throw error;
  }
}

function requireValidPlan(plan) {
  if (!plan || typeof plan !== "object") throw new TypeError("backfill plan is required");
  if ((plan.errors?.length || 0) > 0) {
    const error = new Error("Canonical control-plane backfill plan is invalid");
    error.code = "CONTROL_BACKFILL_INVALID_PLAN";
    error.validationErrors = [...plan.errors];
    throw error;
  }
}

export async function writeControlPlaneBackfill(prismaControl, plan, options = {}) {
  if (!prismaControl?.$transaction) throw new TypeError("canonical control-plane Prisma client is required");
  requireExecutionGate(options);
  requireValidPlan(plan);

  return prismaControl.$transaction(async (tx) => {
    const roleRows = await tx.role.findMany({ select: { id: true, key: true } });
    const roleIdByKey = new Map(roleRows.map((row) => [row.key, row.id]));
    const missingRoles = [...new Set((plan.roleAssignments || []).map((row) => row.roleKey))]
      .filter((key) => !roleIdByKey.has(key));
    if (missingRoles.length) {
      const error = new Error(`Canonical roles are not seeded: ${missingRoles.join(", ")}`);
      error.code = "CONTROL_BACKFILL_MISSING_ROLES";
      throw error;
    }

    for (const row of plan.tenants || []) {
      await tx.tenant.upsert({
        where: { id: row.id },
        create: row,
        update: { name: row.name, slug: row.slug, status: row.status, timezone: row.timezone },
      });
    }

    // Parent links are written after all organizations exist so hierarchy order
    // in the legacy snapshot cannot create a foreign-key failure.
    for (const row of plan.organizations || []) {
      const { parentId, ...base } = row;
      await tx.organization.upsert({
        where: { id: row.id },
        create: { ...base, parentId: null },
        update: { ...base, parentId: null },
      });
    }
    for (const row of plan.organizations || []) {
      if (row.parentId) {
        await tx.organization.update({ where: { id: row.id }, data: { parentId: row.parentId } });
      }
    }

    for (const row of plan.users || []) {
      await tx.appUser.upsert({
        where: { id: row.id },
        create: row,
        update: {
          email: row.email,
          displayName: row.displayName,
          status: row.status,
          legacyUserId: row.legacyUserId,
        },
      });
    }

    for (const row of plan.memberships || []) {
      await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: row.userId,
            organizationId: row.organizationId,
          },
        },
        create: row,
        update: { status: row.status, isPrimary: row.isPrimary },
      });
    }

    for (const row of plan.relationships || []) {
      const data = {
        id: row.id,
        fromOrganizationId: row.fromOrganizationId,
        toOrganizationId: row.toOrganizationId,
        type: row.type,
        status: row.status,
        notes: row.notes ?? null,
      };
      await tx.organizationRelationship.upsert({
        where: { id: row.id },
        create: data,
        update: {
          fromOrganizationId: data.fromOrganizationId,
          toOrganizationId: data.toOrganizationId,
          type: data.type,
          status: data.status,
          notes: data.notes,
        },
      });
    }

    // Role assignments are migration-owned for these users. Replace them inside
    // the transaction so rerunning a rehearsal/backfill cannot retain a legacy
    // grant that was subsequently removed from the source access graph.
    const migratedUserIds = [...new Set((plan.users || []).map((row) => row.id))];
    if (migratedUserIds.length) {
      await tx.roleAssignment.deleteMany({ where: { userId: { in: migratedUserIds } } });
    }
    for (const row of plan.roleAssignments || []) {
      await tx.roleAssignment.create({
        data: {
          userId: row.userId,
          roleId: roleIdByKey.get(row.roleKey),
          scopeType: row.scopeType,
          tenantId: row.tenantId ?? null,
          organizationId: row.organizationId ?? null,
          isActive: row.isActive !== false,
        },
      });
    }

    return {
      mode: "NON_PRODUCTION_CONTROL_BACKFILL",
      writesPerformed: true,
      counts: {
        tenants: plan.tenants?.length || 0,
        organizations: plan.organizations?.length || 0,
        appUsers: plan.users?.length || 0,
        memberships: plan.memberships?.length || 0,
        roleAssignments: plan.roleAssignments?.length || 0,
        relationships: plan.relationships?.length || 0,
      },
    };
  });
}
