// src/hooks/useTripActions.js
import { useState } from "react";
import { updateTrip, assignBusesToTrip } from "../services/tripService";
import { tripPermissions } from "../config/trips/tripPermissions";

const useTripActions = (user, setTripData, setExpandedTripId) => {
  const [loading, setLoading] = useState(false);

  const role = user?.role;
  const perms = tripPermissions[role] || {};

  const handleStatusChange = async (trip, nextStatus) => {
    if (!role || !perms) return;

    try {
      setLoading(true);
      await updateTrip(trip.id, { status: nextStatus });

      // Update UI immediately
      if (setTripData) {
        setTripData((prev) =>
          prev.map((t) => (t.id === trip.id ? { ...t, status: nextStatus } : t))
        );
      }
      if (setExpandedTripId) {
        setExpandedTripId(null);
      }
    } catch (error) {
      console.error("Failed to update trip status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDelete = async (trip) => {
    try {
      setLoading(true);
      await updateTrip(trip.id, { deleted: true });
      if (setTripData) {
        setTripData((prev) => prev.filter((t) => t.id !== trip.id));
      }
    } catch (error) {
      console.error("Failed to soft delete trip:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAndConfirm = async (trip, busDetails) => {
    try {
      setLoading(true);
      await assignBusesToTrip(trip.id, busDetails);
      await updateTrip(trip.id, { status: "Confirmed" });
      if (setTripData) {
        setTripData((prev) =>
          prev.map((t) => (t.id === trip.id ? { ...t, status: "Confirmed" } : t))
        );
      }
      if (setExpandedTripId) {
        setExpandedTripId(null);
      }
    } catch (error) {
      console.error("Failed to assign and confirm trip:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    handleStatusChange,
    handleSoftDelete,
    handleAssignAndConfirm,
  };
};

export default useTripActions;
