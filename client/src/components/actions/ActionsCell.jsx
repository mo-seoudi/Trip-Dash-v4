// src/components/actions/ActionsCell.jsx
import React from "react";
import { universalActions, tripLifecycle } from "../../config/trips/tripLifecycleLogic";
import { tripPermissions } from "../../config/trips/tripPermissions";
import { useAuth } from "../../context/AuthContext";

const ActionsCell = ({
  trip,
  // callbacks
  onStatusChange,
  onView,
  onAssignBus,
  onConfirmAction,
  onEdit,
  onSoftDelete,
  // new controls
  role: roleProp,         // optional override for role (defaults to Auth role)
  hideView = false,       // NEW: hide the "View" button (use in TripDetails modal)
}) => {
  const { profile } = useAuth();
  const role = roleProp ?? profile?.role;

  const currentLifecycle = tripLifecycle[trip.status] || {};
  const statusActions = currentLifecycle.actions || [];
  const allActions = [...universalActions, ...statusActions];
  const permissions = tripPermissions[role] || {};

  const isAllowed = (action) => {
    // Suppress "View" when requested (e.g., inside the details modal)
    if (hideView && action.label === "View") return false;

    if (!action.roles?.includes?.(role)) return false;

    switch (action.label) {
      case "Accept":
      case "Reject":
        return !!permissions.canAcceptReject;
      case "Assign Bus":
        return !!permissions.canAssignBus;
      case "Complete":
        return !!permissions.canCompleteTrip;
      case "Cancel":
        return !!permissions.canCancelTrip;
      case "Delete":
        return !!permissions.canDeleteIfCancelled;
      case "View":
        return !!permissions.canViewAll;
      case "Edit":
        return Array.isArray(permissions.canEditWhen) && permissions.canEditWhen.includes(trip.status);
      default:
        return false;
    }
  };

  const handleClick = (action) => {
    switch (action.trigger) {
      case "assignBusForm":
        return onAssignBus?.(trip);
      case "softDeleteTrip":
        return onSoftDelete?.(trip);
      case "viewTripDetails":
        return onView?.(trip);
      case "editTrip":
        return onEdit?.(trip);
      default:
        if (action.nextStatus && ["Reject", "Cancel", "Complete"].includes(action.label)) {
          return onConfirmAction?.(trip, action.label, action.nextStatus);
        }
        if (action.nextStatus) {
          return onStatusChange?.(trip, action.nextStatus);
        }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allActions.filter(isAllowed).map((action, idx) => (
        <button
          key={`${action.label}-${idx}`}
          type="button"
          onClick={() => handleClick(action)}
          className={`flex items-center px-2 py-1 border rounded text-sm font-semibold transition-colors duration-200 ${
            action.color || "text-gray-700 hover:text-gray-900"
          }`}
        >
          {action.icon && <action.icon className="mr-1" />}
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ActionsCell;
