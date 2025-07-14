import React from "react";
import { useParams } from "react-router-dom";

function TripDetails() {
  const { id } = useParams();

  // Dummy trip data (would be fetched from backend)
  const trip = {
    id,
    tripType: "Academic Trip",
    destination: "Planetarium",
    date: "2025-06-28T09:00",
    student_count: 40,
    notes: "Please ensure AC on the bus",
    status: "Confirmed",
    price: 300,
    requester: "Ms. Layla",
    driver_name: "Mohammed Amin",
    bus_type: "Large 50-seater",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow rounded-lg space-y-4">
      <h2 className="text-2xl font-bold">Trip Details</h2>

      <div><strong>tripType:</strong> {trip.tripType}</div>
      <div><strong>Destination:</strong> {trip.destination}</div>
      <div><strong>Date:</strong> {new Date(trip.date).toLocaleString()}</div>
      <div><strong>Students:</strong> {trip.student_count}</div>
      <div><strong>Status:</strong> {trip.status}</div>
      <div><strong>Price:</strong> ${trip.price}</div>
      <div><strong>Requested by:</strong> {trip.requester}</div>
      <div><strong>Driver:</strong> {trip.driver_name}</div>
      <div><strong>Bus Type:</strong> {trip.bus_type}</div>
      <div><strong>Notes:</strong> {trip.notes}</div>
    </div>
  );
}

export default TripDetails;
