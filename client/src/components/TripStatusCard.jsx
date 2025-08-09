import React, { useState } from "react";

function TripStatusCard({ trip }) {
  const [status, setStatus] = useState(trip.status || "Pending");
  const [price, setPrice] = useState(trip.price || "");
  const [driverName, setDriverName] = useState(trip.driver_name || "");
  const [busType, setBusType] = useState(trip.bus_type || "");

  const handleUpdate = () => {
    console.log("Updated trip info:", {
      status,
      price,
      driverName,
      busType,
    });

    alert("Trip updated (not yet saving to backend)");
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow space-y-2">
      <h3 className="font-semibold text-lg">Manage Trip: {trip.tripType}</h3>
      <div>
        <label>Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border p-2">
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Needs Attention">Needs Attention</option>
        </select>
      </div>
      <div>
        <label>Price:</label>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border p-2" />
      </div>
      <div>
        <label>Driver Name:</label>
        <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="w-full border p-2" />
      </div>
      <div>
        <label>Bus Type:</label>
        <input type="text" value={busType} onChange={(e) => setBusType(e.target.value)} className="w-full border p-2" />
      </div>
      <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Updates
      </button>
    </div>
  );
}

export default TripStatusCard;
