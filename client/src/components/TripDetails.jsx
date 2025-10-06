// client/src/components/TripDetails.jsx
import React from "react";
import StatusBadge from "./StatusBadge";
import TripActions from "./TripActions";
import { useAuth } from "../context/AuthContext";
import { getAllTrips, getTripsByUser } from "../services/tripService";

function TripDetails({ trip }) {
  if (!trip) return null;

  const { profile } = useAuth();

  // Keep a local copy so the modal reflects updates immediately after actions
  const [currentTrip, setCurrentTrip] = React.useState(trip);
  React.useEffect(() => {
    // If the parent passes a newer trip, sync it in
    setCurrentTrip(trip);
  }, [trip]);

  // Called by BusCompanyActions / StaffActions after they finish an update
  const refreshCallback = React.useCallback(async () => {
    try {
      // Re-fetch the latest trips for the signed-in role
      let latest = [];
      if (
        profile?.role === "admin" ||
        profile?.role === "school_staff" ||
        profile?.role === "bus_company" ||
        profile?.role === "finance"
      ) {
        latest = await getAllTrips();
      } else {
        latest = await getTripsByUser(profile?.name);
      }

      // Find the updated trip and update local state
      const updated = latest.find((t) => t.id === currentTrip.id);
      if (updated) {
        setCurrentTrip(updated);
        // Broadcast so AllTrips can patch its parent `trips` (keeps table/calendar in sync)
        try {
          window.dispatchEvent(new CustomEvent("trip:updated", { detail: updated }));
        } catch (_) {}
      }
    } catch (e) {
      console.error("TripDetails refresh failed:", e);
      // Even if refresh fails, the actions components already called the API.
      // Parent may also refetch separately; we leave UI as-is to avoid flicker.
    }
  }, [currentTrip.id, profile]);

  // Helpers
  const buses = Array.isArray(currentTrip.buses) ? currentTrip.buses : [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formattedDate = formatDate(currentTrip.date);
  const returnDate = formatDate(currentTrip.returnDate);
  const departureTime = currentTrip.departureTime || "-";
  const returnTime = currentTrip.returnTime || "-";

  return (
    <div className="space-y-6">
      {/* Trip Summary */}
      <div>
        <h2 className="text-xl font-bold mb-2">Trip Summary</h2>
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
          <div>
            <strong>Trip Type:</strong>{" "}
            {currentTrip.tripType === "Other" ? currentTrip.customType : currentTrip.tripType}
          </div>
          <div>
            <strong>Destination:</strong> {currentTrip.destination}
          </div>
          <div>
            <strong>Departure:</strong> {formattedDate} at: {departureTime}
          </div>
          <div>
            <strong>Return:</strong> {returnDate} at: {returnTime}
          </div>
          <div>
            <strong>Students:</strong> {currentTrip.students}
          </div>
          <div className="flex items-center">
            <strong className="mr-1">Status:</strong>{" "}
            <StatusBadge status={currentTrip.status} />
          </div>
          {currentTrip.notes && (
            <div className="col-span-2">
              <strong>Notes:</strong> {currentTrip.notes}
            </div>
          )}
          {currentTrip.requester && (
            <div className="col-span-2">
              <strong>Requested by:</strong> {currentTrip.requester}
            </div>
          )}
        </div>
      </div>

      {/* Actions (Bus Company & Staff) — no View button here */}
      {(profile?.role === "bus_company" || profile?.role === "school_staff") && (
        <div className="bg-white border rounded p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Actions</h3>
          {/* TripActions internally chooses BusCompanyActions or StaffActions.
              Both already call `refreshCallback` when done. */}
          <TripActions
            trip={currentTrip}
            profile={profile}
            refreshCallback={refreshCallback}
          />
        </div>
      )}

      <hr className="my-2 border-gray-300" />

      {/* Assigned Buses */}
      {buses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Assigned Buses</h3>
          <div className="space-y-3">
            {buses.map((bus, index) => {
              const busStatus =
                bus?.status && String(bus.status).trim()
                  ? bus.status
                  : currentTrip.status;

              return (
                <div key={index} className="bg-white border rounded p-4 shadow-sm">
                  <p className="font-medium mb-1">Bus #{index + 1}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><strong>Type:</strong> {bus.busType}</div>
                    <div><strong>Seats:</strong> {bus.busSeats}</div>
                    <div>
                      <strong>Price:</strong>{" "}
                      {bus.tripPrice ? `AED ${bus.tripPrice}` : "-"}
                    </div>
                    <div><strong>Driver Name:</strong> {bus.driverName || "-"}</div>
                    <div><strong>Driver Phone:</strong> {bus.driverPhone || "-"}</div>
                    <div className="flex items-center">
                      <strong className="mr-1">Status:</strong>{" "}
                      <StatusBadge status={busStatus} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TripDetails;
