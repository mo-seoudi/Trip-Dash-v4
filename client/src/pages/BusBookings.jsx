// client/src/pages/BusBookings.jsx

import React from "react";

export default function BusBookings() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Bus Bookings</h1>
        {/* You can drop a New Booking button here later */}
      </div>
      <p className="text-gray-600">
        Create and manage ad-hoc bus bookings (not tied to trips).
      </p>
    </div>
  );
}
