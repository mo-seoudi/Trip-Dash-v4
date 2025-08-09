// client/src/layout/TripsLayout.jsx
import React, { useState } from "react";
import TripFilters from "../components/TripFilters";
import dayjs from "dayjs";
import { useFilteredTrips } from "../hooks/useFilteredTrips";

const TripsLayout = ({
  title = "All Trips",
  trips = [],
  calendarComponent: CalendarViewComponent,
  tableComponent: TableViewComponent,
}) => {
  const [calendarMode, setCalendarMode] = useState(false);

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
  } = useFilteredTrips(trips);

  const uniqueMonths = Array.from(
    new Set(
      (trips || []).map((trip) =>
        dayjs(trip.departureDate || trip.returnDate).format("MMMM YYYY")
      )
    )
  ).sort((a, b) => dayjs(b, "MMMM YYYY") - dayjs(a, "MMMM YYYY"));

  const statusOptions = ["Pending", "Accepted", "Confirmed", "Completed", "Canceled", "Rejected"];

  return (
    <div className="bg-white shadow rounded-xl overflow-hidden">
      {/* Header Row with Title, Toggle Button, and Filters */}
      <div className="flex flex-wrap justify-between items-center p-4 border-b gap-4">
        <div className="text-xl font-bold">{title}</div>

        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {CalendarViewComponent && (
            <button
              onClick={() => setCalendarMode(!calendarMode)}
              className="w-[160px] px-4 py-1.5 bg-blue-600 text-white rounded text-sm relative overflow-hidden transition-colors duration-300 hover:bg-blue-700"
            >
              <span className="relative z-10">
                {calendarMode ? "Show Table View" : "Show Calendar View"}
              </span>
              <span className="absolute inset-0 bg-blue-700 opacity-0 hover:opacity-10 transition-opacity duration-300"></span>
            </button>
          )}

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
      </div>

      {/* Conditional Calendar or Table View */}
      <div className="relative min-h-[700px] w-full transition-all duration-300">
        {calendarMode && CalendarViewComponent ? (
          <CalendarViewComponent trips={filteredTrips} />
        ) : (
          <TableViewComponent
            trips={filteredTrips}
            dateSortOrder={dateSortOrder}
            setDateSortOrder={setDateSortOrder}
          />
        )}
      </div>
    </div>
  );
};

export default TripsLayout;
