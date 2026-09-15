import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateWorkspaceTrip, deleteWorkspaceTrip } from "../services/tripService";

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
      const updated = await updateWorkspaceTrip(workspaceSchoolId, trip.id, { status: nextStatus });
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
