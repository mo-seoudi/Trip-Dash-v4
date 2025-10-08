// src/components/TripDetails.jsx
import React, { useState } from "react";
import dayjs from "dayjs";
import StatusBadge from "./StatusBadge";

/**
 * TripDetails
 * - Symmetric layout:
 *   Row 1: Trip Type (full width)
 *   Row 2: Origin | Destination
 *   Row 3: Departure | Return
 *   Row 4: Students | Staff
 *   Row 5: Passengers (Total)  [optional, full width when available]
 *   Row 6: Requested by        [optional, full width]
 *   Row 7: Status              [full width, last]
 *   Row 8: Notes               [full width]
 *
 * - Booster seats are reflected in Notes:
 *   If boosterSeatsRequested is true (optionally with boosterSeatCount),
 *   it is prepended to any existing notes using " - " as a separator, e.g.:
 *     "22 Booster seats - Leave from Gate 2"
 */
export default function TripDetails({ trip }) {
  if (!trip) return null;

  // --- tolerant getters ---
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? null;

  const origin = pick(trip.origin, trip.from, trip.startLocation, trip.pickup, "—");
  const destination = pick(trip.destination, trip.to, trip.endLocation, "—");

  const rawDate = pick(trip.date, trip.tripDate, trip.startDate, trip.departureDate);
  const rawReturnDate = pick(trip.returnDate, trip.endDate);

  const departureTime = pick(trip.departureTime, trip.time, "—");
  const returnTime = pick(trip.returnTime, "—");

  const students = pick(trip.students, trip.studentCount, trip.numStudents, "—");
  const staff = pick(trip.staff, trip.staffCount, trip.chaperones, null);
  const staffNum = staff != null ? Number(staff) : null;

  const status = pick(trip._status, trip.status, "unknown");

  const requesterName = pick(trip.requesterName, trip.requestedByName, trip.requester, trip.requestedBy?.name);
  const requesterEmail = pick(trip.requesterEmail, trip.requestedByEmail, trip.requestedBy?.email);

  const boosterRequested = !!pick(trip.boosterSeatsRequested, trip.boosterSeatRequested, trip.requestBoosterSeats);
  const boosterCountVal = pick(trip.boosterSeatCount, trip.boosterSeatsCount, trip.boosterCount, 0);
  const boosterCount = Number(boosterCountVal) || 0;

  // --- formatting helpers ---
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
  const totalPassengers = (hasStudentsNum ? studentsNum : 0) + (Number.isFinite(staffNum) ? staffNum : 0);
  const showTotalPassengers = Number.isFinite(totalPassengers) && totalPassengers > 0;

  // Compose Notes with Booster Seats requirement
  const baseNotes = pick(trip.notes, trip.note, "");
  const boosterText = boosterRequested
    ? (boosterCount > 0 ? `${boosterCount} Booster seats` : `Booster seats requested`)
    : "";
  const notes =
    boosterText && baseNotes
      ? `${boosterText} - ${baseNotes}`
      : boosterText || baseNotes || null;

  // Simple email popover for "Requested by"
  const [showEmail, setShowEmail] = useState(false);

  // Reusable summary row
  const SummaryItem = ({ label, children, className = "" }) => (
    <div className={`flex items-baseline justify-between ${className}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-medium text-gray-900 text-right ml-4">{children ?? "—"}</span>
    </div>
  );

  // Assigned buses section (preserve existing feature if data present)
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
            {/* Trip Type full width */}
            <SummaryItem label="Trip Type" className="sm:col-span-2">
              {trip.tripType === "Other" ? pick(trip.customType, "Other") : pick(trip.tripType, "—")}
            </SummaryItem>

            {/* Origin | Destination (facing each other) */}
            <SummaryItem label="Origin">{origin}</SummaryItem>
            <SummaryItem label="Destination">{destination}</SummaryItem>

            {/* Departure | Return (facing each other) */}
            <SummaryItem label="Departure">
              {formattedDate} <span className="text-gray-500">at</span> {departureTime}
            </SummaryItem>
            <SummaryItem label="Return">
              {formattedReturnDate} <span className="text-gray-500">at</span> {returnTime}
            </SummaryItem>

            {/* Students | Staff */}
            <SummaryItem label="Students">{students}</SummaryItem>
            <SummaryItem label="Staff">
              {staffNum != null && !Number.isNaN(staffNum) ? staffNum : <span className="text-gray-400">not set</span>}
            </SummaryItem>

            {/* Passengers (Total) — optional */}
            {showTotalPassengers && (
              <SummaryItem label="Passengers (Total)" className="sm:col-span-2">
                {totalPassengers}
              </SummaryItem>
            )}

            {/* Requested by — optional */}
            {(requesterName || requesterEmail) && (
              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between relative">
                  <span className="text-sm text-gray-600">Requested by</span>
                  <span className="ml-4 text-right">
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

            {/* Status LAST */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className="ml-4">
                  <StatusBadge status={status} />
                </span>
              </div>
            </div>

            {/* Notes (with Booster seats injected) */}
            {notes && (
              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-600">Notes</span>
                  <span className="ml-4 text-right">{notes}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Buses (preserved feature; renders only if present) */}
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
              const busStatus = pick(bus.status, bus.state);

              return (
                <div key={bus.id || i} className="border rounded-lg p-4 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="text-sm text-gray-600">Bus #{i + 1}</div>
                      <div className="font-medium">{type}</div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-sm text-gray-600">Status</span>
                      <StatusBadge status={busStatus} />
                    </div>

                    <div className="text-sm">
                      <span className="text-gray-600">Seats:</span> <span className="font-medium">{seats ?? "—"}</span>
                    </div>

                    <div className="text-sm">
                      <span className="text-gray-600">Price:</span>{" "}
                      <span className="font-medium">{price != null ? price : "—"}</span>
                    </div>

                    <div className="text-sm">
                      <span className="text-gray-600">Driver Name:</span>{" "}
                      <span className="font-medium">{driverName ?? "—"}</span>
                    </div>

                    <div className="text-sm">
                      <span className="text-gray-600">Driver Phone:</span>{" "}
                      <span className="font-medium">{driverPhone ?? "—"}</span>
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
