import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/services/accessCatalog.js";
import {
  activeCanonicalDataSourceWhere,
  singleActiveWorkspaceConnection,
  workspaceFromAccess,
} from "../src/services/workspaceOperationalContext.js";

const access = {
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

test("canonical operational data-source query is locked to the authorized school", () => {
  const workspace = workspaceFromAccess(access, "school-a", PERMISSIONS.TRIP_READ);
  assert.deepEqual(activeCanonicalDataSourceWhere(access, workspace), {
    organizationId: "school-a",
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
