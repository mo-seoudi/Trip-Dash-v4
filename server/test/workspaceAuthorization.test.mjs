import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../src/services/accessCatalog.js";
import {
  canAllocateWorkspacePassengers,
  canManageWorkspaceBusAssignments,
  canManageWorkspacePassengers,
  canUpdateWorkspaceTrip,
} from "../src/services/workspaceAuthorization.js";

const access = { user: { appUserId: "user-1" } };
const ownTrip = { createdByAppUserId: "user-1", status: "Pending" };
const otherTrip = { createdByAppUserId: "user-2", status: "Pending" };
const workspace = (...permissions) => ({ schoolId: "school-1", permissions });

test("school edit permission remains creator-scoped", () => {
  const ws = workspace(PERMISSIONS.TRIP_EDIT_REQUEST);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: ownTrip, patch: { destination: "Museum" } }), true);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: otherTrip, patch: { destination: "Museum" } }), false);
});

test("bus response permission cannot edit school request fields", () => {
  const ws = workspace(PERMISSIONS.TRIP_RESPOND, PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: ownTrip, patch: { status: "Accepted" } }), true);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: ownTrip, patch: { destination: "Changed" } }), false);
  assert.equal(canManageWorkspaceBusAssignments({ workspace: ws }), true);
});

test("finance price permission cannot change operational fields", () => {
  const ws = workspace(PERMISSIONS.FINANCE_MANAGE_PRICE);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: ownTrip, patch: { price: "500.00" } }), true);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: ownTrip, patch: { status: "Accepted" } }), false);
});

test("passenger permissions remain separate from bus assignment management", () => {
  const operator = workspace(PERMISSIONS.BUS_ASSIGNMENT_MANAGE);
  assert.equal(canManageWorkspacePassengers({ access, workspace: operator, trip: ownTrip }), false);
  assert.equal(canAllocateWorkspacePassengers({ access, workspace: operator, trip: ownTrip }), false);
});

test("school passenger management and allocation remain creator-scoped", () => {
  const ws = workspace(PERMISSIONS.PASSENGER_MANAGE, PERMISSIONS.PASSENGER_ALLOCATE);
  assert.equal(canManageWorkspacePassengers({ access, workspace: ws, trip: ownTrip }), true);
  assert.equal(canManageWorkspacePassengers({ access, workspace: ws, trip: otherTrip }), false);
  assert.equal(canAllocateWorkspacePassengers({ access, workspace: ws, trip: ownTrip }), true);
  assert.equal(canAllocateWorkspacePassengers({ access, workspace: ws, trip: otherTrip }), false);
});
