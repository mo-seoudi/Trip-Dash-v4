import test from "node:test";
import assert from "node:assert/strict";

import { PrismaClient as PrismaControl } from "../src/prisma-control/index.js";
import { PERMISSIONS, ROLE_KEYS, ROLE_PERMISSION_CATALOG } from "../src/services/accessCatalog.js";
import { seedControlPlaneReferenceData } from "../src/services/controlPlaneSeed.js";
import { buildAccessV2BackfillPlan } from "../src/services/accessV2BackfillPlan.js";
import { writeControlPlaneBackfill } from "../src/services/controlPlaneBackfill.js";
import { resolveEffectiveAccessV2 } from "../src/services/effectiveAccessV2.js";
import { assertControlPlaneBackfillVerified } from "../src/services/controlPlanePostWriteVerification.js";

const enabled = process.env.CONTROL_DATABASE_SMOKE === "true";

function assertDisposableUrl(url) {
  const value = String(url || "");
  if (!value || !/localhost|127\.0\.0\.1/.test(value) || !/validation|test|smoke/.test(value)) {
    const error = new Error("Control-plane smoke test requires an explicit local disposable database URL");
    error.code = "CONTROL_SMOKE_UNSAFE_DATABASE_URL";
    throw error;
  }
}

async function reset(prisma) {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(), prisma.authSession.deleteMany(), prisma.authenticationIdentity.deleteMany(),
    prisma.roleAssignment.deleteMany(), prisma.organizationMembership.deleteMany(), prisma.organizationRelationship.deleteMany(),
    prisma.operationalDataSource.deleteMany(), prisma.rolePermission.deleteMany(), prisma.permission.deleteMany(),
    prisma.role.deleteMany(), prisma.organization.deleteMany(), prisma.appUser.deleteMany(), prisma.tenant.deleteMany(),
  ]);
}

function expectedLegacyAccess() {
  // This fixture represents the transitional group-staff contract. Keep it tied
  // to the application catalog so adding an intentional workflow permission does
  // not look like an accidental canonical-only security expansion.
  const permissions = [...ROLE_PERMISSION_CATALOG[ROLE_KEYS.GROUP_STAFF]].sort();
  assert.equal(permissions.includes(PERMISSIONS.TRIP_REQUEST_QUOTE_APPROVAL), true);
  return {
    source: "smoke-legacy-fixture",
    tenantId: "tenant-smoke",
    roles: ["group_staff"],
    permissions,
    organizations: [
      { id: "group-smoke", type: "SCHOOL_GROUP" },
      { id: "school-smoke", type: "SCHOOL" },
    ],
    workspaces: [{ schoolId: "school-smoke", roles: ["group_staff"], permissions }],
    portfolio: { enabled: true, schoolCount: 1 },
  };
}

test("canonical control plane backfill is exact against real disposable PostgreSQL", { skip: !enabled }, async () => {
  assertDisposableUrl(process.env.CONTROL_DATABASE_URL);
  const prisma = new PrismaControl();
  try {
    await reset(prisma);
    await seedControlPlaneReferenceData(prisma);
    const snapshot = {
      tenants: [{ id: "tenant-smoke", name: "Smoke Tenant", slug: "smoke-tenant", status: "active", timezone: "Asia/Dubai" }],
      organizations: [
        { id: "group-smoke", tenantId: "tenant-smoke", type: "edu_group", name: "Smoke Group", code: "SG", slug: "smoke-group", parentOrgId: null },
        { id: "school-smoke", tenantId: "tenant-smoke", type: "school", name: "Smoke School", code: "SS", slug: "smoke-school", parentOrgId: "group-smoke" },
      ],
      users: [{ id: "app-user-smoke", legacyUserId: 7001, email: "smoke@example.invalid", fullName: "Smoke User", isActive: true }],
      memberships: [{ userId: "app-user-smoke", orgId: "group-smoke", role: "staff", status: "active", isDefault: true }],
      scopes: [], partnerships: [],
    };
    const plan = buildAccessV2BackfillPlan(snapshot);
    assert.deepEqual(plan.errors, []);
    const write = await writeControlPlaneBackfill(prisma, plan, { allowWrite: true, environment: "ci-smoke" });
    assert.equal(write.writesPerformed, true);

    const verification = await assertControlPlaneBackfillVerified({
      legacyUsers: [{ id: 7001 }],
      resolveLegacyAccess: async () => expectedLegacyAccess(),
      resolveCanonicalAccess: async (identity) => resolveEffectiveAccessV2(prisma, identity),
    });
    assert.equal(verification.cutoverReady, true);
    assert.equal(verification.report.safe, true);
    assert.equal(verification.report.exact, true);
    assert.equal(verification.report.users[0].identity.email, undefined);
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});
