// client/src/components/trips/PassengersPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getTripPassengers, addTripPassengers } from "../../services/tripService";

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

/**
 * Pass `readOnly` to control edit capability:
 * - readOnly = true  -> hide Add row (view-only)
 * - readOnly = false -> allow adding passengers
 *
 * DB-aligned fields used here (TripPassenger):
 * - id, tripId, fullName, guardianName?, guardianPhone?,
 *   pickupPoint?, dropoffPoint?, notes?, checkedIn (Boolean), createdAt
 */
export default function PassengersPanel({ trip, readOnly = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  // add form state
  const [adding, setAdding] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [fullName, setFullName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [notes, setNotes] = useState("");

  // UI: expanded detail rows
  const [openRows, setOpenRows] = useState(() => new Set());

  const inputRef = useRef(null);
  const tripId = useMemo(() => trip?.id, [trip]);

  // load roster
  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await getTripPassengers(tripId);
        if (mounted) setRoster(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.error("load passengers failed:", err);
        toast.error("Could not load passengers.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tripId]);

  const resetForm = () => {
    setFullName("");
    setGuardianName("");
    setGuardianPhone("");
    setPickupPoint("");
    setDropoffPoint("");
    setNotes("");
  };

  const handleAdd = async () => {
    if (readOnly) return;
    const name = fullName.trim();
    if (!name) {
      inputRef.current?.focus();
      return;
    }

    const payload = {
      fullName: name,
      guardianName: guardianName.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      pickupPoint: pickupPoint.trim() || undefined,
      dropoffPoint: dropoffPoint.trim() || undefined,
      notes: notes.trim() || undefined,
      checkedIn: false,
    };

    try {
      setAdding(true);
      // IMPORTANT: service wraps as { passengers: [...] }
      const created = await addTripPassengers(tripId, [payload], true);
      // Prepend newest created rows
      setRoster((prev) => [...(Array.isArray(created) ? created : []), ...prev]);
      toast.success(`Added “${name}”`);
      resetForm();
      inputRef.current?.focus();
    } catch (err) {
      console.error("add passenger failed:", err);
      const msg = err?.response?.data?.error || err?.message || "Failed to add passenger.";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !adding && !readOnly) {
      e.preventDefault();
      handleAdd();
    }
  };

  const toggleRow = (id) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full max-w-3xl">
      {/* Header: leave right padding so it doesn't fight the modal's × */}
      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold">Passengers — Trip #{tripId}</h3>
      </div>

      {/* Add row (hidden in read-only mode) */}
      {!readOnly && (
        <div className="mb-4 space-y-2">
          <div className="flex w-full items-stretch gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a passenger's name"
              className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={adding}
              aria-label="Passenger full name"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !fullName.trim()}
              className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2 ${
                adding || !fullName.trim()
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {adding ? <Spinner /> : null}
              <span>{adding ? "Adding…" : "Add"}</span>
            </button>
          </div>

          {/* optional fields toggle */}
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => setShowMore((s) => !s)}
          >
            {showMore ? "Hide extra fields" : "More fields (guardian, pickup/dropoff, notes)"}
          </button>

          {showMore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Guardian name"
                className="border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                disabled={adding}
              />
              <input
                type="tel"
                placeholder="Guardian phone"
                className="border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Pickup point (optional)"
                className="border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Dropoff point (optional)"
                className="border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={dropoffPoint}
                onChange={(e) => setDropoffPoint(e.target.value)}
                disabled={adding}
              />
              <textarea
                placeholder="Notes (optional)"
                className="md:col-span-2 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={adding}
              />
            </div>
          )}
        </div>
      )}

      {/* Table (DB-aligned, no seat/payment columns) */}
      <div className="border rounded">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 text-sm font-semibold bg-gray-50">
          <div>Name</div>
          <div>Guardian</div>
          <div>Phone</div>
          <div>Checked-in</div>
          <div>Details</div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-6 text-gray-500">
            <Spinner className="w-5 h-5" />
            Loading passengers…
          </div>
        ) : roster.length === 0 ? (
          <div className="px-3 py-6 text-gray-500 text-sm">No passengers yet.</div>
        ) : (
          <ul className="divide-y">
            {roster.map((p) => {
              const isOpen = openRows.has(p.id);
              return (
                <li key={p.id} className="px-3 py-2 text-sm">
                  {/* collapsed row */}
                  <div className="grid grid-cols-5 gap-2 items-center">
                    <div className="truncate">{p.fullName}</div>
                    <div className="truncate">{p.guardianName || "-"}</div>
                    <div className="truncate">{p.guardianPhone || "-"}</div>
                    <div>{p.checkedIn ? "Yes" : "No"}</div>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline justify-self-start"
                      onClick={() => toggleRow(p.id)}
                    >
                      {isOpen ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* expanded details */}
                  {isOpen && (
                    <div className="mt-2 ml-1 rounded bg-gray-50 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500">Pickup</div>
                        <div className="text-sm">{p.pickupPoint || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Dropoff</div>
                        <div className="text-sm">{p.dropoffPoint || "-"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500">Notes</div>
                        <div className="text-sm whitespace-pre-wrap">{p.notes || "-"}</div>
                      </div>
                      {p.createdAt && (
                        <div className="md:col-span-2 text-xs text-gray-400">
                          Added: {new Date(p.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
