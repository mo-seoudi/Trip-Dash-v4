import React, { useEffect, useState } from "react";
import { getAllTrips } from "../services/tripService";
import SmartTripTable from "./SmartTripTable";
import TripDetailsPopup from "./TripDetailsPopup";
import dayjs from "dayjs";
import TripFilters from "./TripFilters";
import { useFilteredTrips } from "../hooks/useFilteredTrips";
import EditBusForm from "./EditBusForm";

const BusTripList = () => {
  const [trips, setTrips] = useState([]);
  const [showDetailsTrip, setShowDetailsTrip] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [showEditInfoTrip, setShowEditInfoTrip] = useState(null);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const data = await getAllTrips();
        setTrips(data);
      } catch (error) {
        console.error("Failed to fetch trips:", error);
      }
    };

    loadTrips();
  }, [refreshTrigger]);

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
  } = useFilteredTrips(trips, { role: "bus_company" });

  const uniqueMonths = Array.from(
    new Set(trips.map((trip) => dayjs(trip.date).format("MMMM YYYY")))
  ).sort((a, b) => dayjs(b, "MMMM YYYY") - dayjs(a, "MMMM YYYY"));

  const statusOptions = ["Pending", "Accepted", "Confirmed", "Completed", "Canceled", "Rejected"];

  return (
    <div className="bg-white shadow rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-2 justify-between items-center p-4 border-b">
        <h2 className="text-xl font-bold">Trip Requests</h2>
        <TripFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusOptions={statusOptions}
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          monthOptions={uniqueMonths}
          onReset={resetFilters}
          filteredData={filteredTrips}
        />
      </div>

      <SmartTripTable
        data={filteredTrips.map((trip) => ({
          ...trip,
          onEditInfo: () => {
            setShowEditInfoTrip(trip);
          },
        }))}
        setShowDetailsTrip={setShowDetailsTrip}
        dateSortOrder={dateSortOrder}
        setDateSortOrder={setDateSortOrder}
        refreshCallback={() => setRefreshTrigger((prev) => !prev)}
      />

      {showDetailsTrip && (
        <TripDetailsPopup trip={showDetailsTrip} onClose={() => setShowDetailsTrip(null)} />
      )}

      {showEditInfoTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <EditBusForm
            trip={showEditInfoTrip}
            onSuccess={() => {
              setShowEditInfoTrip(null);
              setRefreshTrigger((prev) => !prev);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BusTripList;
