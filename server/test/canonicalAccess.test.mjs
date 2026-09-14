import test from "node:test";
import assert from "node:assert/strict";

import { hasTenantAccess } from "../src/middleware/canonicalAccess.js";
import { ROLE_KEYS } from "../src/services/accessCatalog.js";

test("tenant-scoped access accepts only its own tenant", () => {
  const access = { tenantId: "tenant-a", roles: [ROLE_KEYS.TENANT_ADMIN] };
  assert.equal(hasTenantAccess(access, "tenant-a"), true);
  assert.equal(hasTenantAccess(access, "tenant-b"), false);
});

test("unscoped tenant admin cannot administer an arbitrary tenant", () => {
  const access = { roles: [ROLE_KEYS.TENANT_ADMIN] };
  assert.equal(hasTenantAccess(access, "tenant-a"), false);
});

test("super admin can cross tenant boundaries", () => {
  const access = { roles: [ROLE_KEYS.SUPER_ADMIN] };
  assert.equal(hasTenantAccess(access, "tenant-a"), true);
  assert.equal(hasTenantAccess(access, "tenant-b"), true);
});

test("missing access or tenant fails closed", () => {
  assert.equal(hasTenantAccess(null, "tenant-a"), false);
  assert.equal(hasTenantAccess({ tenantId: "tenant-a", roles: [] }, null), false);
});
