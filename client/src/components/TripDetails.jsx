// client/src/components/TripDetails.jsx
import React, { useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import StatusBadge from "./StatusBadge";

/** Lightweight popover for showing/copying the email */
function EmailPopover({ email = "-", onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(email || "");
      // Optional: toast or subtle feedback—omitted to keep this self-contained
    } catch {}
  };

  return (
    <div
      ref={ref}
      className="absolute z-20 mt-2 right-0 w-64 rounded-xl border bg-white p-3 text-sm shadow-xl"
      role="dialog"
      aria-label="Requester email"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">Email</span>
        <button
          className="text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
      </div>
      <div className="mt-2 text-gray-700 break-all">{email || "—"}</div>
      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCopy}
          className="px-2 py-1 rounded border hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/**
 * Symmetric layout:
 *  - Row 1: Trip Type | Requested by  (requested-by is mandatory)
 *  - Row 2: Origin | Destination
 *  - Row 3: Departure | Return
 *  - Row 4: [left] Students & Staff together   |  [right] Passengers (Total)
 *  - Row 5: Booster Seats (only if requested and > 0)
 *  - Row 6: Notes (if any)
 *  - Row 7: Status (ALWAYS last)
 *
 * Label & value are left-aligned together:  "Trip Type: Sports Trip"
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
    trip.createdByName,
    trip.ownerName,
    trip.requester,
    trip.requestedBy,
    trip.createdBy,
    trip.owner,
    trip.requester?.name,
    trip.requestedBy?.name,
    trip.createdBy?.name,
    trip.owner?.name,
    "—"
  );
  const requesterEmail = pick(
    trip.requesterEmail,
    trip.requestedByEmail,
    trip.createdByEmail,
    trip.ownerEmail,
    trip.requester?.email,
    trip.requestedBy?.email,
    trip.createdBy?.email,
    trip.owner?.email,
    ""
  );

  const fmtDate = (d) => {
    if (!d) return "—";
    const dj = dayjs(d);
    return dj.isValid() ? dj.format("DD-MMM-YYYY") : String(d);
  };

  const formattedDate = fmtDate(rawDate);
  const formattedReturnDate = fmtDate(rawReturnDate);

  // Passengers (Total)
  const studentsNum = Number(students);
  const hasStudentsNum = !Number.isNaN(studentsNum);
  const totalPassengers =
    (hasStudentsNum ? studentsNum : 0) + (Number.isFinite(staffNum) ? staffNum : 0);
  // We show the right-side cell regardless for alignment; use "—" when not computable.
  const passengersText =
    Number.isFinite(totalPassengers) && totalPassengers > 0 ? totalPassengers : "—";

  // Booster (only show if requested AND > 0)
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
  const [showRequesterEmail, setShowRequesterEmail] = useState(false);

  // Summary row with left-aligned "Label: Value"
  const SummaryItem = ({ label, children, className = "" }) => (
    <div className={`flex items-baseline ${className}`}>
      <span className="text-sm text-gray-600 whitespace-nowrap">{label}:</span>
      <span className="font-medium text-gray-900 ml-2">{children ?? "—"}</span>
    </div>
  );

  // Optional Assigned Buses (kept as in your file)
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
            {/* Row 1: Trip Type | Requested by (not optional) */}
            <SummaryItem label="Trip Type">
              {trip.tripType === "Other" ? pick(trip.customType, "Other") : pick(trip.tripType, "—")}
            </SummaryItem>

            <div className="flex items-baseline relative">
              <span className="text-sm text-gray-600 whitespace-nowrap">Requested by:</span>
              <span className="ml-2">
                <button
                  type="button"
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => setShowRequesterEmail((s) => !s)}
                  aria-expanded={showRequesterEmail}
                  aria-controls="requester-email-popover"
                  title="Show email"
                >
                  {requesterName}
                </button>
              </span>
              {showRequesterEmail && (
                <div id="requester-email-popover" className="absolute right-0 top-6">
                  <EmailPopover
                    email={requesterEmail}
                    onClose={() => setShowRequesterEmail(false)}
                  />
                </div>
              )}
            </div>

            {/* Row 2: Origin | Destination */}
            <SummaryItem label="Origin">{origin}</SummaryItem>
            <SummaryItem label="Destination">{destination}</SummaryItem>

            {/* Row 3: Departure | Return */}
            <SummaryItem label="Departure">
              {formattedDate} <span className="text-gray-500">at</span> {departureTime}
            </SummaryItem>
            <SummaryItem label="Return">
              {formattedReturnDate} <span className="text-gray-500">at</span> {returnTime}
            </SummaryItem>

            {/* Row 4: [left] Students & Staff together | [right] Passengers (Total) */}
            <div className="flex items-baseline">
              <span className="text-sm text-gray-600 whitespace-nowrap">Students:</span>
              <span className="font-medium text-gray-900 ml-2">{students}</span>

              <span className="text-sm text-gray-600 whitespace-nowrap ml-4">Staff:</span>
              <span className="font-medium text-gray-900 ml-2">
                {staffNum != null && !Number.isNaN(staffNum) ? staffNum : (
                  <span className="text-gray-400">not set</span>
                )}
              </span>
            </div>
            <SummaryItem label="Passengers (Total)">{passengersText}</SummaryItem>

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

      {/* Assigned Buses (optional — left as in your working file) */}
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
