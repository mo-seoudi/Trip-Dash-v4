// client/src/components/trips/PassengersPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTripPassengers, addTripPassengers } from "../../services/tripService";
import { toast } from "react-toastify";

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export default function PassengersPanel({ trip, readOnly = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [fullName, setFullName] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);

  const nameRef = useRef(null);
  const tripId = useMemo(() => trip?.id, [trip]);

  useEffect(() => {
    if (!tripId) return;
    let on = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await getTripPassengers(tripId);
        if (on) setRoster(rows);
      } catch (e) {
        console.error(e);
        toast.error("Could not load passengers.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [tripId]);

  const resetInputs = () => {
    setFullName("");
    setGuardianName("");
    setGuardianPhone("");
    setPickupPoint("");
    setDropoffPoint("");
    setNotes("");
    setCheckedIn(false);
  };

  const handleAdd = async () => {
    if (readOnly) return;
    const name = fullName.trim();
    if (!name) {
      nameRef.current?.focus();
      return;
    }
    try {
      setAdding(true);
      const created = await addTripPassengers(tripId, [
        {
          fullName: name,
          guardianName: guardianName.trim() || null,
          guardianPhone: guardianPhone.trim() || null,
          pickupPoint: pickupPoint.trim() || null,
          dropoffPoint: dropoffPoint.trim() || null,
          notes: notes.trim() || null,
          checkedIn,
        },
      ]);
      setRoster((prev) => [...created, ...prev]);
      toast.success(`Added “${name}”`);
      resetInputs();
      nameRef.current?.focus();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add passengers.");
    } finally {
      setAdding(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !adding && !readOnly) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold">Passengers — Trip #{tripId}</h3>
      </div>

      {!readOnly && (
        <div className="mb-3 space-y-2">
          <div className="flex w-full items-stretch gap-2">
            <input
              ref={nameRef}
              type="text"
              placeholder="Full name"
              className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !fullName.trim()}
              className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2
                ${adding || !fullName.trim() ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {adding ? <Spinner /> : null}
              <span>{adding ? "Adding…" : "Add"}</span>
            </button>
          </div>

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
                placeholder="Guardian name (optional)"
                className="border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Guardian phone (optional)"
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
              <div className="md:col-span-2 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={checkedIn}
                    onChange={(e) => setCheckedIn(e.target.checked)}
                    disabled={adding}
                  />
                  Checked-in on add
                </label>
              </div>
              <textarea
                placeholder="Notes (optional)"
                rows={2}
                className="md:col-span-2 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={adding}
              />
            </div>
          )}
        </div>
      )}

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
            {roster.map((p) => (
              <li key={p.id} className="grid grid-cols-5 gap-2 px-3 py-2 text-sm">
                <div className="truncate">{p.fullName}</div>
                <div className="truncate">{p.guardianName ?? "-"}</div>
                <div className="truncate">{p.guardianPhone ?? "-"}</div>
                <div>{p.checkedIn ? "Yes" : "No"}</div>
                <div className="truncate">
                  {[
                    p.pickupPoint ? `Pickup: ${p.pickupPoint}` : null,
                    p.dropoffPoint ? `Dropoff: ${p.dropoffPoint}` : null,
                    p.notes ? `Notes: ${p.notes}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "-"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
