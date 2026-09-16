// Canonical workspace resource policy.
// Workspace membership + permission checks happen before this layer.
import { PERMISSIONS } from "./accessCatalog.js";
const SCHOOL_EDIT_FIELDS=new Set(["tripType","destination","origin","date","departureTime","returnDate","returnTime","students","staff","notes","boosterSeatsRequested","boosterSeatCount"]);
const OPERATOR_EDIT_FIELDS=new Set(["busInfo","driverInfo","buses"]);
const FINANCE_EDIT_FIELDS=new Set(["price"]);
const WORKFLOW_ONLY_FIELDS=new Set(["status","cancelRequest"]);
function has(workspace,permission){return Boolean(workspace?.permissions?.includes(permission));}
function fieldsWithin(patch,allowed){return Object.keys(patch||{}).every(field=>allowed.has(field));}
function callerAppUserId(access){return String(access?.user?.appUserId||"").trim();}
function createdByCaller(access,trip){const id=callerAppUserId(access);return Boolean(id&&trip?.createdByAppUserId&&String(trip.createdByAppUserId)===id);}
function hasAdministrativeOverride(workspace){return has(workspace,PERMISSIONS.ACCESS_ADMIN);}
export function workspaceTripReadWhere({access,workspace}){if(!has(workspace,PERMISSIONS.TRIP_READ))return null;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return{};const id=callerAppUserId(access);return id?{createdByAppUserId:id}:null;}
export function canReadWorkspaceTrip({access,workspace,trip=null}){if(!has(workspace,PERMISSIONS.TRIP_READ))return false;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return true;return trip?createdByCaller(access,trip):Boolean(callerAppUserId(access));}
export function canCreateWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_CREATE);}
export function canUpdateWorkspaceTrip({access,workspace,trip,patch}){if(!workspace||!trip||!patch)return false;const fields=Object.keys(patch);if(!fields.length)return false;
  // Lifecycle state is controlled only by explicit workflow endpoints. This is
  // intentionally true even for admins so the same invariants apply to every actor.
  if(fields.some(field=>WORKFLOW_ONLY_FIELDS.has(field)))return false;
  // Trip.price is compatibility/cache data only. Never let a generic patch alter
  // commercial terms after quotation submission, even through an admin override.
  if(fields.includes("price")&&trip.status!=="Accepted")return false;
  if(hasAdministrativeOverride(workspace))return true;if(has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE)&&fieldsWithin(patch,FINANCE_EDIT_FIELDS))return true;if(has(workspace,PERMISSIONS.TRIP_RESPOND)&&fieldsWithin(patch,OPERATOR_EDIT_FIELDS))return true;if(has(workspace,PERMISSIONS.TRIP_EDIT_REQUEST)&&fieldsWithin(patch,SCHOOL_EDIT_FIELDS))return createdByCaller(access,trip);return false;}
export function canDeleteWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_DELETE);}
export function canReadWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_MANAGE)&&createdByCaller(access,trip);}
export function canReadWorkspaceBusAssignments({access,workspace,trip}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspaceBusAssignments({workspace}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_MANAGE);}
// Every commercial mutation belongs to quotation preparation. Finance/admin can
// adjust terms while Accepted, but once submitted the immutable quotation snapshot
// can only be replaced through the explicit revision workflow.
export function canManageWorkspaceBusAssignmentCommercials({workspace,trip}){if(trip?.status!=="Accepted")return false;return hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE)||has(workspace,PERMISSIONS.BUS_ASSIGNMENT_MANAGE);}
export function canSubmitWorkspaceQuotation({workspace,trip}){return Boolean(trip&&trip.status==="Accepted"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_RESPOND)));}
export function canApproveWorkspaceQuotation({workspace,trip}){return Boolean(trip&&trip.status==="Quotation Submitted"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_APPROVE_QUOTE)));}
export function canConfirmWorkspaceTrip({workspace,trip}){return Boolean(trip&&trip.status==="Approved"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_RESPOND)));}
export function canAllocateWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_ALLOCATE)&&createdByCaller(access,trip);}
