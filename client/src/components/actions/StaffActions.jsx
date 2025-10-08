// client/src/components/actions/StaffActions.jsx

import React, { useState } from "react";
import EditTripForm from "../EditTripForm";
import ConfirmActionPopup from "../ConfirmActionPopup";
import { updateTrip } from "../../services/tripService";
import PassengersPanel from "../trips/PassengersPanel"; // NEW

const StaffActions = ({ trip, refreshCallback }) => {
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showPassengers, setShowPassengers] = useState(false); // NEW

  const handleCancelTrip = async () => {
    try {
      await updateTrip(trip.id, { status: "Canceled" }); // keep your existing spelling
      refreshCallback?.();
    } catch (error) {
      console.error("Failed to cancel trip:", error);
    }
  };

  const canShowPassengers =
    trip?.status === "Accepted" ||
    trip?.status === "Confirmed" ||
    trip?.status === "Completed";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowEditRequest(true)}
          className="text-blue-600 underline hover:text-blue-800 transition-colors px-1"
        >
          {trip.status === "Confirmed" ? "Edit Request" : "Edit"}
        </button>

        {(trip.status === "Pending" ||
          trip.status === "Accepted" ||
          trip.status === "Confirmed") && (
          <button
            onClick={() => setShowConfirmCancel(true)}
            className="text-red-600 underline hover:text-red-800 transition-colors px-1"
          >
            Cancel
          </button>
        )}

        {canShowPassengers && (
          <button
            onClick={() => setShowPassengers(true)}
            className="text-indigo-600 underline hover:text-indigo-800 transition-colors px-1"
          >
            Passengers
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

      {/* Passengers Panel (staff has full access → readOnly=false) */}
      {showPassengers && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full">
            <PassengersPanel
              trip={trip}
              onClose={() => setShowPassengers(false)}
              readOnly={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default StaffActions;
