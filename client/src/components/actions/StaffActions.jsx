import React, { useState } from "react";
import EditTripForm from "../EditTripForm";
import ConfirmActionPopup from "../ConfirmActionPopup";
import { updateTrip, requestTripCancel } from "../../services/tripService"; // 🔹 use helper
import PassengersPanel from "../trips/PassengersPanel";

const StaffActions = ({ trip, refreshCallback }) => {
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showPassengers, setShowPassengers] = useState(false);

  const isPending = trip.status === "Pending";
  const isCancelableByRequest = trip.status === "Accepted" || trip.status === "Confirmed";

  const handleDirectCancel = async () => {
    try {
      await updateTrip(trip.id, { status: "Canceled" });
      refreshCallback?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestCancel = async () => {
    try {
      await requestTripCancel(trip.id);
      refreshCallback?.();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Edit (direct for Pending; request for Confirmed) */}
        <button
          onClick={() => setShowEditRequest(true)}
          className="text-blue-600 hover:text-blue-800 underline px-1"
        >
          {trip.status === "Confirmed" ? "Edit Request" : "Edit"}
        </button>

        {isPending && (
          <button
            onClick={() => setShowConfirmCancel(true)}
            className="text-red-600 hover:text-red-800 underline px-1"
          >
            Cancel
          </button>
        )}

        {isCancelableByRequest && (
          <button
            onClick={() => setShowConfirmCancel(true)}
            className="text-red-600 hover:text-red-800 underline px-1"
          >
            Request Cancel
          </button>
        )}
      </div>

      {showConfirmCancel && (
        <ConfirmActionPopup
          title={isPending ? "Cancel Trip" : "Request Cancel"}
          description={
            isPending
              ? "Are you sure you want to cancel this trip?"
              : "Send a cancellation request to the bus company?"
          }
          onConfirm={async () => {
            if (isPending) await handleDirectCancel();
            else await handleRequestCancel();
            setShowConfirmCancel(false);
          }}
          onClose={() => setShowConfirmCancel(false)}
        />
      )}

      {showEditRequest && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <EditTripForm
            trip={trip}
            onClose={() => setShowEditRequest(false)}
            onUpdated={() => {
              setShowEditRequest(false);
              refreshCallback?.();
            }}
            isRequestMode={trip.status === "Confirmed"} // request flow for Confirmed
          />
        </div>
      )}

      {/* (Passengers logic unchanged) */}
      {showPassengers && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full">
            <PassengersPanel trip={trip} onClose={() => setShowPassengers(false)} readOnly={false} />
          </div>
        </div>
      )}
    </>
  );
};

export default StaffActions;
