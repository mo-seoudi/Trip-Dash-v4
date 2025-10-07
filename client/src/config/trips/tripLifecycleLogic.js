// tripLifecycleLogic.js
import {
  RxEyeOpen,
  RxPencil2,
  RxCheckCircled,
  RxCrossCircled,
  RxTrash,
  RxCalendarPlus,
  RxClipboardCheck,
  RxSlash,
} from "react-icons/rx";

// Keep your usual pill look via ActionsCell; we just define buttons here.
export const universalActions = [
  {
    label: "View",
    roles: ["admin", "bus_company", "school_staff", "finance"],
    icon: RxEyeOpen,
    trigger: "viewTripDetails",
    color:
      "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
  },
  {
    label: "Edit",
    roles: ["admin", "school_staff"], // actual availability is further filtered by canEditWhen
    icon: RxPencil2,
    trigger: "editTrip",
    color:
      "text-blue-700 hover:text-blue-900 border border-blue-300 hover:border-blue-400",
  },
];

const Accept = {
  label: "Accept",
  roles: ["bus_company", "admin"],
  icon: RxCheckCircled,
  nextStatus: "Accepted",
  color: "text-green-700 hover:text-green-900 border border-green-300",
};

const Reject = {
  label: "Reject",
  roles: ["bus_company", "admin"],
  icon: RxCrossCircled,
  nextStatus: "Rejected",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

const AssignBus = {
  label: "Assign Bus",
  roles: ["bus_company", "admin"],
  icon: RxCalendarPlus,
  trigger: "assignBusForm",
  color: "text-blue-700 hover:text-blue-900 border border-blue-300",
};

const Complete = {
  label: "Complete",
  roles: ["bus_company", "admin"],
  icon: RxClipboardCheck,
  nextStatus: "Completed",
  color: "text-green-700 hover:text-green-900 border border-green-300",
};

const CancelImmediate = {
  // used when Pending for staff / or admin as final cancel anywhere
  label: "Cancel",
  roles: ["school_staff", "admin"],
  icon: RxCrossCircled,
  nextStatus: "Canceled",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};

// NEW – staff request, company/admin resolve:
const RequestCancel = {
  label: "Request Cancel",
  roles: ["school_staff"],
  icon: RxSlash,
  nextStatus: "Cancel Requested",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};
const ApproveCancel = {
  label: "Approve Cancel",
  roles: ["bus_company", "admin"],
  icon: RxCheckCircled,
  nextStatus: "Canceled",
  color: "text-red-700 hover:text-red-900 border border-red-300",
};
const DeclineCancel = {
  label: "Decline Request",
  roles: ["bus_company", "admin"],
  icon: RxCrossCircled,
  // When declining we roll back to a working state. If you prefer “Accepted”, change nextStatus.
  nextStatus: "Confirmed",
  color:
    "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
};

const DeleteIfCancelled = {
  label: "Delete",
  roles: ["admin"],
  icon: RxTrash,
  trigger: "softDeleteTrip",
  color:
    "text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400",
};

export const tripLifecycle = {
  Pending: {
    actions: [
      Accept,
      Reject,
      CancelImmediate, // staff can cancel their own pending request
    ],
  },

  Accepted: {
    actions: [
      AssignBus,
      // staff can still request to cancel
      RequestCancel,
      // admins still retain the power to direct-cancel
      { ...CancelImmediate, roles: ["admin"] },
    ],
  },

  Confirmed: {
    actions: [
      Complete,
      RequestCancel,
      { ...CancelImmediate, roles: ["admin"] },
    ],
  },

  "Cancel Requested": {
    actions: [ApproveCancel, DeclineCancel],
  },

  Rejected: { actions: [] },

  Completed: { actions: [] },

  Canceled: {
    actions: [DeleteIfCancelled],
  },
};
