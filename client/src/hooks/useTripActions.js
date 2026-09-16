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

  const handleStatusChange = async (trip, nextStatus) => {
    try {
      setLoading(true);
      const workspaceSchoolId = requireWorkspace();
      let updated;

      // Canonical lifecycle transitions are explicit server-owned actions.
      if (nextStatus === "Accepted" && trip.status === "Pending") {
        updated = await acceptWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (nextStatus === "Rejected" && trip.status === "Pending") {
        updated = await rejectWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (nextStatus === "Completed") {
        updated = await completeWorkspaceTrip(workspaceSchoolId, trip.id);
      } else if (nextStatus === "Cancel Requested") {
        updated = await requestWorkspaceTripCancellation(workspaceSchoolId, trip.id);
      } else if (trip.cancelRequest && nextStatus === "Canceled") {
        updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, true);
      } else if (trip.cancelRequest && nextStatus === "Confirmed") {
        updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, false);
      } else if (nextStatus === "Canceled" && trip.status === "Pending") {
        updated = await cancelWorkspaceTrip(workspaceSchoolId, trip.id);
      } else {
        throw new Error(`Unsupported trip lifecycle transition: ${trip.status} → ${nextStatus}`);
      }

      setTripData?.((prev) => prev.map((t) => (t.id === trip.id ? { ...t, ...updated } : t)));
      setExpandedTripId?.(null);
      return updated;
    } catch (error) {
      console.error("Failed to update trip status:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

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

  return { loading, handleStatusChange, handleSoftDelete };
};

export default useTripActions;
