import { useState } from "react";
import { updateTrip } from "../services/tripService";

export const useTripActions = (refreshCallback) => {
  const [showDetailsTrip, setShowDetailsTrip] = useState(null);
  const [confirmRejectTrip, setConfirmRejectTrip] = useState(null);

  const handleStatusChange = async (trip, newStatus) => {
    await updateTrip(trip.id, { status: newStatus });
    refreshCallback?.();
    setConfirmRejectTrip(null);
  };

  const handleViewTrip = (trip) => {
    setShowDetailsTrip(trip);
  };

  const handleCancel = async (trip) => {
    await updateTrip(trip.id, { status: "Canceled" });
    refreshCallback?.();
  };

  return {
    showDetailsTrip,
    setShowDetailsTrip,
    confirmRejectTrip,
    setConfirmRejectTrip,
    handleStatusChange,
    handleViewTrip,
    handleCancel,
  };
};
