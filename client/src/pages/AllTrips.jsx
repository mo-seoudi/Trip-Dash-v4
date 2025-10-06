// src/pages/AllTrips.jsx

import React, { useCallback, useEffect, useState } from "react";
import { getAllTrips, getTripsByUser } from "../services/tripService";
import TripsLayout from "../layout/TripsLayout";
import SmartTripTable from "../components/SmartTripTable";
import TripCalendar from "../components/TripCalendar";
import TripDetails from "../components/TripDetails";      // ✅ reuse existing component
import ModalWrapper from "../components/ModalWrapper";    // ✅ existing modal wrapper
import { useAuth } from "../context/AuthContext";
import RequestTripButton from "../components/RequestTripButton";

// ✅ NEW: wrapper that adds click→TripDetails to calendar
const CalendarWithDetails = (props) => {
  const [selectedTrip, setSelectedTrip] = useState(null);

  return (
    <>
      <TripCalendar
        {...props}
        // When a calendar event is clicked, TripCalendar should send the trip data here
        onEventClick={(trip) => setSelectedTrip(trip)}
      />

      {selectedTrip && (
        <ModalWrapper onClose={() => setSelectedTrip(null)}>
          <TripDetails trip={selectedTrip} />
        </ModalWrapper>
      )}
    </>
  );
};

const AllTrips = () => {
  const [trips, setTrips] = useState([]);
  const { profile } = useAuth();

  const fetchTrips = useCallback(async () => {
    try {
      if (!profile) return;

      let tripsList = [];

      if (
        profile.role === "admin" ||
        profile.role === "school_staff" ||
        profile.role === "bus_company" ||
        profile.role === "finance"
      ) {
        tripsList = await getAllTrips();
      } else {
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
        calendarComponent={CalendarWithDetails}  // ✅ just wrap calendar to add click→details
      />

      {profile?.role === "school_staff" && (
        <RequestTripButton onSuccess={fetchTrips} />
      )}
    </>
  );
};

export default AllTrips;
