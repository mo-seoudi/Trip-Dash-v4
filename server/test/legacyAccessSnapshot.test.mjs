import test from "node:test";
import assert from "node:assert/strict";

import { readLegacyAccessSnapshot } from "../src/services/legacyAccessSnapshot.js";

function model(rows) {
  return {
    calls: [],
    async findMany(args) {
      this.calls.push(args);
      return rows;
    },
  };
}

test("snapshot reads only the injected legacy control-plane client", async () => {
  const prisma = {
    tenant: model([{ id: "t1" }]),
    organization: model([{ id: "s1" }]),
    user: model([{ id: "u1" }]),
    userOrgMembership: model([{ id: 1 }]),
    userOrgScope: model([{ userId: "u1", orgId: "s1", role: "school_staff", schoolOrgId: "s1" }]),
    partnership: model([{ id: "p1" }]),
  };

  const snapshot = await readLegacyAccessSnapshot(prisma);
  assert.equal(snapshot.source, "LEGACY_GLOBAL_CONTROL_PLANE");
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.tenants.length, 1);
  assert.equal(snapshot.organizations.length, 1);
  assert.equal(snapshot.users.length, 1);
  assert.equal(snapshot.memberships.length, 1);
  assert.equal(snapshot.scopes.length, 1);
  assert.equal(snapshot.partnerships.length, 1);
});

test("snapshot refuses an implicit or missing database client", async () => {
  await assert.rejects(readLegacyAccessSnapshot(), /legacy Prisma client is required/);
});
