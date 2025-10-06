import React from "react";

function TripDetails({ trip }) {
  if (!trip) return null;

  const buses = trip.buses || trip.subTrips || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formattedDate = formatDate(trip.date);
  const returnDate = formatDate(trip.returnDate);
  const departureTime = trip.departureTime || "-";
  const returnTime = trip.returnTime || "-";

  return (
    <div className="space-y-6">
      {/* Parent Trip Info */}
      <div>
        <h2 className="text-xl font-bold mb-2">Trip Summary</h2>
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
          <div>
            <strong>Trip Type:</strong> {trip.tripType === "Other" ? trip.customType : trip.tripType}
          </div>
          <div>
            <strong>Destination:</strong> {trip.destination}
          </div>
          <div>
            <strong>Departure:</strong> {formattedDate} at: {departureTime}
          </div>
          <div>
            <strong>Return:</strong> {returnDate} at: {returnTime}
          </div>
          <div>
            <strong>Students:</strong> {trip.students}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                ${trip.status === "Confirmed" ? "bg-green-100 text-green-800" : 
                  trip.status === "Pending" ? "bg-yellow-100 text-yellow-800" : 
                  trip.status === "Completed" ? "bg-gray-200 text-gray-800" : 
                  "bg-gray-100 text-gray-700"}`}
            >
              {trip.status}
            </span>
          </div>
          {trip.notes && (
            <div className="col-span-2">
              <strong>Notes:</strong> {trip.notes}
            </div>
          )}
          {trip.requester && (
            <div className="col-span-2">
              <strong>Requested by:</strong> {trip.requester}
            </div>
          )}
        </div>
      </div>

      <hr className="my-2 border-gray-300" />

      {/* Assigned Buses */}
      {buses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Assigned Buses</h3>
          <div className="space-y-3">
            {buses.map((bus, index) => (
              <div key={index} className="bg-white border rounded p-4 shadow-sm">
                <p className="font-medium mb-1">Bus #{index + 1}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><strong>Type:</strong> {bus.busType}</div>
                  <div><strong>Seats:</strong> {bus.busSeats}</div>
                  <div><strong>Price:</strong> {bus.tripPrice ? `AED ${bus.tripPrice}` : "-"}</div>
                  <div><strong>Driver Name:</strong> {bus.driverName || "-"}</div>
                  <div><strong>Driver Phone:</strong> {bus.driverPhone || "-"}</div>
                  <div><strong>Status:</strong> {bus.status || "-"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specific Sub-Trip (if opened directly) */}
      {trip.subTrip && (
        <>
          <hr className="my-2 border-gray-300" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Viewing Specific Sub-Trip</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded border">
              <div><strong>Seats:</strong> {trip.subTrip.busSeats}</div>
              <div><strong>Status:</strong> {trip.subTrip.status}</div>
              <div><strong>Bus Type:</strong> {trip.subTrip.busType}</div>
              <div><strong>Trip Price:</strong> {trip.subTrip.tripPrice}</div>
              <div><strong>Driver Name:</strong> {trip.subTrip.driverName}</div>
              <div><strong>Driver Phone:</strong> {trip.subTrip.driverPhone}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TripDetails;
