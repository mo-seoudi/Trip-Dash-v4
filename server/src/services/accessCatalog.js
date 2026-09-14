// server/src/services/accessCatalog.js
// Canonical application authorization vocabulary.
//
// Roles are bundles of permissions. Route/service authorization should prefer
// permission checks over hard-coded role checks as the rebuild progresses.

export const ROLE_KEYS = Object.freeze({
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  GROUP_STAFF: "group_staff",
  SCHOOL_STAFF: "school_staff",
  BUS_OPERATOR: "bus_operator",
  SERVICE_PARTNER: "service_partner",
  FINANCE: "finance",
});

export const PERMISSIONS = Object.freeze({
  ACCESS_ADMIN: "access.admin",
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_MANAGE: "organization.manage",
  USER_READ: "user.read",
  USER_MANAGE: "user.manage",

  TRIP_READ: "trip.read",
  TRIP_CREATE: "trip.create",
  TRIP_EDIT_REQUEST: "trip.edit_request",
  TRIP_RESPOND: "trip.respond",
  TRIP_CANCEL: "trip.cancel",
  TRIP_DELETE: "trip.delete",

  BUS_ASSIGNMENT_READ: "bus_assignment.read",
  BUS_ASSIGNMENT_MANAGE: "bus_assignment.manage",

  PASSENGER_READ: "passenger.read",
  PASSENGER_MANAGE: "passenger.manage",
  PASSENGER_ALLOCATE: "passenger.allocate",

  FINANCE_READ: "finance.read",
  FINANCE_MANAGE_PRICE: "finance.manage_price",
});

const P = PERMISSIONS;

export const ROLE_PERMISSION_CATALOG = Object.freeze({
  [ROLE_KEYS.SUPER_ADMIN]: Object.values(P),

  [ROLE_KEYS.TENANT_ADMIN]: [
    P.ACCESS_ADMIN,
    P.ORGANIZATION_READ,
    P.ORGANIZATION_MANAGE,
    P.USER_READ,
    P.USER_MANAGE,
    P.TRIP_READ,
    P.TRIP_CREATE,
    P.TRIP_EDIT_REQUEST,
    P.TRIP_RESPOND,
    P.TRIP_CANCEL,
    P.TRIP_DELETE,
    P.BUS_ASSIGNMENT_READ,
    P.BUS_ASSIGNMENT_MANAGE,
    P.PASSENGER_READ,
    P.PASSENGER_MANAGE,
    P.PASSENGER_ALLOCATE,
    P.FINANCE_READ,
    P.FINANCE_MANAGE_PRICE,
  ],

  [ROLE_KEYS.GROUP_STAFF]: [
    P.ORGANIZATION_READ,
    P.TRIP_READ,
    P.TRIP_CREATE,
    P.TRIP_EDIT_REQUEST,
    P.TRIP_CANCEL,
    P.BUS_ASSIGNMENT_READ,
    P.PASSENGER_READ,
    P.PASSENGER_MANAGE,
    P.PASSENGER_ALLOCATE,
  ],

  [ROLE_KEYS.SCHOOL_STAFF]: [
    P.ORGANIZATION_READ,
    P.TRIP_READ,
    P.TRIP_CREATE,
    P.TRIP_EDIT_REQUEST,
    P.TRIP_CANCEL,
    P.BUS_ASSIGNMENT_READ,
    P.PASSENGER_READ,
    P.PASSENGER_MANAGE,
    P.PASSENGER_ALLOCATE,
  ],

  [ROLE_KEYS.BUS_OPERATOR]: [
    P.ORGANIZATION_READ,
    P.TRIP_READ,
    P.TRIP_RESPOND,
    P.BUS_ASSIGNMENT_READ,
    P.BUS_ASSIGNMENT_MANAGE,
  ],

  [ROLE_KEYS.SERVICE_PARTNER]: [
    P.ORGANIZATION_READ,
    P.TRIP_READ,
    P.TRIP_CREATE,
    P.TRIP_EDIT_REQUEST,
    P.TRIP_RESPOND,
    P.TRIP_CANCEL,
    P.BUS_ASSIGNMENT_READ,
  ],

  [ROLE_KEYS.FINANCE]: [
    P.ORGANIZATION_READ,
    P.TRIP_READ,
    P.BUS_ASSIGNMENT_READ,
    P.FINANCE_READ,
    P.FINANCE_MANAGE_PRICE,
  ],
});

const LEGACY_ROLE_ALIASES = new Map([
  ["admin", ROLE_KEYS.TENANT_ADMIN],
  ["super_admin", ROLE_KEYS.SUPER_ADMIN],
  ["school_staff", ROLE_KEYS.SCHOOL_STAFF],
  ["staff", ROLE_KEYS.SCHOOL_STAFF],
  ["group_staff", ROLE_KEYS.GROUP_STAFF],
  ["trip_manager", ROLE_KEYS.SERVICE_PARTNER],
  ["service_partner", ROLE_KEYS.SERVICE_PARTNER],
  ["bus_company", ROLE_KEYS.BUS_OPERATOR],
  ["bus_operator", ROLE_KEYS.BUS_OPERATOR],
  ["operator", ROLE_KEYS.BUS_OPERATOR],
  ["finance", ROLE_KEYS.FINANCE],
]);

export function canonicalRoleKey(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  return LEGACY_ROLE_ALIASES.get(normalized) || normalized;
}

export function permissionsForRoles(roles = []) {
  const permissions = new Set();
  for (const role of roles) {
    const canonical = canonicalRoleKey(role);
    for (const permission of ROLE_PERMISSION_CATALOG[canonical] || []) {
      permissions.add(permission);
    }
  }
  return [...permissions].sort();
}
