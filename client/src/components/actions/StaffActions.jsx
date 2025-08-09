import React, { useState } from "react";
import EditTripForm from "../EditTripForm";
import ConfirmActionPopup from "../ConfirmActionPopup";
import { updateTrip } from "../../services/tripService";

const StaffActions = ({ trip, refreshCallback }) => {
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const handleCancelTrip = async () => {
    try {
      await updateTrip(trip.id, { status: "Canceled" });
      refreshCallback?.();
    } catch (error) {
      console.error("Failed to cancel trip:", error);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowEditRequest(true)}
          className="text-blue-600 underline hover:text-blue-800 transition-colors px-1"
        >
          {trip.status === "Confirmed" ? "Edit Request" : "Edit"}
        </button>

        {(trip.status === "Pending" || trip.status === "Accepted" || trip.status === "Confirmed") && (
          <button
            onClick={() => setShowConfirmCancel(true)}
            className="text-red-600 underline hover:text-red-800 transition-colors px-1"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Confirm Cancel */}
      {showConfirmCancel && (
        <ConfirmActionPopup
          title="Cancel Trip"
          description="Are you sure you want to cancel this trip? This action cannot be undone."
          onConfirm={() => {
            handleCancelTrip();
            setShowConfirmCancel(false);
          }}
          onClose={() => setShowConfirmCancel(false)}
        />
      )}

      {/* Edit Trip Form */}
      {showEditRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <EditTripForm
            trip={trip}
            onClose={() => setShowEditRequest(false)}
            onUpdated={() => {
              setShowEditRequest(false);
              refreshCallback?.();
            }}
            isRequestMode={trip.status === "Confirmed"}
          />
        </div>
      )}
    </>
  );
};

export default StaffActions;
