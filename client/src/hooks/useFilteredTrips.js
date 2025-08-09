import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { format } from "date-fns";

export const useFilteredTrips = (trips, options = {}) => {
  const { role } = options;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dateSortOrder, setDateSortOrder] = useState("");
  const [filteredTrips, setFilteredTrips] = useState([]);

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
        const tripDate = new Date(trip.date);
        const formatted = role === "school_staff"
          ? format(tripDate, "MMMM yyyy")
          : dayjs(trip.date).format("MMMM YYYY");
        return formatted === monthFilter;
      });
    }

    if (dateSortOrder === "asc") {
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (dateSortOrder === "desc") {
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    setFilteredTrips(data);
  }, [trips, search, statusFilter, monthFilter, dateSortOrder, role]);

  return {
    filteredTrips,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    monthFilter,
    setMonthFilter,
    dateSortOrder,
    setDateSortOrder,
    resetFilters: () => {
      setSearch("");
      setStatusFilter("");
      setMonthFilter("");
      setDateSortOrder("");
    },
  };
};
