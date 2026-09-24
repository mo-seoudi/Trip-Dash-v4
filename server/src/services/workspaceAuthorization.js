// Canonical workspace resource policy.
// Workspace membership + permission checks happen before this layer.
import { PERMISSIONS } from "./accessCatalog.js";
const SCHOOL_EDIT_FIELDS=new Set(["tripType","destination","origin","date","departureTime","returnDate","returnTime","students","staff","notes","boosterSeatsRequested","boosterSeatCount"]);
const OPERATOR_EDIT_FIELDS=new Set(["busInfo","driverInfo","buses"]);
const FINANCE_EDIT_FIELDS=new Set(["price"]);
const WORKFLOW_ONLY_FIELDS=new Set(["status","cancelRequest"]);
const PASSENGER_MUTATION_STAGES=new Set(["Accepted","Quotation Submitted","Approved","Confirmed"]);
function has(workspace,permission){return Boolean(workspace?.permissions?.includes(permission));}
function fieldsWithin(patch,allowed){return Object.keys(patch||{}).every(field=>allowed.has(field));}
function callerAppUserId(access){return String(access?.user?.appUserId||"").trim();}
function createdByCaller(access,trip){const id=callerAppUserId(access);return Boolean(id&&trip?.createdByAppUserId&&String(trip.createdByAppUserId)===id);}
function hasAdministrativeOverride(workspace){return has(workspace,PERMISSIONS.ACCESS_ADMIN);}
function passengerMutationStageOpen(trip){return Boolean(trip&&!trip.cancelRequest&&PASSENGER_MUTATION_STAGES.has(trip.status));}
export function workspaceTripReadWhere({access,workspace}){if(!has(workspace,PERMISSIONS.TRIP_READ))return null;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return{};const id=callerAppUserId(access);return id?{createdByAppUserId:id}:null;}
export function canReadWorkspaceTrip({access,workspace,trip=null}){if(!has(workspace,PERMISSIONS.TRIP_READ))return false;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return true;return trip?createdByCaller(access,trip):Boolean(callerAppUserId(access));}
export function canCreateWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_CREATE);}
export function canUpdateWorkspaceTrip({access,workspace,trip,patch}){if(!workspace||!trip||!patch)return false;const fields=Object.keys(patch);if(!fields.length)return false;
  if(fields.some(field=>WORKFLOW_ONLY_FIELDS.has(field)))return false;
  if(fields.some(field=>SCHOOL_EDIT_FIELDS.has(field))&&trip.status!=="Pending")return false;
  if(fields.includes("price")&&trip.status!=="Accepted")return false;
  if(hasAdministrativeOverride(workspace))return true;if(has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE)&&fieldsWithin(patch,FINANCE_EDIT_FIELDS))return true;if(has(workspace,PERMISSIONS.TRIP_RESPOND)&&fieldsWithin(patch,OPERATOR_EDIT_FIELDS))return true;if(has(workspace,PERMISSIONS.TRIP_EDIT_REQUEST)&&fieldsWithin(patch,SCHOOL_EDIT_FIELDS))return createdByCaller(access,trip);return false;}
export function canDeleteWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_DELETE);}
export function canReadWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspacePassengers({access,workspace,trip}){return passengerMutationStageOpen(trip)&&has(workspace,PERMISSIONS.PASSENGER_MANAGE)&&createdByCaller(access,trip);}
export function canReadWorkspaceBusAssignments({access,workspace,trip}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspaceBusAssignments({workspace}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_MANAGE);}
export function canManageWorkspaceBusAssignmentCommercials({workspace,trip}){if(trip?.status!=="Accepted"||trip?.cancelRequest)return false;return hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE)||has(workspace,PERMISSIONS.BUS_ASSIGNMENT_MANAGE);}
export function canSubmitWorkspaceQuotation({workspace,trip}){return Boolean(trip&&!trip.cancelRequest&&trip.status==="Accepted"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_RESPOND)));}
export function canApproveWorkspaceQuotation({workspace,trip}){return Boolean(trip&&!trip.cancelRequest&&trip.status==="Quotation Submitted"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_APPROVE_QUOTE)));}
export function canConfirmWorkspaceTrip({workspace,trip}){return Boolean(trip&&!trip.cancelRequest&&trip.status==="Approved"&&(hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.TRIP_RESPOND)));}
export function canAllocateWorkspacePassengers({access,workspace,trip}){return passengerMutationStageOpen(trip)&&has(workspace,PERMISSIONS.PASSENGER_ALLOCATE)&&createdByCaller(access,trip);}
