import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import SmartTripTable from "./SmartTripTable";
import TripDetailsPopup from "./TripDetailsPopup";
import TripFilters from "./TripFilters";
import { getTripsByUser } from "../services/tripService";
import { format } from "date-fns";
import { useFilteredTrips } from "../hooks/useFilteredTrips";

const StaffTripList = ({ setIsEditing, refreshTrigger }) => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState([]);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showDetailsTrip, setShowDetailsTrip] = useState(null);

  useEffect(() => {
    const fetchTrips = async () => {
      if (!profile?.name) return;
      try {
        const tripsList = await getTripsByUser(profile.name);
        setTrips(tripsList);
      } catch (error) {
        console.error("Failed to fetch trips:", error);
      }
    };

    fetchTrips();
  }, [refreshTrigger, forceRefresh, profile]);

  const {
    filteredTrips,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    monthFilter,
    setMonthFilter,
    dateSortOrder,
    setDateSortOrder,
    resetFilters,
  } = useFilteredTrips(trips, { role: "school_staff" });

  const availableMonths = Array.from(
    new Set(trips.map((trip) => format(new Date(trip.date), "MMMM yyyy")))
  ).sort((a, b) => new Date(b) - new Date(a));

  const statuses = ["Pending", "Accepted", "Confirmed", "Completed", "Canceled", "Rejected"];

  return (
    <div className="bg-white shadow rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-2 justify-between items-center p-4 border-b">
        <h2 className="text-xl font-bold flex-1">Trip Requests</h2>
        <TripFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusOptions={statuses}
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          monthOptions={availableMonths}
          onReset={resetFilters}
          filteredData={filteredTrips}
        />
      </div>

      <SmartTripTable
        data={filteredTrips}
        setShowDetailsTrip={setShowDetailsTrip}
        dateSortOrder={dateSortOrder}
        setDateSortOrder={setDateSortOrder}
        refreshCallback={() => setForceRefresh((prev) => !prev)}
      />

      {showDetailsTrip && (
        <TripDetailsPopup
          trip={showDetailsTrip}
          onClose={() => setShowDetailsTrip(null)}
        />
      )}
    </div>
  );
};

export default StaffTripList;
