// src/components/actions/ActionsCell.jsx
import React from "react";
import { universalActions, tripLifecycle } from "../../config/trips/tripLifecycleLogic";
import { tripPermissions } from "../../config/trips/tripPermissions";
import { useAuth } from "../../context/AuthContext";

const ActionsCell = ({
  trip,
  onStatusChange,
  onView,
  onAssignBus,
  onConfirmAction,
  onEdit,
  onSoftDelete,
  hideView = false, // keep support so TripDetails can hide View
}) => {
  const { profile } = useAuth();
  const role = profile?.role;
  const currentLifecycle = tripLifecycle[trip.status] || {};
  const statusActions = currentLifecycle.actions || [];
  const allActions = [...universalActions, ...statusActions];
  const permissions = tripPermissions[role] || {};

  const isAllowed = (action) => {
    if (!action.roles.includes(role)) return false;

    switch (action.label) {
      case "Accept":
      case "Reject":
        return permissions.canAcceptReject;
      case "Assign Bus":
        return permissions.canAssignBus;
      case "Complete":
        return permissions.canCompleteTrip;
      case "Cancel":
        // allowed generally for admin; for staff we rely on lifecycle (Pending only)
        return permissions.canCancelTrip;
      case "Delete":
        return permissions.canDeleteIfCancelled;
      case "View":
        return permissions.canViewAll && !hideView;
      case "Edit":
        return (permissions.canEditWhen || []).includes(trip.status);
      case "Request Cancel":
        return permissions.canRequestCancellation;
      case "Approve Cancel":
      case "Decline Request":
        return permissions.canResolveCancelRequests;
      default:
        return false;
    }
  };

  const handleClick = (action) => {
    switch (action.trigger) {
      case "assignBusForm":
        return onAssignBus(trip);
      case "softDeleteTrip":
        return onSoftDelete(trip);
      case "viewTripDetails":
        return onView(trip);
      case "editTrip":
        return onEdit(trip);
      default: {
        if (
          action.nextStatus &&
          // run through confirm modal for these
          ["Reject", "Cancel", "Complete", "Approve Cancel", "Decline Request"].includes(
            action.label
          )
        ) {
          return onConfirmAction(trip, action.label, action.nextStatus);
        }
        if (action.nextStatus) {
          return onStatusChange(trip, action.nextStatus);
        }
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allActions
        .filter(isAllowed)
        .map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(action)}
            className={`flex items-center px-2 py-1 rounded text-sm font-semibold transition-colors duration-200 ${action.color || "text-gray-700 border border-gray-300 hover:text-gray-900 hover:border-gray-400"}`}
          >
            {action.icon && <action.icon className="mr-1" />}
            {action.label}
          </button>
        ))}
    </div>
  );
};

export default ActionsCell;

