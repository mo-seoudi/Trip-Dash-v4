// tripLifecycleLogic.js
import { FaCheckCircle, FaTimesCircle, FaPlusCircle, FaEye, FaTrash, FaEdit } from "react-icons/fa";

export const universalActions = [
  {
    label: "View",
    icon: FaEye,
    roles: ["school_staff", "bus_company", "admin"],
    trigger: "viewTripDetails",
    color: "text-blue-500 hover:text-blue-700",
  },
  {
    label: "Edit",
    icon: FaEdit,
    roles: ["school_staff", "bus_company"],
    trigger: "editTrip",
    color: "text-yellow-600 hover:text-yellow-800",
  }
];

export const tripLifecycle = {
  Pending: {
    actions: [
      {
        label: "Accept",
        icon: FaCheckCircle,
        nextStatus: "Accepted",
        roles: ["bus_company"],
        color: "text-green-600 hover:text-green-800",
      },
      {
        label: "Reject",
        icon: FaTimesCircle,
        nextStatus: "Rejected",
        roles: ["bus_company"],
        color: "text-red-600 hover:text-red-800",
      },
    ],
  },
  Accepted: {
    actions: [
      {
        label: "Assign Bus",
        icon: FaPlusCircle,
        trigger: "assignBusForm",
        roles: ["bus_company"],
        color: "text-blue-600 hover:text-blue-800",
      },
    ],
  },
  Confirmed: {
    actions: [
      {
        label: "Complete",
        icon: FaCheckCircle,
        nextStatus: "Completed",
        roles: ["bus_company"],
        color: "text-green-600 hover:text-green-800",
      },
    ],
  },
  Rejected: {
    actions: [
      {
        label: "Cancel",
        icon: FaTimesCircle,
        nextStatus: "Cancelled",
        roles: ["bus_company"],
        color: "text-gray-600 hover:text-gray-800",
      },
    ],
  },
  Cancelled: {
    actions: [
      {
        label: "Delete",
        icon: FaTrash,
        trigger: "softDeleteTrip",
        roles: ["bus_company"],
        color: "text-red-600 hover:text-red-800",
      },
    ],
  },
  Completed: {
    actions: [],
  },
};
