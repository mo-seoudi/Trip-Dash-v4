// Legacy organization-type compatibility boundary.
//
// Canonical application language uses SCHOOL_GROUP / SCHOOL / BUS_OPERATOR /
// SERVICE_PARTNER. The old global control-plane table still persists lower-case
// legacy values such as "edu_group" and "bus_company" until the v2 migration.
// Keep those storage details isolated here so they do not leak into new code.

export const CANONICAL_ORGANIZATION_TYPES = Object.freeze({
  SCHOOL_GROUP: "SCHOOL_GROUP",
  SCHOOL: "SCHOOL",
  BUS_OPERATOR: "BUS_OPERATOR",
  SERVICE_PARTNER: "SERVICE_PARTNER",
});

export function canonicalOrganizationType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["school_group", "edu_group", "group"].includes(normalized)) {
    return CANONICAL_ORGANIZATION_TYPES.SCHOOL_GROUP;
  }
  if (normalized === "school") return CANONICAL_ORGANIZATION_TYPES.SCHOOL;
  if (["bus_operator", "bus_company"].includes(normalized)) {
    return CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR;
  }
  if (normalized === "service_partner") {
    return CANONICAL_ORGANIZATION_TYPES.SERVICE_PARTNER;
  }

  return normalized ? normalized.toUpperCase() : null;
}

export function toLegacyStoredOrganizationType(value) {
  const canonical = canonicalOrganizationType(value);

  switch (canonical) {
    case CANONICAL_ORGANIZATION_TYPES.SCHOOL_GROUP:
      return "edu_group";
    case CANONICAL_ORGANIZATION_TYPES.SCHOOL:
      return "school";
    case CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR:
      return "bus_company";
    case CANONICAL_ORGANIZATION_TYPES.SERVICE_PARTNER:
      return "service_partner";
    default:
      return null;
  }
}

export function isLegacyBusOperatorType(value) {
  return canonicalOrganizationType(value) === CANONICAL_ORGANIZATION_TYPES.BUS_OPERATOR;
}
