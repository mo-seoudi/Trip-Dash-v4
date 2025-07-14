import React, { useState } from "react";
import FinanceTable from "../components/FinanceTable";
import { exportToCSV } from "../utils/exportToCSV";

function Finance() {
  const [trips, setTrips] = useState([
    {
      id: 1,
      tripType: "Sports Trip",
      destination: "City Stadium",
      date: "2025-06-22T09:00",
      student_count: 45,
      price: 400,
      requester: "Ms. Carter",
      status: "Confirmed",
      paid: false,
    },
    {
      id: 2,
      tripType: "Academic Trip",
      destination: "Science Center",
      date: "2025-05-25T08:30",
      student_count: 30,
      price: 320,
      requester: "Mr. Daniels",
      status: "Confirmed",
      paid: true,
    },
    {
      id: 3,
      tripType: "Day Trip",
      destination: "Botanical Gardens",
      date: "2025-05-14T10:00",
      student_count: 40,
      price: 290,
      requester: "Ms. Lina",
      status: "Confirmed",
      paid: true,
    },
  ]);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");

  const handleTogglePaid = (tripId) => {
    setTrips((prevTrips) =>
      prevTrips.map((trip) =>
        trip.id === tripId ? { ...trip, paid: !trip.paid } : trip
      )
    );
  };

  const handleExport = () => {
    exportToCSV(filteredTrips, "finance-trips");
  };

  const toggleSortOrder = () =>
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));

  // Get all unique months from trips
  const availableMonths = [
    ...new Set(
      trips.map((trip) =>
        new Date(trip.date).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
        })
      )
    ),
  ];

  const filteredTrips = trips
    .filter((trip) => {
      if (filter === "paid") return trip.paid;
      if (filter === "unpaid") return !trip.paid;
      return true;
    })
    .filter((trip) => {
      const q = search.toLowerCase();
      return (
        trip.requester.toLowerCase().includes(q) ||
        trip.destination.toLowerCase().includes(q)
      );
    })
    .filter((trip) => {
      if (month === "all") return true;
      const tripMonth = new Date(trip.date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
      });
      return tripMonth === month;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  const totalRevenue = filteredTrips
    .filter((trip) => trip.paid)
    .reduce((sum, trip) => sum + (trip.price || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <label className="font-semibold">Filter by:</label>

        <select
          className="border px-2 py-1 rounded"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Payment Status</option>
          <option value="paid">Paid Trips</option>
          <option value="unpaid">Unpaid Trips</option>
        </select>

        <select
          className="border px-2 py-1 rounded"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="all">All Months</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by requester or destination"
          className="border px-3 py-1 rounded w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          onClick={toggleSortOrder}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Sort by Date: {sortOrder === "asc" ? "Oldest" : "Newest"}
        </button>

        <button
          onClick={handleExport}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          Export CSV
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Total Paid Revenue (filtered): <strong>${totalRevenue}</strong>
      </p>

      <FinanceTable trips={filteredTrips} onTogglePaid={handleTogglePaid} />
    </div>
  );
}

export default Finance;
