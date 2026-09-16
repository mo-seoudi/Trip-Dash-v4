import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  deleteWorkspaceTrip,
  acceptWorkspaceTrip,
  rejectWorkspaceTrip,
  completeWorkspaceTrip,
  requestWorkspaceTripCancellation,
  resolveWorkspaceTripCancellation,
  cancelWorkspaceTrip,
} from "../services/tripService";

const useTripActions = (workspace, setTripData, setExpandedTripId) => {
  const [loading, setLoading] = useState(false);
  const { activeWorkspace } = useAuth();

  const resolvedWorkspace = workspace?.schoolId ? workspace : activeWorkspace;
  const schoolId = resolvedWorkspace?.schoolId;

  const requireWorkspace = () => {
    if (!schoolId) throw new Error("No active workspace is available for this trip action.");
    return schoolId;
  };

  const applyAction = async (trip, action) => {
    try {
      setLoading(true);
      const workspaceSchoolId = requireWorkspace();
      let updated;

      // Canonical lifecycle transitions are explicit server-owned actions. Cancellation
      // decisions are modeled as workflow actions because a declined request preserves
      // the trip's existing status rather than transitioning it to "Confirmed".
      if (action === "Accepted" && trip.status === "Pending") {
        updated = await acceptWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (action === "Rejected" && trip.status === "Pending") {
        updated = await rejectWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (action === "Completed") {
        updated = await completeWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (action === "requestCancellation") {
        updated = await requestWorkspaceTripCancellation(workspaceSchoolId, trip.id);
      } else if (action === "approveCancellation" && trip.cancelRequest) {
        updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, true);
      } else if (action === "declineCancellation" && trip.cancelRequest) {
        updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, false);
      } else if (action === "Canceled" && trip.status === "Pending") {
        updated = await cancelWorkspaceTrip(workspaceSchoolId, trip.id);
      } else {
        throw new Error(`Unsupported trip workflow action: ${trip.status} → ${action}`);
      }

      setTripData?.((prev) => prev.map((t) => (t.id === trip.id ? { ...t, ...updated } : t)));
      setExpandedTripId?.(null);
      return updated;
    } catch (error) {
      console.error("Failed to execute trip workflow action:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (trip, nextStatus) => applyAction(trip, nextStatus);
  const handleWorkflowAction = (trip, workflowAction) => applyAction(trip, workflowAction);

  const handleSoftDelete = async (trip) => {
    try {
      setLoading(true);
      const workspaceSchoolId = requireWorkspace();
      await deleteWorkspaceTrip(workspaceSchoolId, trip.id);
      setTripData?.((prev) => prev.filter((t) => t.id !== trip.id));
      setExpandedTripId?.(null);
    } catch (error) {
      console.error("Failed to delete trip:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { loading, handleStatusChange, handleWorkflowAction, handleSoftDelete };
};

export default useTripActions;
