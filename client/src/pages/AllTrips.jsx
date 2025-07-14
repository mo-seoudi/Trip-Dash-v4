import React, { useEffect, useState } from "react";
import SmartTripTable from "../components/SmartTripTable";
import TripDetailsPopup from "../components/TripDetailsPopup";
import dayjs from "dayjs";
import TripFilters from "../components/TripFilters";
import { getAllTrips } from "../services/tripService"; // ✅ Use service

const AllTrips = () => {
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dateSortOrder, setDateSortOrder] = useState("");
  const [showDetailsTrip, setShowDetailsTrip] = useState(null);

  useEffect(() => {
    const fetchAllTrips = async () => {
      try {
        const tripsList = await getAllTrips(); // ✅ Correctly calls service
        setTrips(tripsList);
      } catch (error) {
        console.error("Failed to fetch trips:", error);
      }
    };

    fetchAllTrips();
  }, []);

  useEffect(() => {
    let data = [...trips];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (trip) =>
          trip.destination.toLowerCase().includes(q) ||
          trip.notes?.toLowerCase().includes(q) ||
          trip.tripType?.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      data = data.filter((trip) => trip.status === statusFilter);
    }

    if (monthFilter) {
      data = data.filter((trip) => {
        const tripMonth = dayjs(trip.date).format("MMMM YYYY");
        return tripMonth === monthFilter;
      });
    }

    if (dateSortOrder === "asc") {
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (dateSortOrder === "desc") {
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    setFilteredTrips(data);
  }, [trips, search, statusFilter, monthFilter, dateSortOrder]);

  const uniqueMonths = Array.from(
    new Set((trips || []).map((trip) => dayjs(trip.date).format("MMMM YYYY")))
  ).sort((a, b) => dayjs(b, "MMMM YYYY") - dayjs(a, "MMMM YYYY"));

  const statusOptions = ["Pending", "Accepted", "Confirmed", "Completed", "Canceled", "Rejected"];

  const handleReset = () => {
    setSearch("");
    setStatusFilter("");
    setMonthFilter("");
    setDateSortOrder("");
  };

  return (
    <div className="bg-white shadow rounded-xl overflow-hidden">
      <div className="flex flex-wrap gap-2 justify-between items-center p-4 border-b">
        <h2 className="text-xl font-bold">All Trips</h2>
        <TripFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          statusOptions={statusOptions}
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          monthOptions={uniqueMonths}
          onReset={handleReset}
          filteredData={filteredTrips}
        />
      </div>

      <SmartTripTable
        data={filteredTrips.map((trip) => ({
          ...trip,
        }))}
        setShowDetailsTrip={setShowDetailsTrip}
        dateSortOrder={dateSortOrder}
        setDateSortOrder={setDateSortOrder}
        readOnly // disable all actions
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

export default AllTrips;
