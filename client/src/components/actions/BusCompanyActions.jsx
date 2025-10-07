import React, { useState } from "react";
import ConfirmActionPopup from "../ConfirmActionPopup";
import { updateTrip } from "../../services/tripService";
import AssignBusForm from "../AssignBusForm";
import EditBusForm from "../EditBusForm";
import EditTripForm from "../EditTripForm"; // to view/adjust edit draft before applying

const BusCompanyActions = ({ trip, refreshCallback }) => {
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [loadingAcceptId, setLoadingAcceptId] = useState(null);

  // For handling "View Draft" of edit requests (pre-fill form with draft)
  const [showEditDraft, setShowEditDraft] = useState(false);

  const safeRefresh = () => {
    try {
      refreshCallback?.();
      // also broadcast to any listeners (SmartTripTable / Calendar)
      window.dispatchEvent(new CustomEvent("trip:updated", { detail: trip }));
    } catch {}
  };

  const handleUpdateStatus = async (status, extraPatch = null) => {
    try {
      if (status === "Accepted") setLoadingAcceptId(trip.id);
      const patch = extraPatch ? { status, ...extraPatch } : { status };
      await updateTrip(trip.id, patch);
      safeRefresh();
    } catch (error) {
      console.error(`Failed to update status to ${status}:`, error);
    } finally {
      if (status === "Accepted") setLoadingAcceptId(null);
    }
  };

  const clearCancelRequest = async () => {
    try {
      await updateTrip(trip.id, { cancelRequested: false, cancelReason: null });
      safeRefresh();
    } catch (e) {
      console.error("Failed clearing cancel request:", e);
    }
  };

  const approveCancelRequest = async () => {
    await handleUpdateStatus("Canceled", { cancelRequested: false, cancelReason: null });
  };

  const applyEditDraft = async () => {
    const draft = trip?.editDraft || {};
    try {
      await updateTrip(trip.id, { ...draft, editRequested: false, editDraft: null });
      safeRefresh();
    } catch (e) {
      console.error("Failed applying edit draft:", e);
    }
  };

  const declineEditRequest = async () => {
    try {
      await updateTrip(trip.id, { editRequested: false, editDraft: null });
      safeRefresh();
    } catch (e) {
      console.error("Failed declining edit request:", e);
    }
  };

  // Trip flags
  const hasCancelRequest = !!trip?.cancelRequested;
  const hasEditRequest = !!trip?.editRequested;

  // Draft to show (when opening EditTripForm from a request)
  const draftTrip = hasEditRequest
    ? { ...trip, ...(trip.editDraft || {}) }
    : trip;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* ---- Request banners converted to actions ---- */}
        {hasCancelRequest && (
          <>
            <button
              type="button"
              onClick={approveCancelRequest}
              className="text-red-600 underline hover:text-red-800 transition-colors px-1"
              title="Approve the cancel request"
            >
              Approve Cancel
            </button>
            <button
              type="button"
              onClick={clearCancelRequest}
              className="text-gray-600 underline hover:text-gray-800 transition-colors px-1"
              title="Decline the cancel request"
            >
              Decline
            </button>
          </>
        )}

        {hasEditRequest && (
          <>
            <button
              type="button"
              onClick={() => setShowEditDraft(true)}
              className="text-blue-600 underline hover:text-blue-800 transition-colors px-1"
              title="Open the draft in edit form"
            >
              View Draft
            </button>
            <button
              type="button"
              onClick={applyEditDraft}
              className="text-green-600 underline hover:text-green-800 transition-colors px-1"
              title="Apply the requested edits"
            >
              Apply Edit
            </button>
            <button
              type="button"
              onClick={declineEditRequest}
              className="text-gray-600 underline hover:text-gray-800 transition-colors px-1"
              title="Decline the requested edits"
            >
              Decline
            </button>
          </>
        )}

        {/* ---- Normal lifecycle actions (your original) ---- */}
        {trip.status === "Pending" && !hasCancelRequest && !hasEditRequest && (
          <>
            <button
              type="button"
              onClick={() => handleUpdateStatus("Accepted")}
              className="text-green-600 underline hover:text-green-800 transition-colors px-1 flex items-center gap-1"
              disabled={loadingAcceptId === trip.id}
            >
              {loadingAcceptId === trip.id ? (
                <>
                  Accepting
                  <div className="w-4 h-4">
                    <LoadingSpinnerInline />
                  </div>
                </>
              ) : (
                "Accept"
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmReject(true)}
              className="text-red-600 underline hover:text-red-800 transition-colors px-1"
            >
              Reject
            </button>
          </>
        )}

        {trip.status === "Accepted" && !hasCancelRequest && (
          <button
            type="button"
            onClick={() => setShowAssign(true)}
            className="text-blue-600 underline hover:text-blue-800 transition-colors px-1"
          >
            Assign
          </button>
        )}

        {trip.status === "Confirmed" && !hasCancelRequest && (
          <>
            <button
              type="button"
              onClick={() => setShowConfirmComplete(true)}
              className="text-green-600 underline hover:text-green-800 transition-colors px-1"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() => setShowEditInfo(true)}
              className="text-yellow-600 underline hover:text-yellow-800 transition-colors px-1"
            >
              Edit Info
            </button>
          </>
        )}

        {(trip.status === "Accepted" || trip.status === "Confirmed") && !hasCancelRequest && (
          <button
            type="button"
            onClick={() => setShowConfirmCancel(true)}
            className="text-red-600 underline hover:text-red-800 transition-colors px-1"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Confirm Reject */}
      {showConfirmReject && (
        <ConfirmActionPopup
          title="Reject Trip"
          description="Are you sure you want to reject this trip? This action cannot be undone."
          onConfirm={() => {
            handleUpdateStatus("Rejected");
            setShowConfirmReject(false);
          }}
          onClose={() => setShowConfirmReject(false)}
        />
      )}

      {/* Confirm Cancel */}
      {showConfirmCancel && (
        <ConfirmActionPopup
          title="Cancel Trip"
          description="Are you sure you want to cancel this trip? This action cannot be undone."
          onConfirm={() => {
            handleUpdateStatus("Canceled");
            setShowConfirmCancel(false);
          }}
          onClose={() => setShowConfirmCancel(false)}
        />
      )}

      {/* Confirm Complete */}
      {showConfirmComplete && (
        <ConfirmActionPopup
          title="Complete Trip"
          description="Are you sure you want to mark this trip as completed? You won't be able to edit it afterward."
          onConfirm={() => {
            handleUpdateStatus("Completed");
            setShowConfirmComplete(false);
          }}
          onClose={() => setShowConfirmComplete(false)}
        />
      )}

      {/* Assign Bus Form */}
      {showAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <AssignBusForm
            trip={trip}
            onClose={() => {
              setShowAssign(false);
              refreshCallback?.();
            }}
            onSubmit={() => {
              setShowAssign(false);
              refreshCallback?.();
            }}
          />
        </div>
      )}

      {/* Edit Info Form */}
      {showEditInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <EditBusForm
            trip={trip}
            onSuccess={() => {
              setShowEditInfo(false);
              refreshCallback?.();
            }}
          />
        </div>
      )}

      {/* View Draft (bus-company can adjust then save; clears request flags on success) */}
      {showEditDraft && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <EditTripForm
            trip={draftTrip}
            onClose={() => setShowEditDraft(false)}
            onUpdated={async (payload) => {
              // If the edit form saved, also clear the request flags
              try {
                await updateTrip(trip.id, { editRequested: false, editDraft: null, ...(payload || {}) });
              } catch (e) {
                console.error(e);
              } finally {
                setShowEditDraft(false);
                refreshCallback?.();
              }
            }}
            isRequestMode={false} // bus company applies directly
          />
        </div>
      )}
    </>
  );
};

// Inline small spinner for button
function LoadingSpinnerInline() {
  return (
    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-solid" />
  );
}

export default BusCompanyActions;
