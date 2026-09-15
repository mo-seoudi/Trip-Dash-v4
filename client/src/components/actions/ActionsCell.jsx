// src/components/actions/ActionsCell.jsx
import React from "react";
import { universalActions, tripLifecycle } from "../../config/trips/tripLifecycleLogic";
import { useAuth } from "../../context/AuthContext";

const P = {
  TRIP_READ: "trip.read",
  TRIP_EDIT_REQUEST: "trip.edit_request",
  TRIP_RESPOND: "trip.respond",
  TRIP_DELETE: "trip.delete",
  BUS_ASSIGNMENT_MANAGE: "bus_assignment.manage",
  ACCESS_ADMIN: "access.admin",
};

const ActionsCell = ({
  trip,
  onStatusChange,
  onView,
  onAssignBus,
  onConfirmAction,
  onEdit,
  onSoftDelete,
  hideView = false,
}) => {
  const { activeWorkspace } = useAuth();
  const permissions = new Set(activeWorkspace?.permissions || []);
  const isAdmin = permissions.has(P.ACCESS_ADMIN);
  const canRespond = permissions.has(P.TRIP_RESPOND);
  const canEditRequest = permissions.has(P.TRIP_EDIT_REQUEST);

  const currentLifecycle = tripLifecycle[trip.status] || {};
  const allActions = [...universalActions, ...(currentLifecycle.actions || [])];

  const isAllowed = (action) => {
    if (hideView && action.label === "View") return false;

    switch (action.label) {
      case "View":
        return permissions.has(P.TRIP_READ);
      case "Edit":
        // Backend ownership/status policy remains authoritative. The client only
        // uses the workspace permission to avoid presenting impossible actions.
        return isAdmin || canEditRequest;
      case "Accept":
      case "Reject":
      case "Complete":
      case "Approve Cancel":
      case "Decline Request":
        return isAdmin || canRespond;
      case "Assign Bus":
        return isAdmin || permissions.has(P.BUS_ASSIGNMENT_MANAGE);
      case "Cancel":
        return isAdmin || (canEditRequest && trip.status === "Pending");
      case "Request Cancel":
        return isAdmin || (canEditRequest && ["Accepted", "Confirmed"].includes(trip.status));
      case "Delete":
        return permissions.has(P.TRIP_DELETE);
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
        if (action.nextStatus && ["Reject", "Cancel", "Complete", "Approve Cancel", "Decline Request", "Request Cancel"].includes(action.label)) {
          return onConfirmAction?.(trip, action.label, action.nextStatus);
        }
        if (action.nextStatus) return onStatusChange?.(trip, action.nextStatus);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allActions.filter(isAllowed).map((action, idx) => (
        <button
          key={`${action.label}-${idx}`}
          type="button"
          onClick={() => handleClick(action)}
          className={`flex items-center px-2 py-1 border rounded text-sm font-semibold transition-colors duration-200 ${action.color || "text-gray-700 hover:text-gray-900"}`}
        >
          {action.icon && <action.icon className="mr-1" />}
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ActionsCell;
