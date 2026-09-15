// Canonical workspace resource policy.
// Workspace membership + permission checks happen before this layer.
import { PERMISSIONS } from "./accessCatalog.js";
const SCHOOL_EDIT_FIELDS=new Set(["tripType","destination","origin","date","departureTime","returnDate","returnTime","students","staff","notes","boosterSeatsRequested","boosterSeatCount","status","cancelRequest"]);
const OPERATOR_EDIT_FIELDS=new Set(["status","busInfo","driverInfo","buses","cancelRequest"]);
const FINANCE_EDIT_FIELDS=new Set(["price"]);
function has(workspace,permission){return Boolean(workspace?.permissions?.includes(permission));}
function fieldsWithin(patch,allowed){return Object.keys(patch||{}).every(field=>allowed.has(field));}
function callerAppUserId(access){return String(access?.user?.appUserId||"").trim();}
function createdByCaller(access,trip){const id=callerAppUserId(access);return Boolean(id&&trip?.createdByAppUserId&&String(trip.createdByAppUserId)===id);}
function hasAdministrativeOverride(workspace){return has(workspace,PERMISSIONS.ACCESS_ADMIN);}
function statusTransitionAllowed(workspace,trip,patch){if(!Object.prototype.hasOwnProperty.call(patch||{},"status")||patch.status===trip?.status)return true;const from=trip?.status,to=patch.status;if(hasAdministrativeOverride(workspace))return true;if(has(workspace,PERMISSIONS.TRIP_RESPOND))return(from==="Pending"&&["Accepted","Rejected"].includes(to))||(from==="Accepted"&&["Confirmed","Canceled"].includes(to))||(from==="Confirmed"&&["Completed","Canceled"].includes(to))||(from==="Cancel Requested"&&["Canceled","Confirmed"].includes(to));if(has(workspace,PERMISSIONS.TRIP_EDIT_REQUEST))return(from==="Pending"&&to==="Canceled")||(["Accepted","Confirmed"].includes(from)&&to==="Cancel Requested");return false;}
export function workspaceTripReadWhere({access,workspace}){if(!has(workspace,PERMISSIONS.TRIP_READ))return null;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return{};const id=callerAppUserId(access);return id?{createdByAppUserId:id}:null;}
export function canReadWorkspaceTrip({access,workspace,trip=null}){if(!has(workspace,PERMISSIONS.TRIP_READ))return false;if(has(workspace,PERMISSIONS.TRIP_READ_ALL))return true;return trip?createdByCaller(access,trip):Boolean(callerAppUserId(access));}
export function canCreateWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_CREATE);}
export function canUpdateWorkspaceTrip({access,workspace,trip,patch}){if(!workspace||!trip||!patch)return false;const fields=Object.keys(patch);if(!fields.length)return false;if(hasAdministrativeOverride(workspace))return true;if(has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE)&&fieldsWithin(patch,FINANCE_EDIT_FIELDS))return true;if(has(workspace,PERMISSIONS.TRIP_RESPOND)&&fieldsWithin(patch,OPERATOR_EDIT_FIELDS))return statusTransitionAllowed(workspace,trip,patch);if(has(workspace,PERMISSIONS.TRIP_EDIT_REQUEST)&&fieldsWithin(patch,SCHOOL_EDIT_FIELDS))return createdByCaller(access,trip)&&statusTransitionAllowed(workspace,trip,patch);return false;}
export function canDeleteWorkspaceTrip({workspace}){return has(workspace,PERMISSIONS.TRIP_DELETE);}
export function canReadWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_MANAGE)&&createdByCaller(access,trip);}
export function canReadWorkspaceBusAssignments({access,workspace,trip}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_READ)&&canReadWorkspaceTrip({access,workspace,trip});}
export function canManageWorkspaceBusAssignments({workspace}){return has(workspace,PERMISSIONS.BUS_ASSIGNMENT_MANAGE);}
// Commercial bus-assignment fields are deliberately separate from operational
// bus management. Operators can assign/operate buses without gaining authority
// to set prices or currency.
export function canManageWorkspaceBusAssignmentCommercials({workspace}){return hasAdministrativeOverride(workspace)||has(workspace,PERMISSIONS.FINANCE_MANAGE_PRICE);}
export function canAllocateWorkspacePassengers({access,workspace,trip}){return has(workspace,PERMISSIONS.PASSENGER_ALLOCATE)&&createdByCaller(access,trip);}
