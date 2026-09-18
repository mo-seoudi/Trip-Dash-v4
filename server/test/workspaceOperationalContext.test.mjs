import test from "node:test";
import assert from "node:assert/strict";

import { resolveWorkspaceDataSource } from "../src/services/workspaceOperationalContext.js";

const access = {
  workspaces: [{ schoolId: "school-1", permissions: ["trip.read"] }],
};
const resolveAccess = async () => access;

function validDataSource(overrides={}) {
  return {
    id: "ds-1", organizationId: "school-1", mode: "HOSTED", provider: "neon",
    secretRef: "vault://school-1", isActive: true, ...overrides,
  };
}

test("workspace routing reads only the canonical Control Plane data source", async () => {
  let controlWhere;
  let receivedAccessArgs;
  const result = await resolveWorkspaceDataSource({ id: 1 }, "school-1", "trip.read", {
    resolveAccess: async (args) => { receivedAccessArgs = args; return access; },
    controlPrisma: { operationalDataSource: { findMany: async (query) => {
      controlWhere = query.where;
      return [validDataSource()];
    } } },
  });
  assert.deepEqual(receivedAccessArgs, { user: { id: 1 } });
  assert.deepEqual(controlWhere, { organizationId: "school-1", isActive: true });
  assert.equal(result.dataSource.provider, "neon");
  assert.equal(result.dataSource.secretRef, "vault://school-1");
});

test("canonical routing fails closed on missing, ambiguous or invalid data source", async () => {
  const base = { resolveAccess };
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [] } } }),
    (error) => error?.code === "DATA_SOURCE_NOT_CONFIGURED" && error?.status === 503,
  );
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [validDataSource(), validDataSource({ id: "ds-2" })] } } }),
    (error) => error?.code === "DATA_SOURCE_AMBIGUOUS" && error?.status === 503,
  );
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { ...base, controlPrisma: { operationalDataSource: { findMany: async () => [validDataSource({ secretRef: null, provider: "postgresql" })] } } }),
    (error) => error?.code === "CANONICAL_DATA_SOURCE_INVALID",
  );
});

test("workspace permission is checked before the routing database is queried", async () => {
  let databaseCalls = 0;
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", "passenger.read", {
      resolveAccess,
      controlPrisma: { operationalDataSource: { findMany: async () => { databaseCalls += 1; return []; } } },
    }),
    (error) => error?.code === "WORKSPACE_PERMISSION_FORBIDDEN" && error?.status === 403,
  );
  assert.equal(databaseCalls, 0);
});

test("routing fails closed when the canonical control plane is unavailable", async () => {
  await assert.rejects(
    resolveWorkspaceDataSource({ id: 1 }, "school-1", null, { resolveAccess, controlPrisma: null }),
    (error) => error?.code === "CANONICAL_ACCESS_UNAVAILABLE" && error?.status === 503,
  );
});
