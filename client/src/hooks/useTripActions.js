import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  updateWorkspaceTrip,
  deleteWorkspaceTrip,
  completeWorkspaceTrip,
  requestWorkspaceTripCancellation,
  resolveWorkspaceTripCancellation,
  cancelWorkspaceTrip,
} from "../services/tripService";

const useTripActions = (workspace, setTripData, setExpandedTripId) => {
  const [loading, setLoading] = useState(false);
  const { activeWorkspace } = useAuth();

  // Transitional callers may still pass something other than a workspace.
  // Canonical trip writes must always resolve to an authorized workspace and
  // never fall back to the legacy global /api/trips endpoint.
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

      // Lifecycle transitions with business meaning are server-owned actions.
      // Generic PATCH remains temporarily for the earlier Accept/Reject stages
      // until those stages are migrated to explicit workflow endpoints too.
      if (nextStatus === "Completed") {
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
        updated = await updateWorkspaceTrip(workspaceSchoolId, trip.id, { status: nextStatus });
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
