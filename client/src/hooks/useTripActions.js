import { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  deleteWorkspaceTrip, acceptWorkspaceTrip, rejectWorkspaceTrip, completeWorkspaceTrip,
  requestWorkspaceTripCancellation, resolveWorkspaceTripCancellation, cancelWorkspaceTrip,
} from "../services/tripService";

const useTripActions = (workspace, setTripData, setExpandedTripId) => {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const { selectedWorkspace } = useWorkspace();
  const resolvedWorkspace = workspace?.schoolId ? workspace : selectedWorkspace;
  const schoolId = resolvedWorkspace?.schoolId;

  const requireWorkspace = () => {
    if (!schoolId) throw new Error("No active school workspace is available for this trip action.");
    return schoolId;
  };

  const applyUpdatedTrip = (trip, updated) => {
    setTripData?.((prev) => prev.map((t) => (t.id === trip.id ? { ...t, ...updated } : t)));
    window.dispatchEvent(new CustomEvent("trip:updated", { detail: updated }));
    setExpandedTripId?.(null);
  };

  const applyAction = async (trip, action) => {
    try {
      setLoading(true); setActionError("");
      const workspaceSchoolId = requireWorkspace();
      let updated;
      if (action === "Accepted" && trip.status === "Pending") updated = await acceptWorkspaceTrip(workspaceSchoolId, trip.id);
      else if (action === "Rejected" && trip.status === "Pending") updated = await rejectWorkspaceTrip(workspaceSchoolId, trip.id);
      else if (action === "Completed") updated = await completeWorkspaceTrip(workspaceSchoolId, trip.id);
      else if (action === "requestCancellation") updated = await requestWorkspaceTripCancellation(workspaceSchoolId, trip.id);
      else if (action === "approveCancellation" && trip.cancelRequest) updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, true);
      else if (action === "declineCancellation" && trip.cancelRequest) updated = await resolveWorkspaceTripCancellation(workspaceSchoolId, trip.id, false);
      else if (action === "Canceled" && trip.status === "Pending") updated = await cancelWorkspaceTrip(workspaceSchoolId, trip.id);
      else throw new Error(`Unsupported trip workflow action: ${trip.status} → ${action}`);
      applyUpdatedTrip(trip, updated);
      return updated;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Unable to process this trip action.";
      setActionError(message); console.error("Failed to execute trip workflow action:", error); throw error;
    } finally { setLoading(false); }
  };

  const handleStatusChange = (trip, nextStatus) => applyAction(trip, nextStatus);
  const handleWorkflowAction = (trip, workflowAction) => applyAction(trip, workflowAction);
  const handleSoftDelete = async (trip) => {
    try { setLoading(true); setActionError(""); await deleteWorkspaceTrip(requireWorkspace(), trip.id); setTripData?.((prev) => prev.filter((t) => t.id !== trip.id)); setExpandedTripId?.(null); }
    catch (error) { const message=error?.response?.data?.message||error?.message||"Unable to delete this trip.";setActionError(message);throw error; }
    finally { setLoading(false); }
  };
  return { loading, actionError, clearActionError:()=>setActionError(""), handleStatusChange, handleWorkflowAction, handleSoftDelete };
};
export default useTripActions;
