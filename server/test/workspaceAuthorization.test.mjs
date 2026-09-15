import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "../src/services/accessCatalog.js";
import {
  canAllocateWorkspacePassengers,
  canManageWorkspaceBusAssignments,
  canManageWorkspacePassengers,
  canReadWorkspaceTrip,
  canUpdateWorkspaceTrip,
  workspaceTripReadWhere,
} from "../src/services/workspaceAuthorization.js";

const access = { user: { appUserId: "user-1" } };
const ownTrip = { createdByAppUserId: "user-1", status: "Pending" };
const otherTrip = { createdByAppUserId: "user-2", status: "Pending" };
const workspace = (...permissions) => ({ schoolId: "school-1", permissions });

test("ordinary trip read permission is creator-scoped", () => {
  const ws = workspace(PERMISSIONS.TRIP_READ);
  assert.deepEqual(workspaceTripReadWhere({ access, workspace: ws }), { createdByAppUserId: "user-1" });
  assert.equal(canReadWorkspaceTrip({ access, workspace: ws, trip: ownTrip }), true);
  assert.equal(canReadWorkspaceTrip({ access, workspace: ws, trip: otherTrip }), false);
});

test("workspace-wide trip read requires explicit read-all permission", () => {
  const ws = workspace(PERMISSIONS.TRIP_READ, PERMISSIONS.TRIP_READ_ALL);
  assert.deepEqual(workspaceTripReadWhere({ access, workspace: ws }), {});
  assert.equal(canReadWorkspaceTrip({ access, workspace: ws, trip: ownTrip }), true);
  assert.equal(canReadWorkspaceTrip({ access, workspace: ws, trip: otherTrip }), true);
});

test("trip read fails closed without a canonical app user identity", () => {
  const ws = workspace(PERMISSIONS.TRIP_READ);
  assert.equal(workspaceTripReadWhere({ access: { user: {} }, workspace: ws }), null);
  assert.equal(canReadWorkspaceTrip({ access: { user: {} }, workspace: ws, trip: ownTrip }), false);
});

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

test("trip delete permission does not imply administrative edit override", () => {
  const ws = workspace(PERMISSIONS.TRIP_DELETE);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: otherTrip, patch: { destination: "Changed" } }), false);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: otherTrip, patch: { status: "Completed" } }), false);
});

test("access admin permission provides explicit administrative edit override", () => {
  const ws = workspace(PERMISSIONS.ACCESS_ADMIN);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: otherTrip, patch: { destination: "Changed" } }), true);
  assert.equal(canUpdateWorkspaceTrip({ access, workspace: ws, trip: otherTrip, patch: { status: "Completed" } }), true);
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
