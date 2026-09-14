import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/services/accessCatalog.js";
import {
  activeWorkspaceConnectionWhere,
  legacyConnectionAsDataSource,
  singleActiveWorkspaceConnection,
  workspaceFromAccess,
} from "../src/services/workspaceOperationalContext.js";

const access = {
  tenantId: "tenant-a",
  workspaces: [
    {
      schoolId: "school-a",
      permissions: [PERMISSIONS.TRIP_READ, PERMISSIONS.TRIP_CREATE],
    },
  ],
};

function throwsCode(fn, status, code) {
  assert.throws(fn, (error) => error?.status === status && error?.code === code);
}

test("workspace authorization requires an explicit permitted school", () => {
  const workspace = workspaceFromAccess(access, "school-a", PERMISSIONS.TRIP_READ);
  assert.equal(workspace.schoolId, "school-a");

  throwsCode(
    () => workspaceFromAccess(access, "school-b", PERMISSIONS.TRIP_READ),
    403,
    "SCHOOL_WORKSPACE_FORBIDDEN",
  );
  throwsCode(
    () => workspaceFromAccess(access, "", PERMISSIONS.TRIP_READ),
    400,
    "SCHOOL_WORKSPACE_REQUIRED",
  );
});

test("workspace authorization enforces permission inside that school", () => {
  throwsCode(
    () => workspaceFromAccess(access, "school-a", PERMISSIONS.TRIP_DELETE),
    403,
    "WORKSPACE_PERMISSION_FORBIDDEN",
  );
});

test("unscoped access cannot become a database-routing context", () => {
  throwsCode(
    () => workspaceFromAccess({ workspaces: access.workspaces }, "school-a", PERMISSIONS.TRIP_READ),
    403,
    "WORKSPACE_TENANT_FORBIDDEN",
  );
});

test("operational connection query is locked to tenant plus authorized school", () => {
  const workspace = workspaceFromAccess(access, "school-a", PERMISSIONS.TRIP_READ);
  assert.deepEqual(activeWorkspaceConnectionWhere(access, workspace), {
    tenantId: "tenant-a",
    orgId: "school-a",
    isActive: true,
  });
});

test("database routing fails closed when zero or multiple sources are active", () => {
  throwsCode(() => singleActiveWorkspaceConnection([]), 503, "DATA_SOURCE_NOT_CONFIGURED");
  throwsCode(
    () => singleActiveWorkspaceConnection([{ id: "one" }, { id: "two" }]),
    503,
    "DATA_SOURCE_AMBIGUOUS",
  );
  assert.deepEqual(singleActiveWorkspaceConnection([{ id: "one" }]), { id: "one" });
});

test("legacy connection conversion refuses missing credentials and preserves routing identity", () => {
  throwsCode(
    () => legacyConnectionAsDataSource({ id: "dc-1", vaultSecretId: "" }),
    503,
    "DATA_SOURCE_SECRET_MISSING",
  );

  const source = legacyConnectionAsDataSource({
    id: "dc-1",
    tenantId: "tenant-a",
    orgId: "school-a",
    mode: "BYODB",
    dbHost: "example.neon.tech",
    vaultSecretId: "env:TEST_DATABASE_URL",
    isActive: true,
    updatedAt: new Date("2026-09-14T00:00:00Z"),
  });

  assert.equal(source.tenantId, "tenant-a");
  assert.equal(source.organizationId, "school-a");
  assert.equal(source.mode, "CUSTOMER_POSTGRES");
  assert.equal(source.provider, "neon");
  assert.equal(source.secretRef, "env:TEST_DATABASE_URL");
});
