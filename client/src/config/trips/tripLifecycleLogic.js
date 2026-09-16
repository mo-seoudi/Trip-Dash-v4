// client/src/config/trips/tripLifecycleLogic.js
import{FaCheckCircle,FaTimesCircle,FaPlusCircle,FaEye,FaTrash,FaEdit}from"react-icons/fa";
export const universalActions=[{label:"View",icon:FaEye,trigger:"viewTripDetails",color:"text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400"},{label:"Edit",icon:FaEdit,trigger:"editTrip",color:"text-blue-700 hover:text-blue-900 border border-blue-300 hover:border-blue-400"}];
const Accept={label:"Accept",icon:FaCheckCircle,nextStatus:"Accepted",color:"text-green-700 hover:text-green-900 border border-green-300"};
const Reject={label:"Reject",icon:FaTimesCircle,nextStatus:"Rejected",color:"text-red-700 hover:text-red-900 border border-red-300"};
const PrepareQuotation={label:"Prepare Quotation",icon:FaPlusCircle,trigger:"assignBusForm",color:"text-blue-700 hover:text-blue-900 border border-blue-300"};
const Finalise={label:"Finalise & Confirm",icon:FaCheckCircle,trigger:"finaliseTrip",color:"text-green-700 hover:text-green-900 border border-green-300"};
const Complete={label:"Complete",icon:FaCheckCircle,nextStatus:"Completed",color:"text-green-700 hover:text-green-900 border border-green-300"};
const CancelImmediate={label:"Cancel",icon:FaTimesCircle,nextStatus:"Canceled",color:"text-red-700 hover:text-red-900 border border-red-300"};
const RequestCancel={label:"Request Cancel",icon:FaTimesCircle,nextStatus:"Cancel Requested",color:"text-red-700 hover:text-red-900 border border-red-300"};
const ApproveCancel={label:"Approve Cancel",icon:FaCheckCircle,nextStatus:"Canceled",color:"text-red-700 hover:text-red-900 border border-red-300"};
const DeclineCancel={label:"Decline Request",icon:FaTimesCircle,nextStatus:"Confirmed",color:"text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400"};
const DeleteIfCancelled={label:"Delete",icon:FaTrash,trigger:"softDeleteTrip",color:"text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400"};
export const tripLifecycle={Pending:{actions:[Accept,Reject,CancelImmediate]},Accepted:{actions:[PrepareQuotation,RequestCancel,CancelImmediate]},"Quotation Submitted":{actions:[RequestCancel]},Approved:{actions:[Finalise,RequestCancel]},Confirmed:{actions:[Complete,RequestCancel,CancelImmediate]},"Cancel Requested":{actions:[ApproveCancel,DeclineCancel]},Rejected:{actions:[]},Completed:{actions:[]},Canceled:{actions:[DeleteIfCancelled]}};
