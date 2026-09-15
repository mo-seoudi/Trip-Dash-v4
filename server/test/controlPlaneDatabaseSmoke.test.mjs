import test from "node:test";
import assert from "node:assert/strict";

import { PrismaClient as PrismaControl } from "../src/prisma-control/index.js";
import { seedControlPlaneReferenceData } from "../src/services/controlPlaneSeed.js";
import { buildAccessV2BackfillPlan } from "../src/services/accessV2BackfillPlan.js";
import { writeControlPlaneBackfill } from "../src/services/controlPlaneBackfill.js";
import { resolveEffectiveAccessV2 } from "../src/services/effectiveAccessV2.js";

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

test("canonical control plane works against real disposable PostgreSQL", { skip: !enabled }, async () => {
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
    const access = await resolveEffectiveAccessV2(prisma, { id: 7001, email: "smoke@example.invalid" });
    assert.equal(access.tenantId, "tenant-smoke");
    assert.deepEqual(access.workspaces.map((row) => row.schoolId), ["school-smoke"]);
    assert.deepEqual(new Set(access.organizations.map((row) => row.id)), new Set(["group-smoke", "school-smoke"]));
    assert.ok(access.workspaces[0].roles.includes("group_staff"));
  } finally {
    await reset(prisma).catch(() => {});
    await prisma.$disconnect();
  }
});
