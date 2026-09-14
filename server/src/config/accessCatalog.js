// server/src/config/accessCatalog.js
// Canonical application roles/permissions for the rebuilt backend.
//
// Role keys are stable backend contracts. UI labels may change without changing
// these keys. Legacy role names are handled only by migration/compatibility code.

export const PERMISSIONS = Object.freeze({
  PLATFORM_MANAGE: "platform.manage",
  TENANT_MANAGE: "tenant.manage",
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_MANAGE: "organization.manage",
  RELATIONSHIP_MANAGE: "relationship.manage",
  USER_READ: "user.read",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",

  TRIP_READ: "trip.read",
  TRIP_CREATE: "trip.create",
  TRIP_EDIT: "trip.edit",
  TRIP_CANCEL: "trip.cancel",
  TRIP_RESPOND: "trip.respond",
  TRIP_COMPLETE: "trip.complete",

  BUS_ASSIGNMENT_READ: "bus_assignment.read",
  BUS_ASSIGNMENT_MANAGE: "bus_assignment.manage",

  PASSENGER_READ: "passenger.read",
  PASSENGER_MANAGE: "passenger.manage",
  PASSENGER_ALLOCATE: "passenger.allocate",

  FINANCE_READ: "finance.read",
  FINANCE_MANAGE_PRICE: "finance.manage_price",
});

export const ROLE_KEYS = Object.freeze({
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  GROUP_STAFF: "group_staff",
  SCHOOL_STAFF: "school_staff",
  BUS_OPERATOR: "bus_operator",
  SERVICE_PARTNER: "service_partner",
  FINANCE: "finance",
});

const P = PERMISSIONS;

export const SYSTEM_ROLES = Object.freeze({
  [ROLE_KEYS.SUPER_ADMIN]: {
    name: "Super Admin",
    description: "Platform-wide administration.",
    permissions: Object.values(P),
  },
  [ROLE_KEYS.TENANT_ADMIN]: {
    name: "Tenant Admin",
    description: "Administration within one tenant/customer boundary.",
    permissions: [
      P.TENANT_MANAGE,
      P.ORGANIZATION_READ,
      P.ORGANIZATION_MANAGE,
      P.RELATIONSHIP_MANAGE,
      P.USER_READ,
      P.USER_MANAGE,
      P.ROLE_MANAGE,
      P.TRIP_READ,
      P.TRIP_CREATE,
      P.TRIP_EDIT,
      P.TRIP_CANCEL,
      P.TRIP_RESPOND,
      P.TRIP_COMPLETE,
      P.BUS_ASSIGNMENT_READ,
      P.BUS_ASSIGNMENT_MANAGE,
      P.PASSENGER_READ,
      P.PASSENGER_MANAGE,
      P.PASSENGER_ALLOCATE,
      P.FINANCE_READ,
      P.FINANCE_MANAGE_PRICE,
    ],
  },
  [ROLE_KEYS.GROUP_STAFF]: {
    name: "Group / Internal Staff",
    description: "Operational staff whose organization covers multiple schools.",
    permissions: [
      P.ORGANIZATION_READ,
      P.TRIP_READ,
      P.TRIP_CREATE,
      P.TRIP_EDIT,
      P.TRIP_CANCEL,
      P.BUS_ASSIGNMENT_READ,
      P.PASSENGER_READ,
      P.PASSENGER_MANAGE,
      P.PASSENGER_ALLOCATE,
    ],
  },
  [ROLE_KEYS.SCHOOL_STAFF]: {
    name: "School Staff",
    description: "School users creating and managing trips for their school.",
    permissions: [
      P.ORGANIZATION_READ,
      P.TRIP_READ,
      P.TRIP_CREATE,
      P.TRIP_EDIT,
      P.TRIP_CANCEL,
      P.BUS_ASSIGNMENT_READ,
      P.PASSENGER_READ,
      P.PASSENGER_MANAGE,
      P.PASSENGER_ALLOCATE,
    ],
  },
  [ROLE_KEYS.BUS_OPERATOR]: {
    name: "Bus Operator",
    description: "Transport-provider users responding to trips and assigning vehicles.",
    permissions: [
      P.ORGANIZATION_READ,
      P.TRIP_READ,
      P.TRIP_RESPOND,
      P.TRIP_COMPLETE,
      P.BUS_ASSIGNMENT_READ,
      P.BUS_ASSIGNMENT_MANAGE,
    ],
  },
  [ROLE_KEYS.SERVICE_PARTNER]: {
    name: "Service Partner",
    description: "Partner users managing trips on behalf of related schools.",
    permissions: [
      P.ORGANIZATION_READ,
      P.TRIP_READ,
      P.TRIP_CREATE,
      P.TRIP_EDIT,
      P.TRIP_CANCEL,
      P.BUS_ASSIGNMENT_READ,
      P.PASSENGER_READ,
      P.PASSENGER_MANAGE,
      P.PASSENGER_ALLOCATE,
    ],
  },
  [ROLE_KEYS.FINANCE]: {
    name: "Finance",
    description: "Finance users with read access and trip-pricing responsibilities.",
    permissions: [
      P.ORGANIZATION_READ,
      P.TRIP_READ,
      P.BUS_ASSIGNMENT_READ,
      P.FINANCE_READ,
      P.FINANCE_MANAGE_PRICE,
    ],
  },
});

export function permissionsForRole(roleKey) {
  return SYSTEM_ROLES[roleKey]?.permissions || [];
}
