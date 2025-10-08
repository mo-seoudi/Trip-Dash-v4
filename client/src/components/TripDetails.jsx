// client/src/components/TripDetails.jsx
import React, { useState } from "react";
import dayjs from "dayjs";
import StatusBadge from "./StatusBadge";

/**
 * Symmetric layout:
 *  - Trip Type (full width)
 *  - Origin | Destination
 *  - Departure | Return
 *  - [ONE ROW] Students | Staff | Passengers (Total)
 *  - Booster Seats (only if requested and > 0)
 *  - Notes (if any)
 *  - Status (ALWAYS last)
 *
 * Label & value are left-aligned together: "Trip Type: Sports Trip"
 */
export default function TripDetails({ trip }) {
  if (!trip) return null;

  // Tolerant getters
  const pick = (...vals) =>
    vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? null;

  const origin = pick(trip.origin, trip.from, trip.startLocation, trip.pickup, "School");
  const destination = pick(trip.destination, trip.to, trip.endLocation, "—");

  const rawDate = pick(trip.date, trip.tripDate, trip.startDate, trip.departureDate);
  const rawReturnDate = pick(trip.returnDate, trip.endDate);

  const departureTime = pick(trip.departureTime, trip.time, "—");
  const returnTime = pick(trip.returnTime, "—");

  const students = pick(trip.students, trip.studentCount, trip.numStudents, "—");
  const staff = pick(trip.staff, trip.staffCount, trip.chaperones, null);
  const staffNum = staff != null ? Number(staff) : null;

  const status = pick(trip._status, trip.status, "unknown");

  const requesterName = pick(
    trip.requesterName,
    trip.requestedByName,
    trip.requester,
    trip.requestedBy?.name
  );
  const requesterEmail = pick(
    trip.requesterEmail,
    trip.requestedByEmail,
    trip.requestedBy?.email
  );

  const fmtDate = (d) => {
    if (!d) return "—";
    const dj = dayjs(d);
    return dj.isValid() ? dj.format("DD-MMM-YYYY") : String(d);
  };

  const formattedDate = fmtDate(rawDate);
  const formattedReturnDate = fmtDate(rawReturnDate);

  // Passengers (Total) shown only when it makes sense
  const studentsNum = Number(students);
  const hasStudentsNum = !Number.isNaN(studentsNum);
  const totalPassengers =
    (hasStudentsNum ? studentsNum : 0) + (Number.isFinite(staffNum) ? staffNum : 0);
  const showTotalPassengers = Number.isFinite(totalPassengers) && totalPassengers > 0;

  // Booster: render its own field only if requested AND count > 0
  const boosterRequested = !!pick(
    trip.boosterSeatsRequested,
    trip.boosterSeatRequested,
    trip.requestBoosterSeats,
    false
  );
  const boosterCountRaw = pick(
    trip.boosterSeatCount,
    trip.boosterSeatsCount,
    trip.boosterCount,
    0
  );
  const boosterCount = Number(boosterCountRaw) || 0;
  const showBoosterRow = boosterRequested && boosterCount > 0;

  // Notes (DB-saved; may already include booster info from forms)
  const notes = trip.notes || null;

  // Email popover
  const [showEmail, setShowEmail] = useState(false);

  // Summary row with left-aligned "Label: Value"
  const SummaryItem = ({ label, children, className = "" }) => (
    <div className={`flex items-baseline ${className}`}>
      <span className="text-sm text-gray-600 whitespace-nowrap">{label}:</span>
      <span className="font-medium text-gray-900 ml-2">{children ?? "—"}</span>
    </div>
  );

  // Optional Assigned Buses
  const buses = Array.isArray(trip.assignedBuses)
    ? trip.assignedBuses
    : Array.isArray(trip.buses)
    ? trip.buses
    : [];

  return (
    <div className="space-y-6">
      {/* Trip Summary */}
      <div>
        <h2 className="text-xl font-bold mb-2">Trip Summary</h2>

        <div className="bg-gray-50 p-4 rounded border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trip Type (full width) */}
            <SummaryItem label="Trip Type" className="sm:col-span-2">
              {trip.tripType === "Other" ? pick(trip.customType, "Other") : pick(trip.tripType, "—")}
            </SummaryItem>

            {/* Origin | Destination */}
            <SummaryItem label="Origin">{origin}</SummaryItem>
            <SummaryItem label="Destination">{destination}</SummaryItem>

            {/* Departure | Return */}
            <SummaryItem label="Departure">
              {formattedDate} <span className="text-gray-500">at</span> {departureTime}
            </SummaryItem>
            <SummaryItem label="Return">
              {formattedReturnDate} <span className="text-gray-500">at</span> {returnTime}
            </SummaryItem>

            {/* Requested by — optional (kept) */}
            {(requesterName || requesterEmail) && (
              <div className="sm:col-span-2">
                <div className="flex items-baseline relative">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Requested by:</span>
                  <span className="ml-2">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline font-medium"
                      onClick={() => setShowEmail((s) => !s)}
                      aria-expanded={showEmail}
                      title="Show email"
                    >
                      {requesterName || "View email"}
                    </button>
                  </span>
                  {showEmail && requesterEmail && (
                    <div className="absolute right-0 top-6 mt-2 w-60 rounded-xl border bg-white p-3 text-sm shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Email</span>
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setShowEmail(false)}
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-2 text-gray-700 break-all">{requesterEmail}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ONE ROW: Students | Staff | Passengers (Total) */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryItem label="Students">{students}</SummaryItem>
              <SummaryItem label="Staff">
                {staffNum != null && !Number.isNaN(staffNum) ? (
                  staffNum
                ) : (
                  <span className="text-gray-400">not set</span>
                )}
              </SummaryItem>
              {showTotalPassengers && (
                <SummaryItem label="Passengers (Total)">{totalPassengers}</SummaryItem>
              )}
            </div>

            {/* Booster Seats (only if requested and > 0) */}
            {showBoosterRow && (
              <SummaryItem label="Booster Seats" className="sm:col-span-2">
                {boosterCount}
              </SummaryItem>
            )}

            {/* Notes (if any) */}
            {notes && (
              <div className="sm:col-span-2">
                <div className="flex items-baseline">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Notes:</span>
                  <span className="ml-2 text-gray-900">{notes}</span>
                </div>
              </div>
            )}

            {/* Status LAST */}
            <div className="sm:col-span-2">
              <div className="flex items-baseline">
                <span className="text-sm text-gray-600 whitespace-nowrap">Status:</span>
                <span className="ml-2">
                  <StatusBadge status={status} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Buses (optional) */}
      {buses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Assigned Buses</h3>
          <div className="space-y-3">
            {buses.map((bus, i) => {
              const seats = pick(bus.seats, bus.capacity);
              const price = pick(bus.price, bus.cost);
              const type = pick(bus.type, bus.busType, "—");
              const driverName = pick(bus.driverName, bus.driver?.name);
              const driverPhone = pick(bus.driverPhone, bus.driver?.phone);

              return (
                <div key={bus.id || i} className="border rounded-lg p-4 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-baseline">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Bus:</span>
                      <span className="ml-2 font-medium">{type} (#{i + 1})</span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Seats:</span>
                      <span className="ml-2 font-medium">{seats ?? "—"}</span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Price:</span>
                      <span className="ml-2 font-medium">{price != null ? price : "—"}</span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Driver Name:</span>
                      <span className="ml-2 font-medium">{driverName ?? "—"}</span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Driver Phone:</span>
                      <span className="ml-2 font-medium">{driverPhone ?? "—"}</span>
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
