import test from "node:test";
import assert from "node:assert/strict";

import {
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSION_CATALOG,
  canonicalRoleKey,
  legacyCompatibleRoleKey,
  permissionsForRoles,
} from "../src/services/accessCatalog.js";

const has = (role, permission) => ROLE_PERMISSION_CATALOG[role].includes(permission);

test("canonical role resolver accepts only canonical role keys", () => {
  assert.equal(canonicalRoleKey("bus_operator"), ROLE_KEYS.BUS_OPERATOR);
  assert.equal(canonicalRoleKey("service_partner"), ROLE_KEYS.SERVICE_PARTNER);
  assert.equal(canonicalRoleKey("tenant_admin"), ROLE_KEYS.TENANT_ADMIN);
  assert.equal(canonicalRoleKey("bus_company"), null);
  assert.equal(canonicalRoleKey("operator"), null);
  assert.equal(canonicalRoleKey("admin"), null);
  assert.equal(canonicalRoleKey("staff"), null);
  assert.equal(canonicalRoleKey("trip_manager"), null);
});

test("legacy compatibility resolver maps only unambiguous historical aliases", () => {
  assert.equal(legacyCompatibleRoleKey("bus_company"), ROLE_KEYS.BUS_OPERATOR);
  assert.equal(legacyCompatibleRoleKey("operator"), ROLE_KEYS.BUS_OPERATOR);
  assert.equal(legacyCompatibleRoleKey("admin"), ROLE_KEYS.TENANT_ADMIN);
  assert.equal(legacyCompatibleRoleKey("staff"), ROLE_KEYS.SCHOOL_STAFF);
  assert.equal(legacyCompatibleRoleKey("trip_manager"), null);
});

test("bus operator can operate trips and buses but cannot access passengers", () => {
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.TRIP_READ), true);
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.TRIP_RESPOND), true);
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.BUS_ASSIGNMENT_MANAGE), true);
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.PASSENGER_READ), false);
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.PASSENGER_MANAGE), false);
  assert.equal(has(ROLE_KEYS.BUS_OPERATOR, PERMISSIONS.PASSENGER_ALLOCATE), false);
});

test("finance can manage pricing but cannot manage buses or passengers", () => {
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.TRIP_READ), true);
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.FINANCE_READ), true);
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.FINANCE_MANAGE_PRICE), true);
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.BUS_ASSIGNMENT_MANAGE), false);
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.PASSENGER_READ), false);
  assert.equal(has(ROLE_KEYS.FINANCE, PERMISSIONS.PASSENGER_MANAGE), false);
});

test("school and group staff can manage and allocate passengers", () => {
  for (const role of [ROLE_KEYS.SCHOOL_STAFF, ROLE_KEYS.GROUP_STAFF]) {
    assert.equal(has(role, PERMISSIONS.TRIP_CREATE), true);
    assert.equal(has(role, PERMISSIONS.PASSENGER_READ), true);
    assert.equal(has(role, PERMISSIONS.PASSENGER_MANAGE), true);
    assert.equal(has(role, PERMISSIONS.PASSENGER_ALLOCATE), true);
  }
});

test("service partner has trip workflow permissions without passenger access", () => {
  assert.equal(has(ROLE_KEYS.SERVICE_PARTNER, PERMISSIONS.TRIP_READ), true);
  assert.equal(has(ROLE_KEYS.SERVICE_PARTNER, PERMISSIONS.TRIP_CREATE), true);
  assert.equal(has(ROLE_KEYS.SERVICE_PARTNER, PERMISSIONS.TRIP_RESPOND), true);
  assert.equal(has(ROLE_KEYS.SERVICE_PARTNER, PERMISSIONS.PASSENGER_READ), false);
  assert.equal(has(ROLE_KEYS.SERVICE_PARTNER, PERMISSIONS.PASSENGER_MANAGE), false);
});

test("tenant and super admins have access administration privileges", () => {
  assert.equal(has(ROLE_KEYS.TENANT_ADMIN, PERMISSIONS.ACCESS_ADMIN), true);
  assert.equal(has(ROLE_KEYS.SUPER_ADMIN, PERMISSIONS.ACCESS_ADMIN), true);
  assert.deepEqual(new Set(ROLE_PERMISSION_CATALOG[ROLE_KEYS.SUPER_ADMIN]), new Set(Object.values(PERMISSIONS)));
});

test("permissionsForRoles accepts canonical roles and de-duplicates permissions", () => {
  const permissions = permissionsForRoles(["bus_operator", "bus_operator"]);
  assert.equal(new Set(permissions).size, permissions.length);
  assert.equal(permissions.includes(PERMISSIONS.BUS_ASSIGNMENT_MANAGE), true);
  assert.equal(permissions.includes(PERMISSIONS.PASSENGER_READ), false);
});

test("permissionsForRoles never grants permissions from legacy aliases", () => {
  assert.deepEqual(permissionsForRoles(["bus_company", "trip_manager", "admin"]), []);
});
