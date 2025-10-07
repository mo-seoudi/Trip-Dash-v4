// client/src/config/trips/tripLifecycleLogic.js
import {
  FaCheckCircle,
  FaTimesCircle,
  FaPlusCircle,
  FaEye,
  FaTrash,
  FaEdit,
} from "react-icons/fa";

/**
 * Buttons available across many states.
 * Visibility is further filtered by tripPermissions in ActionsCell.
 */
export const universalActions = [
  {
    label: "View",
    roles: ["admin", "bus_company", "school_staff", "finance"],
    icon: FaEye,
    trigger: "viewTripDetails",
    color:
      "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
  },
  {
    label: "Edit",
    roles: ["admin", "school_staff"], // actual availability filtered by canEditWhen
    icon: FaEdit,
    trigger: "editTrip",
    color:
      "text-blue-700 hover:text-blue-900 border border-blue-300 hover:border-blue-400",
  },
];

/* ---------- Action definitions (Font Awesome icons) ---------- */

const Accept = {
  label: "Accept",
  roles: ["bus_company", "admin"],
  icon: FaCheckCircle,
  nextStatus: "Accepted",
  color: "text-green-700 hover:text-green-900 border border-green-300",
};

const Reject = {
  label: "Reject",
  roles: ["bus_company", "admin"],
  icon: FaTimesCircle,
  nextStatus: "Rejected",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

const AssignBus = {
  label: "Assign Bus",
  roles: ["bus_company", "admin"],
  icon: FaPlusCircle,
  trigger: "assignBusForm",
  color: "text-blue-700 hover:text-blue-900 border border-blue-300",
};

const Complete = {
  label: "Complete",
  roles: ["bus_company", "admin"],
  icon: FaCheckCircle,
  nextStatus: "Completed",
  color: "text-green-700 hover:text-green-900 border border-green-300",
};

const CancelImmediate = {
  // staff can cancel while Pending; admin can cancel anytime (lifecycle filtering below)
  label: "Cancel",
  roles: ["school_staff", "admin"],
  icon: FaTimesCircle,
  nextStatus: "Canceled",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

// Staff requests a cancel; company/admin resolve it.
const RequestCancel = {
  label: "Request Cancel",
  roles: ["school_staff"],
  icon: FaTimesCircle,
  nextStatus: "Cancel Requested",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

const ApproveCancel = {
  label: "Approve Cancel",
  roles: ["bus_company", "admin"],
  icon: FaCheckCircle,
  nextStatus: "Canceled",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

const DeclineCancel = {
  label: "Decline Request",
  roles: ["bus_company", "admin"],
  icon: FaTimesCircle,
  // roll back to a working state (use "Accepted" if that matches your flow better)
  nextStatus: "Confirmed",
  color:
    "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
};

const DeleteIfCancelled = {
  label: "Delete",
  roles: ["admin"],
  icon: FaTrash,
  trigger: "softDeleteTrip",
  color:
    "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
};

/* ---------- Lifecycle map: which actions show at each status ---------- */

export const tripLifecycle = {
  Pending: {
    actions: [Accept, Reject, CancelImmediate], // staff cancel; company/admin accept/reject
  },

  Accepted: {
    actions: [
      AssignBus,
      RequestCancel, // staff may request cancel
      { ...CancelImmediate, roles: ["admin"] }, // admin can still direct-cancel
    ],
  },

  Confirmed: {
    actions: [
      Complete,
      RequestCancel, // staff may request cancel
      { ...CancelImmediate, roles: ["admin"] },
    ],
  },

  "Cancel Requested": {
    actions: [ApproveCancel, DeclineCancel], // handled by bus_company/admin
  },

  Rejected: { actions: [] },

  Completed: { actions: [] },

  Canceled: {
    actions: [DeleteIfCancelled], // admin cleanup
  },
};
