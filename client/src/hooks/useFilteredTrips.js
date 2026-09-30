import { useState, useEffect } from "react";
import dayjs from "dayjs";

export const useFilteredTrips = (trips) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [bookingTypeFilter, setBookingTypeFilter] = useState("");
  const [dateSortOrder, setDateSortOrder] = useState("");
  const [filteredTrips, setFilteredTrips] = useState([]);

  useEffect(() => {
    let data = [...(trips || [])];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((trip) =>
        [trip.destination, trip.origin, trip.notes, trip.tripType, trip.requesterName, trip.requestedByName]
          .some((value) => String(value || "").toLowerCase().includes(q))
      );
    }

    if (statusFilter) data = data.filter((trip) => trip.status === statusFilter);

    if (bookingTypeFilter === "single") data = data.filter((trip) => !trip.tripSeriesId);
    if (bookingTypeFilter === "recurring") data = data.filter((trip) => Boolean(trip.tripSeriesId));
    if (bookingTypeFilter === "modified") data = data.filter((trip) => Boolean(trip.tripSeriesId && trip.occurrenceOverride));

    if (monthFilter) {
      data = data.filter((trip) => {
        const value = trip.departureDate || trip.date || trip.returnDate;
        return value && dayjs(value).format("MMMM YYYY") === monthFilter;
      });
    }

    if (dateSortOrder === "asc") data.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (dateSortOrder === "desc") data.sort((a, b) => new Date(b.date) - new Date(a.date));

    setFilteredTrips(data);
  }, [trips, search, statusFilter, monthFilter, bookingTypeFilter, dateSortOrder]);

  return {
    filteredTrips,
    search,setSearch,
    statusFilter,setStatusFilter,
    monthFilter,setMonthFilter,
    bookingTypeFilter,setBookingTypeFilter,
    dateSortOrder,setDateSortOrder,
    resetFilters: () => {
      setSearch("");
      setStatusFilter("");
      setMonthFilter("");
      setBookingTypeFilter("");
      setDateSortOrder("");
    },
  };
};
