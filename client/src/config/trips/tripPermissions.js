// client/src/config/trips/tripPermissions.js
// Small, explicit matrix the ActionsCell reads.
export const tripPermissions = {
  admin: {
    canViewAll: true,
    canAcceptReject: true,
    canAssignBus: true,
    canCompleteTrip: true,
    canCancelTrip: true,
    canDeleteIfCancelled: true,
    canResolveCancelRequests: true,
    canRequestCancellation: false,
    // admins can edit any time
    canEditWhen: ["Pending", "Accepted", "Confirmed", "Rejected", "Completed", "Canceled", "Cancel Requested"],
  },

  bus_company: {
    canViewAll: true,
    canAcceptReject: true,
    canAssignBus: true,
    canCompleteTrip: true,
    canCancelTrip: true, // final cancel
    canDeleteIfCancelled: false,
    canResolveCancelRequests: true, // NEW: approve/decline the request
    canRequestCancellation: false,
    canEditWhen: [], // company doesn’t edit trip form
  },

  school_staff: {
    canViewAll: true,
    canAcceptReject: false,
    canAssignBus: false,
    canCompleteTrip: false,
    canCancelTrip: true, // only when Pending (handled in lifecycle)
    canDeleteIfCancelled: false,
    canResolveCancelRequests: false,
    canRequestCancellation: true, // NEW: allows “Request Cancel”
    // 🔧 Add Pending here so “Edit” shows while request is still pending
    canEditWhen: ["Pending", "Accepted", "Confirmed"],
  },

  finance: {
    canViewAll: true,
    canAcceptReject: false,
    canAssignBus: false,
    canCompleteTrip: false,
    canCancelTrip: false,
    canDeleteIfCancelled: false,
    canResolveCancelRequests: false,
    canRequestCancellation: false,
    canEditWhen: [],
  },
};

