import React, { useState } from "react";
import ConfirmActionPopup from "../ConfirmActionPopup";
import { updateTrip } from "../../services/tripService";
import AssignBusForm from "../AssignBusForm";
import EditBusForm from "../EditBusForm";

const BusCompanyActions = ({ trip, refreshCallback }) => {
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [loadingAcceptId, setLoadingAcceptId] = useState(null);

  const handleUpdateStatus = async (status) => {
    try {
      if (status === "Accepted") {
        setLoadingAcceptId(trip.id);
      }
      await updateTrip(trip.id, { status });
      refreshCallback?.();
    } catch (error) {
      console.error(`Failed to update status to ${status}:`, error);
    } finally {
      if (status === "Accepted") {
        setLoadingAcceptId(null);
      }
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {trip.status === "Pending" && (
          <>
            <button
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
              onClick={() => setShowConfirmReject(true)}
              className="text-red-600 underline hover:text-red-800 transition-colors px-1"
            >
              Reject
            </button>
          </>
        )}

        {trip.status === "Accepted" && (
          <button
            onClick={() => setShowAssign(true)}
            className="text-blue-600 underline hover:text-blue-800 transition-colors px-1"
          >
            Assign
          </button>
        )}

        {trip.status === "Confirmed" && (
          <>
            <button
              onClick={() => setShowConfirmComplete(true)}
              className="text-green-600 underline hover:text-green-800 transition-colors px-1"
            >
              Complete
            </button>
            <button
              onClick={() => setShowEditInfo(true)}
              className="text-yellow-600 underline hover:text-yellow-800 transition-colors px-1"
            >
              Edit Info
            </button>
          </>
        )}

        {(trip.status === "Accepted" || trip.status === "Confirmed") && (
          <button
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
    </>
  );
};

// 👇 Inline small spinner for button
function LoadingSpinnerInline() {
  return (
    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-solid" />
  );
}

export default BusCompanyActions;
