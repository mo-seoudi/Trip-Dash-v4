import test from "node:test";
import assert from "node:assert/strict";

import { resolveWorkspaceDataSource } from "../src/services/workspaceOperationalContext.js";

const access = {
  tenantId: "tenant-1",
  workspaces: [{ schoolId: "school-1", permissions: ["trip.read"] }],
};
const resolveAccess = async () => access;

test("canonical routing reads Control Plane data source and never legacy DataConnection", async () => {
  let legacyCalls = 0;
  let controlWhere;
  const result = await resolveWorkspaceDataSource({ id: 1 }, "school-1", "trip.read", {
    runtimeMode: "canonical",
    resolveAccess,
    legacyPrisma: { dataConnection: { findMany: async () => { legacyCalls += 1; return []; } } },
    controlPrisma: { operationalDataSource: { findMany: async (query) => {
      controlWhere = query.where;
      return [{ id: "ds-1", tenantId: "tenant-1", organizationId: "school-1", mode: "HOSTED", provider: "neon", secretRef: "vault://school-1", isActive: true }];
    } } },
  });
  assert.equal(legacyCalls, 0);
  assert.deepEqual(controlWhere, { tenantId: "tenant-1", organizationId: "school-1", isActive: true });
  assert.equal(result.dataSource.provider, "neon");
  assert.equal(result.dataSource.secretRef, "vault://school-1");
});

test("legacy and shadow routing do not read canonical data-source metadata", async () => {
  for (const runtimeMode of ["legacy", "shadow"]) {
    let controlCalls = 0;
    const result = await resolveWorkspaceDataSource({ id: 1 }, "school-1", "trip.read", {
      runtimeMode,
      resolveAccess,
      controlPrisma: { operationalDataSource: { findMany: async () => { controlCalls += 1; return []; } } },
      legacyPrisma: { dataConnection: { findMany: async () => [{
        id: "legacy-1", tenantId: "tenant-1", orgId: "school-1", mode: "HOSTED", provider: "supabase",
        vaultSecretId: "vault://legacy-school-1", isActive: true,
      }] } },
    });
    assert.equal(controlCalls, 0);
    assert.equal(result.dataSource.provider, "supabase");
  }
});

test("canonical routing fails closed on missing, ambiguous or invalid data source", async () => {
  const base = { runtimeMode: "canonical", resolveAccess, legacyPrisma: { dataConnection: { findMany: async () => { throw new Error("legacy must not run"); } } } };
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [] } } }),
    (error) => error?.code === "DATA_SOURCE_NOT_CONFIGURED" && error?.status === 503,
  );
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [{ isActive: true }, { isActive: true }] } } }),
    (error) => error?.code === "DATA_SOURCE_AMBIGUOUS" && error?.status === 503,
  );
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [{
      id: "ds-2", tenantId: "tenant-1", organizationId: "school-1", mode: "HOSTED", provider: "postgresql", secretRef: null, isActive: true,
    }] } } }),
    (error) => error?.code === "CANONICAL_DATA_SOURCE_INVALID",
  );
});

test("workspace permission is checked before either routing database is queried", async () => {
  let databaseCalls = 0;
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", "passenger.read", {
      runtimeMode: "canonical", resolveAccess,
      controlPrisma: { operationalDataSource: { findMany: async () => { databaseCalls += 1; return []; } } },
      legacyPrisma: { dataConnection: { findMany: async () => { databaseCalls += 1; return []; } } },
    }),
    (error) => error?.code === "WORKSPACE_PERMISSION_FORBIDDEN" && error?.status === 403,
  );
  assert.equal(databaseCalls, 0);
});
