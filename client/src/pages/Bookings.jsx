// client/src/pages/Bookings.jsx

import React from "react";
import BusBookingForm from "../components/booking/BusBookingForm";

export default function Bookings() {
  return (
    <div className="bg-white rounded shadow p-4">
      <BusBookingForm onSuccess={() => { /* maybe navigate or refresh a list */ }} />
    </div>
  );
}
