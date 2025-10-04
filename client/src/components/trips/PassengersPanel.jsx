import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  getTripPassengers,
  addTripPassengers,
  // Optional: if you later add a PATCH endpoint
  // updateTripPassenger,
} from "../../services/tripService";

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

/**
 * Columns shown by default:
 * - Name
 * - Guardian (name & phone)
 * - Checked-in
 *
 * Expandable "Details" per row:
 * - Pickup, Dropoff, Payment, Notes
 */
export default function PassengersPanel({ trip, readOnly = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  // add form
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [dropoffPoint, setDropoffPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState(""); // "", "paid", "due", "refunded" etc.

  // UI state for row expansions
  const [openRows, setOpenRows] = useState(() => new Set());

  const inputRef = useRef(null);
  const tripId = useMemo(() => trip?.id, [trip]);

  // Load roster
  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await getTripPassengers(tripId);
        if (mounted) setRoster(rows || []);
      } catch (err) {
        console.error("load passengers failed:", err);
        toast.error("Could not load passengers.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tripId]);

  const clearAddForm = () => {
    setNameInput("");
    setGuardianName("");
    setGuardianPhone("");
    setPickupPoint("");
    setDropoffPoint("");
    setNotes("");
    setPayment("");
  };

  const handleAdd = async () => {
    if (readOnly) return;
    const fullName = nameInput.trim();
    if (!fullName) {
      inputRef.current?.focus();
      return;
    }

    const payload = {
      fullName,
      guardianName: guardianName.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      pickupPoint: pickupPoint.trim() || undefined,
      dropoffPoint: dropoffPoint.trim() || undefined,
      notes: notes.trim() || undefined,
      latestPaymentStatus: payment || undefined,
      checkedIn: false,
    };

    try {
      setAdding(true);
      const created = await addTripPassengers(tripId, [payload], true);
      setRoster((prev) => [...created, ...prev]);
      clearAddForm();
      toast.success(`Added “${fullName}”`);
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
    if (e.key === "Enter") {
      e.preventDefault();
      if (!adding && !readOnly) handleAdd();
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

  // If later you add an update endpoint, you can enable this handler
  // const toggleCheckedIn = async (row) => {
  //   if (readOnly) return;
  //   const next = !row.checkedIn;
  //   try {
  //     setRoster((prev) => prev.map((r) => (r.id === row.id ? { ...r, checkedIn: next } : r)));
  //     await updateTripPassenger(row.id, { checkedIn: next });
  //   } catch (e) {
  //     // revert if failed
  //     setRoster((prev) => prev.map((r) => (r.id === row.id ? { ...r, checkedIn: !next } : r)));
  //     toast.error("Failed to update check-in status.");
  //   }
  // };

  return (
    <div className="w-full max-w-3xl">
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
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={adding}
            />

            <button
              onClick={handleAdd}
              disabled={adding || !nameInput.trim()}
              className={`px-4 py-2 rounded text-white flex items-center justify-center gap-2
                ${adding || !nameInput.trim()
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {adding ? <Spinner /> : null}
              <span>{adding ? "Adding…" : "Add"}</span>
            </button>
          </div>

          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? "Hide extra fields" : "More fields (guardian, pickup/dropoff, notes, payment)"}
          </button>

          {showMore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded p-3 bg-gray-50">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Guardian name (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Guardian phone (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Pickup (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={pickupPoint}
                  onChange={(e) => setPickupPoint(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dropoff (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={dropoffPoint}
                  onChange={(e) => setDropoffPoint(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Payment status (optional)</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table head */}
      <div className="border rounded">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 text-sm font-semibold bg-gray-50">
          <div>Name</div>
          <div>Guardian</div>
          <div>Phone</div>
          <div>Checked-in</div>
          <div className="text-right pr-2">Details</div>
        </div>

        {/* Body */}
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
                <li key={p.id} className="px-3 py-2">
                  {/* main row */}
                  <div className="grid grid-cols-5 gap-2 items-center">
                    <div className="truncate">{p.fullName}</div>
                    <div className="truncate">{p.guardianName || "-"}</div>
                    <div className="truncate">{p.guardianPhone || "-"}</div>

                    <div className="truncate">
                      {/* If you later wire PATCH, turn this into a checkbox and call update */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          p.checkedIn ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                        }`}
                        title={p.checkedIn ? "Checked in" : "Not checked in"}
                      >
                        {p.checkedIn ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className="text-right">
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => toggleRow(p.id)}
                        type="button"
                      >
                        {isOpen ? "Hide" : "Show"} details
                      </button>
                    </div>
                  </div>

                  {/* expandable details */}
                  {isOpen && (
                    <div className="mt-2 rounded border bg-gray-50 p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-gray-500 text-xs">Pickup</div>
                        <div>{p.pickupPoint || "-"}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Dropoff</div>
                        <div>{p.dropoffPoint || "-"}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Payment</div>
                        <div>{p.latestPaymentStatus || "-"}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-gray-500 text-xs">Notes</div>
                        <div className="whitespace-pre-wrap">{p.notes || "-"}</div>
                      </div>
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
