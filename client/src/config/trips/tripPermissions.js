// client/src/config/trips/tripPermissions.js

export const tripPermissions = {
  school_staff: {
    canRequestTrip: true,
    canViewAll: true,
    canEditWhen: ["Pending", "Rejected", "Accepted", "Confirmed"],
    editModeByStatus: {
      Pending: "direct",
      Accepted: "request",
      Confirmed: "request",
      Rejected: "resubmit",
      Completed: "none",
      Cancelled: "none",
    },
  },
  bus_company: {
    canViewAll: true,
    canAcceptReject: true,
    canAssignBus: true,
    canCompleteTrip: true,
    canCancelTrip: true,
    canDeleteIfCancelled: true,
    canEditFields: ["price", "driver", "busDetails"],
  },
  admin: {
    canViewAll: true,
    canEditAll: false,
    futureAccess: true,
  },
};
