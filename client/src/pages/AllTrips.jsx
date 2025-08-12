// src/pages/AllTrips.jsx

import React, { useEffect, useState } from "react";
import { getAllTrips, getTripsByUser } from "../services/tripService";
import TripsLayout from "../layout/TripsLayout";
import SmartTripTable from "../components/SmartTripTable";
import TripCalendar from "../components/TripCalendar";
import { useAuth } from "../context/AuthContext";

const AllTrips = () => {
  const [trips, setTrips] = useState([]);
  const { profile } = useAuth();

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        let tripsList = [];

        if (
          profile.role === "admin" ||
          profile.role === "school_staff" ||
          profile.role === "bus_company" ||
          profile.role === "finance"
        ) {
          tripsList = await getAllTrips();
        } else if (profile.role === "school_staff") {
          tripsList = await getTripsByUser(profile.name);
        }

        setTrips(tripsList);
      } catch (error) {
        console.error("Failed to fetch trips:", error);
      }
    };

    if (profile) {
      fetchTrips();
    }
  }, [profile]);

  return (
    <TripsLayout
      title="All Trips"
      trips={trips}
      tableComponent={SmartTripTable}
      calendarComponent={TripCalendar}
    />
  );
};

export default AllTrips;
