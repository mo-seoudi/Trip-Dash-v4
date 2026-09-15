// Canonical workspace resource policy.
//
// Workspace membership/relationship + permission checks happen before this
// layer in operationalPrismaForWorkspace(). This module adds resource and
// field-level rules without consulting the legacy global role string.

import { PERMISSIONS } from "./accessCatalog.js";

const SCHOOL_EDIT_FIELDS = new Set([
  "tripType", "destination", "origin", "date", "departureTime", "returnDate",
  "returnTime", "students", "staff", "notes", "boosterSeatsRequested",
  "boosterSeatCount", "status", "cancelRequest",
]);
const OPERATOR_EDIT_FIELDS = new Set(["status", "busInfo", "driverInfo", "buses", "cancelRequest"]);
const FINANCE_EDIT_FIELDS = new Set(["price"]);

function has(workspace, permission) {
  return Boolean(workspace?.permissions?.includes(permission));
}

function fieldsWithin(patch, allowed) {
  return Object.keys(patch || {}).every((field) => allowed.has(field));
}

function createdByCaller(access, trip) {
  const appUserId = String(access?.user?.appUserId || "").trim();
  return Boolean(appUserId && trip?.createdByAppUserId && String(trip.createdByAppUserId) === appUserId);
}

function statusTransitionAllowed(workspace, trip, patch) {
  if (!Object.prototype.hasOwnProperty.call(patch || {}, "status") || patch.status === trip?.status) return true;
  const from = trip?.status;
  const to = patch.status;
  if (has(workspace, PERMISSIONS.TRIP_DELETE)) return true;
  if (has(workspace, PERMISSIONS.TRIP_RESPOND)) {
    return (
      (from === "Pending" && ["Accepted", "Rejected"].includes(to)) ||
      (from === "Accepted" && ["Confirmed", "Canceled"].includes(to)) ||
      (from === "Confirmed" && ["Completed", "Canceled"].includes(to)) ||
      (from === "Cancel Requested" && ["Canceled", "Confirmed"].includes(to))
    );
  }
  if (has(workspace, PERMISSIONS.TRIP_EDIT_REQUEST)) {
    return (from === "Pending" && to === "Canceled") ||
      (["Accepted", "Confirmed"].includes(from) && to === "Cancel Requested");
  }
  return false;
}

export function canReadWorkspaceTrip({ workspace }) {
  return has(workspace, PERMISSIONS.TRIP_READ);
}

export function canCreateWorkspaceTrip({ workspace }) {
  return has(workspace, PERMISSIONS.TRIP_CREATE);
}

export function canUpdateWorkspaceTrip({ access, workspace, trip, patch }) {
  if (!workspace || !trip || !patch) return false;
  const fields = Object.keys(patch);
  if (!fields.length) return false;
  if (has(workspace, PERMISSIONS.TRIP_DELETE)) return true;
  if (has(workspace, PERMISSIONS.FINANCE_MANAGE_PRICE) && fieldsWithin(patch, FINANCE_EDIT_FIELDS)) return true;
  if (has(workspace, PERMISSIONS.TRIP_RESPOND) && fieldsWithin(patch, OPERATOR_EDIT_FIELDS)) {
    return statusTransitionAllowed(workspace, trip, patch);
  }
  if (has(workspace, PERMISSIONS.TRIP_EDIT_REQUEST) && fieldsWithin(patch, SCHOOL_EDIT_FIELDS)) {
    // Preserve creator ownership for ordinary school-side editing until a
    // separate school-wide trip-edit permission is deliberately introduced.
    return createdByCaller(access, trip) && statusTransitionAllowed(workspace, trip, patch);
  }
  return false;
}

export function canDeleteWorkspaceTrip({ workspace }) {
  return has(workspace, PERMISSIONS.TRIP_DELETE);
}

export function canReadWorkspacePassengers({ workspace }) {
  return has(workspace, PERMISSIONS.PASSENGER_READ);
}

export function canManageWorkspacePassengers({ access, workspace, trip }) {
  return has(workspace, PERMISSIONS.PASSENGER_MANAGE) && createdByCaller(access, trip);
}

export function canReadWorkspaceBusAssignments({ workspace }) {
  return has(workspace, PERMISSIONS.BUS_ASSIGNMENT_READ);
}

export function canManageWorkspaceBusAssignments({ workspace }) {
  return has(workspace, PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
}

export function canAllocateWorkspacePassengers({ access, workspace, trip }) {
  return has(workspace, PERMISSIONS.PASSENGER_ALLOCATE) && createdByCaller(access, trip);
}
