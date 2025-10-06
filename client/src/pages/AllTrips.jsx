// src/pages/AllTrips.jsx

import React, { useCallback, useEffect, useState } from "react";
import { getAllTrips, getTripsByUser } from "../services/tripService";
import TripsLayout from "../layout/TripsLayout";
import SmartTripTable from "../components/SmartTripTable";
import TripCalendar from "../components/TripCalendar";
import { useAuth } from "../context/AuthContext";
import RequestTripButton from "../components/RequestTripButton"; // NEW

const AllTrips = () => {
  const [trips, setTrips] = useState([]);
  const { profile } = useAuth();

  const fetchTrips = useCallback(async () => {
    try {
      if (!profile) return;

      let tripsList = [];

      // Same roles as before have global visibility
      if (
        profile.role === "admin" ||
        profile.role === "school_staff" ||
        profile.role === "bus_company" ||
        profile.role === "finance"
      ) {
        tripsList = await getAllTrips();
      } else {
        // Fallback: scoped to the user
        tripsList = await getTripsByUser(profile?.name);
      }

      setTrips(tripsList);
    } catch (error) {
      console.error("Failed to fetch trips:", error);
    }
  }, [profile]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return (
    <>
      <TripsLayout
        title="All Trips"
        trips={trips}
        tableComponent={SmartTripTable}
        calendarComponent={TripCalendar}
      />

      {/* Show the same FAB for school staff on this page too */}
      {profile?.role === "school_staff" && (
        <RequestTripButton onSuccess={fetchTrips} />
      )}
    </>
  );
};

export default AllTrips;
