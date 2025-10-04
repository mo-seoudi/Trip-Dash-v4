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

  const [name, setName] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [notes, setNotes] = useState("");

  const inputRef = useRef(null);
  const tripId = useMemo(() => trip?.id, [trip]);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
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

  const resetForm = () => {
    setName("");
    setGuardianName("");
    setGuardianPhone("");
    setPickupPoint("");
    setDropoffPoint("");
    setNotes("");
  };

  const handleAdd = async () => {
    if (readOnly) return;
    const fullName = name.trim();
    if (!fullName) {
      inputRef.current?.focus();
      return;
    }
    try {
      setAdding(true);
      const payload = [{
        fullName,
        guardianName: guardianName.trim() || null,
        guardianPhone: guardianPhone.trim() || null,
        pickupPoint: pickupPoint.trim() || null,
        dropoffPoint: dropoffPoint.trim() || null,
        notes: notes.trim() || null,
      }];
      const created = await addTripPassengers(tripId, payload);
      setRoster((prev) => [...created, ...prev]);
      resetForm();
      inputRef.current?.focus();
      toast.success(`Added “${fullName}”`);
    } catch (err) {
      console.error("add passenger failed:", err);
      const msg = err?.response?.data?.error || err?.message || "Failed to add passengers";
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

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold">Passengers — Trip #{tripId}</h3>
      </div>

      {!readOnly && (
        <div className="mb-4 space-y-2">
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Full name"
              className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2
                ${adding || !name.trim() ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Guardian name"
                className="border border-gray-300 rounded px-3 py-2"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                disabled={adding}
              />
              <input
                type="tel"
                placeholder="Guardian phone"
                className="border border-gray-300 rounded px-3 py-2"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Pickup point"
                className="border border-gray-300 rounded px-3 py-2"
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Dropoff point"
                className="border border-gray-300 rounded px-3 py-2"
                value={dropoffPoint}
                onChange={(e) => setDropoffPoint(e.target.value)}
                disabled={adding}
              />
              <input
                type="text"
                placeholder="Notes"
                className="md:col-span-3 border border-gray-300 rounded px-3 py-2"
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
                <div className="truncate">{p.guardianName || "-"}</div>
                <div className="truncate">{p.guardianPhone || "-"}</div>
                <div>{p.checkedIn ? "Yes" : "No"}</div>
                <div className="truncate">
                  {p.pickupPoint || p.dropoffPoint || p.notes
                    ? [p.pickupPoint, p.dropoffPoint, p.notes].filter(Boolean).join(" • ")
                    : "-"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
