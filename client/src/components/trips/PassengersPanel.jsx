// client/src/components/trips/PassengersPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getTripPassengers, addTripPassengers } from "../../services/tripService";
import api from "../../services/apiClient";

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

function RowField({ label, value, onChange, placeholder = "", readOnly = false }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-28 shrink-0 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <input
        className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={readOnly}
      />
    </div>
  );
}

/**
 * Pass `readOnly` to control edit capability:
 * - readOnly = true  -> hide Add row & disable edits (view-only)
 * - readOnly = false -> allow adding passengers and editing row details
 */
export default function PassengersPanel({ trip, readOnly = false }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [expanded, setExpanded] = useState({}); // {id: true}
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
        if (mounted) setRoster(rows);
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

  // --- mutations -------------------------------------------------------------

  const patchRow = async (rowId, data) => {
    const res = await api.patch(`/trips/${tripId}/passengers/${rowId}`, data);
    return res.data;
  };

  const handleToggleCheckedIn = async (row) => {
    if (readOnly) return;
    try {
      const next = await patchRow(row.id, { checkedIn: !row.checkedIn });
      setRoster((r) => r.map((p) => (p.id === row.id ? next : p)));
    } catch (e) {
      console.error(e);
      toast.error("Couldn’t update check-in.");
    }
  };

  const handleSaveRow = async (row, draft) => {
    try {
      const next = await patchRow(row.id, draft);
      setRoster((r) => r.map((p) => (p.id === row.id ? next : p)));
      toast.success("Saved");
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    }
  };

  const handleAdd = async () => {
    if (readOnly) return;
    const fullName = nameInput.trim();
    if (!fullName) {
      inputRef.current?.focus();
      return;
    }
    try {
      setAdding(true);
      const created = await addTripPassengers(tripId, [{ fullName }], true);
      // API returns the created rows (array). Prepend them.
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

  const handleKeyDownAdd = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!adding && !readOnly) handleAdd();
    }
  };

  // --- UI --------------------------------------------------------------------

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 pr-12">
        <h3 className="text-lg font-semibold">Passengers — Trip #{tripId}</h3>
      </div>

      {/* Add new (hidden in read-only) */}
      {!readOnly && (
        <div className="mb-3">
          <div className="flex w-full items-stretch gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a passenger's name"
              className="flex-1 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleKeyDownAdd}
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
        </div>
      )}

      {/* Table header */}
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm font-semibold bg-gray-50">
          <div className="col-span-6 sm:col-span-5">Name</div>
          <div className="hidden sm:block sm:col-span-5">Guardian Contact</div>
          <div className="col-span-3 sm:col-span-1 text-center">Checked</div>
          <div className="col-span-3 sm:col-span-1 text-right">More</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-6 text-gray-500">
            <Spinner className="w-5 h-5" />
            Loading passengers…
          </div>
        ) : roster.length === 0 ? (
          <div className="px-3 py-6 text-gray-500 text-sm">No passengers yet.</div>
        ) : (
          <ul className="divide-y">
            {roster.map((row) => {
              const isOpen = !!expanded[row.id];
              const [draft, setDraft] = useState({
                guardianName: row.guardianName || "",
                guardianPhone: row.guardianPhone || "",
                pickupPoint: row.pickupPoint || "",
                dropoffPoint: row.dropoffPoint || "",
                notes: row.notes || "",
              });

              // keep draft in sync if server pushes a new row
              useEffect(() => {
                setDraft({
                  guardianName: row.guardianName || "",
                  guardianPhone: row.guardianPhone || "",
                  pickupPoint: row.pickupPoint || "",
                  dropoffPoint: row.dropoffPoint || "",
                  notes: row.notes || "",
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [row.id, row.guardianName, row.guardianPhone, row.pickupPoint, row.dropoffPoint, row.notes]);

              return (
                <li key={row.id} className="text-sm">
                  {/* Compact row */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <div className="font-medium truncate">{row.fullName}</div>
                      {/* On small screens show guardian below the name */}
                      <div className="sm:hidden text-gray-500 truncate">
                        {row.guardianName || row.guardianPhone
                          ? [row.guardianName, row.guardianPhone].filter(Boolean).join(" • ")
                          : "—"}
                      </div>
                    </div>

                    <div className="hidden sm:block sm:col-span-5 text-gray-600 truncate">
                      {row.guardianName || row.guardianPhone
                        ? [row.guardianName, row.guardianPhone].filter(Boolean).join(" • ")
                        : "—"}
                    </div>

                    <div className="col-span-3 sm:col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!row.checkedIn}
                        onChange={() => handleToggleCheckedIn(row)}
                        disabled={readOnly}
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-1 flex justify-end">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => setExpanded((m) => ({ ...m, [row.id]: !isOpen }))}
                      >
                        {isOpen ? "Hide" : "Details"}
                      </button>
                    </div>
                  </div>

                  {/* Expandable details */}
                  {isOpen && (
                    <div className="bg-gray-50/60 px-3 py-3 border-t">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <RowField
                          label="Guardian name"
                          value={draft.guardianName}
                          onChange={(v) => setDraft((d) => ({ ...d, guardianName: v }))}
                          readOnly={readOnly}
                        />
                        <RowField
                          label="Guardian phone"
                          value={draft.guardianPhone}
                          onChange={(v) => setDraft((d) => ({ ...d, guardianPhone: v }))}
                          placeholder="+971…"
                          readOnly={readOnly}
                        />
                        <RowField
                          label="Pickup (opt.)"
                          value={draft.pickupPoint}
                          onChange={(v) => setDraft((d) => ({ ...d, pickupPoint: v }))}
                          readOnly={readOnly}
                        />
                        <RowField
                          label="Dropoff (opt.)"
                          value={draft.dropoffPoint}
                          onChange={(v) => setDraft((d) => ({ ...d, dropoffPoint: v }))}
                          readOnly={readOnly}
                        />
                        <div className="sm:col-span-2">
                          <RowField
                            label="Notes (opt.)"
                            value={draft.notes}
                            onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
                            readOnly={readOnly}
                          />
                        </div>

                        {/* Payment summary (read-only if you don't want to surface amounts yet) */}
                        <div className="sm:col-span-2 text-xs text-gray-600">
                          <span className="uppercase tracking-wide mr-2">Payment</span>
                          <span className="rounded bg-gray-200 px-2 py-0.5">
                            {row.latestPaymentStatus || "N/A"}
                          </span>
                        </div>
                      </div>

                      {!readOnly && (
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            className="px-3 py-1.5 rounded border"
                            onClick={() =>
                              setDraft({
                                guardianName: row.guardianName || "",
                                guardianPhone: row.guardianPhone || "",
                                pickupPoint: row.pickupPoint || "",
                                dropoffPoint: row.dropoffPoint || "",
                                notes: row.notes || "",
                              })
                            }
                          >
                            Reset
                          </button>
                          <button
                            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => handleSaveRow(row, draft)}
                          >
                            Save
                          </button>
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
