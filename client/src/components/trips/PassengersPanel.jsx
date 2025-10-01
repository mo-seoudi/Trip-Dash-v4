// client/src/components/trips/PassengersPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTripPassengers, addTripPassengers } from "../../services/tripService";
import { toast } from "react-toastify";

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

/**
 * Pass `readOnly` to control edit capability:
 * - readOnly = true  -> hide Add row (view-only)
 * - readOnly = false -> allow adding passengers
 */
export default function PassengersPanel({ trip, readOnly = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const inputRef = useRef(null);

  const tripId = useMemo(() => trip?.id, [trip]);

  // load roster
  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    (async () => {
      try {
        const rows = await getTripPassengers(tripId);
        if (mounted) setRoster(rows);
      } catch (err) {
        console.error("load passengers failed:", err);
        toast.error("Could not load passengers.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tripId]);

  const handleAdd = async () => {
    if (readOnly) return; // guard: no-op when read-only
    const fullName = nameInput.trim();
    if (!fullName) {
      inputRef.current?.focus();
      return;
    }
    try {
      setAdding(true);
      const created = await addTripPassengers(tripId, [{ fullName }], true);
      setRoster((prev) => [...created, ...prev]);
      setNameInput("");
      toast.success(`Added “${fullName}”`);
      inputRef.current?.focus();
    } catch (err) {
      console.error("add passenger failed:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to add passenger.";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!adding && !readOnly) handleAdd();
    }
  };

  return (
    <div className="w-full max-w-3xl">
      {/* Header: leave right padding so it doesn't fight the modal's × */}
      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold">Passengers — Trip #{tripId}</h3>
      </div>

      {/* Add row (hidden in read-only mode) — add right padding too */}
      {!readOnly && (
        <div className="flex gap-2 mb-3 pr-12">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type passenger name and press Add…"
            className="flex-1 border rounded px-3 py-2"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={adding}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !nameInput.trim()}
            className={`px-4 py-2 rounded text-white flex items-center gap-2 min-w-[72px] justify-center
            ${adding || !nameInput.trim() ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {adding ? <Spinner /> : null}
            <span>{adding ? "Adding…" : "Add"}</span>
          </button>
        </div>
      )}

      <div className="border rounded">
        <div className="grid grid-cols-6 gap-2 px-3 py-2 text-sm font-semibold bg-gray-50">
          <div>Name</div>
          <div>Seat</div>
          <div>Pickup</div>
          <div>Dropoff</div>
          <div>Checked In</div>
          <div>Payment</div>
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
            {roster.map((p) => (
              <li key={p.id} className="grid grid-cols-6 gap-2 px-3 py-2 text-sm">
                <div className="truncate">{p.fullName}</div>
                <div className="truncate">{p.seatNumber || "-"}</div>
                <div className="truncate">{p.pickupPoint || "-"}</div>
                <div className="truncate">{p.dropoffPoint || "-"}</div>
                <div>{p.checkedIn ? "Yes" : "No"}</div>
                <div className="truncate">{p.latestPaymentStatus || "-"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
