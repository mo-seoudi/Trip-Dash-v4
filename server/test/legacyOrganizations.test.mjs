import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_ORGANIZATION_TYPES,
  canonicalOrganizationType,
  isLegacyBusOperatorType,
  toLegacyStoredOrganizationType,
} from "../src/lib/legacyOrganizations.js";

test("legacy bus company values normalize to canonical BUS_OPERATOR", () => {
  assert.equal(canonicalOrganizationType("bus_company"), CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR);
  assert.equal(canonicalOrganizationType("BUS_COMPANY"), CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR);
  assert.equal(canonicalOrganizationType("bus_operator"), CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR);
  assert.equal(canonicalOrganizationType("BUS_OPERATOR"), CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR);
});

test("canonical organization types map to legacy storage only at the compatibility boundary", () => {
  assert.equal(toLegacyStoredOrganizationType("SCHOOL_GROUP"), "edu_group");
  assert.equal(toLegacyStoredOrganizationType("SCHOOL"), "school");
  assert.equal(toLegacyStoredOrganizationType("BUS_OPERATOR"), "bus_company");
  assert.equal(toLegacyStoredOrganizationType("SERVICE_PARTNER"), "service_partner");
});

test("bus operator detection accepts legacy storage and canonical language", () => {
  assert.equal(isLegacyBusOperatorType("bus_company"), true);
  assert.equal(isLegacyBusOperatorType("BUS_OPERATOR"), true);
  assert.equal(isLegacyBusOperatorType("school"), false);
});
