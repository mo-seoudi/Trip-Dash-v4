// Canonical control-plane backfill writer.
// Tenant rows are platform subscription accounts only. Operational identity,
// hierarchy and collaboration are represented by Organizations + Relationships.

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

function tenantData(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status || "active",
    subscriptionMode: row.subscriptionMode || "FREE",
    planKey: row.planKey ?? null,
    billingContactEmail: row.billingContactEmail ?? null,
    subscriptionStart: row.subscriptionStart ?? null,
    subscriptionEnd: row.subscriptionEnd ?? null,
  };
}

function organizationData(row) {
  return {
    id: row.id,
    type: row.type,
    displayName: row.displayName,
    fullName: row.fullName ?? null,
    legalName: row.legalName ?? null,
    abbreviation: row.abbreviation ?? null,
    slug: row.slug,
    status: row.status || "active",
  };
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

    // Legacy tenants can be preserved as subscription accounts during migration,
    // but no organization is operationally owned or isolated by them.
    for (const row of plan.tenants || []) {
      const data = tenantData(row);
      await tx.tenant.upsert({ where: { id: data.id }, create: data, update: data });
    }

    for (const row of plan.organizations || []) {
      const data = organizationData(row);
      await tx.organization.upsert({ where: { id: data.id }, create: data, update: data });
    }

    // Preserve legacy tenant coverage only as commercial subscription coverage.
    // It must never be used by Effective Access to create operational workspaces.
    for (const row of plan.organizations || []) {
      if (!row.tenantId) continue;
      await tx.tenantOrganization.upsert({
        where: { tenantId_organizationId: { tenantId: row.tenantId, organizationId: row.id } },
        create: { tenantId: row.tenantId, organizationId: row.id, coverageType: "migrated" },
        update: { coverageType: "migrated" },
      });
    }

    for (const row of plan.users || []) {
      await tx.appUser.upsert({
        where: { id: row.id },
        create: row,
        update: { email: row.email, displayName: row.displayName, status: row.status, legacyUserId: row.legacyUserId },
      });
    }

    for (const row of plan.memberships || []) {
      await tx.organizationMembership.upsert({
        where: { userId_organizationId: { userId: row.userId, organizationId: row.organizationId } },
        create: row,
        update: { status: row.status, isPrimary: row.isPrimary, jobTitle: row.jobTitle ?? undefined },
      });
    }

    // Convert old parent links to the canonical organization graph if the plan
    // did not already provide the relationship explicitly.
    const relationships = [...(plan.relationships || [])];
    const relationshipKeys = new Set(relationships.map((r) => `${r.fromOrganizationId}|${r.toOrganizationId}|${r.type}`));
    for (const row of plan.organizations || []) {
      if (!row.parentId) continue;
      const key = `${row.id}|${row.parentId}|BELONGS_TO_GROUP`;
      if (!relationshipKeys.has(key)) {
        relationships.push({
          id: `migrated-parent:${row.id}:${row.parentId}`,
          fromOrganizationId: row.id,
          toOrganizationId: row.parentId,
          type: "BELONGS_TO_GROUP",
          status: "active",
          notes: "Migrated from legacy parent organization link",
        });
        relationshipKeys.add(key);
      }
    }

    for (const row of relationships) {
      const data = {
        id: row.id,
        fromOrganizationId: row.fromOrganizationId,
        toOrganizationId: row.toOrganizationId,
        type: row.type,
        isPrimary: row.isPrimary === true,
        status: row.status || "active",
        validFrom: row.validFrom ?? null,
        validUntil: row.validUntil ?? null,
        notes: row.notes ?? null,
      };
      await tx.organizationRelationship.upsert({
        where: { fromOrganizationId_toOrganizationId_type: {
          fromOrganizationId: data.fromOrganizationId,
          toOrganizationId: data.toOrganizationId,
          type: data.type,
        } },
        create: data,
        update: data,
      });
    }

    const migratedUserIds = [...new Set((plan.users || []).map((row) => row.id))];
    if (migratedUserIds.length) await tx.roleAssignment.deleteMany({ where: { userId: { in: migratedUserIds } } });

    for (const row of plan.roleAssignments || []) {
      await tx.roleAssignment.create({
        data: {
          userId: row.userId,
          roleId: roleIdByKey.get(row.roleKey),
          scopeType: row.scopeType,
          // TENANT scope remains valid only for platform/subscription administration.
          tenantId: row.scopeType === "TENANT" ? (row.tenantId ?? null) : null,
          organizationId: row.scopeType === "ORGANIZATION" ? (row.organizationId ?? null) : null,
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
        tenantCoverage: (plan.organizations || []).filter((row) => row.tenantId).length,
        appUsers: plan.users?.length || 0,
        memberships: plan.memberships?.length || 0,
        roleAssignments: plan.roleAssignments?.length || 0,
        relationships: relationships.length,
      },
    };
  });
}
