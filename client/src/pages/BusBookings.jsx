// client/src/pages/Bookings.jsx
import React, { useCallback, useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs";
import {
  listBookings,
  createBooking,
  updateBooking,
  deleteBooking,
} from "../services/bookingService";
import { useAuth } from "../context/AuthContext";

const EmptyRow = ({ children }) => (
  <div className="px-4 py-10 text-sm text-gray-500 text-center">{children}</div>
);

/* ---------------- Modal ---------------- */
function BookingModal({ open, onClose, onSave, context }) {
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [students, setStudents] = useState(0);
  const [adults, setAdults] = useState(0);
  const [pickup, setPickup] = useState([{ name: "", address: "", notes: "" }]);
  const [dropoff, setDropoff] = useState([{ name: "", address: "", notes: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDateStart("");
      setDateEnd("");
      setStudents(0);
      setAdults(0);
      setPickup([{ name: "", address: "", notes: "" }]);
      setDropoff([{ name: "", address: "", notes: "" }]);
      setNotes("");
    }
  }, [open]);

  const addRow = (setter) =>
    setter((a) => [...a, { name: "", address: "", notes: "" }]);
  const setField = (setter, i, key, v) =>
    setter((a) => a.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const rmRow = (setter, i) => setter((a) => a.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title || !dateStart || !dateEnd) {
      toast.error("Title, start and end are required.");
      return;
    }
    try {
      setSaving(true);
      await onSave({
        tenant_id: context.tenant_id,
        school_org_id: context.school_org_id,
        title,
        date_start: dateStart,
        date_end: dateEnd,
        passengers_students: Number(students || 0),
        passengers_adults: Number(adults || 0),
        pickup,
        dropoff,
        notes,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create booking.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-3xl mt-16 rounded shadow-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">New Bus Booking</h3>
          <button className="text-2xl" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Title</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Students</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              type="number"
              min="0"
              value={students}
              onChange={(e) => setStudents(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Adults</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              type="number"
              min="0"
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Start</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              type="datetime-local"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">End</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              type="datetime-local"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Pickups</h4>
            <button
              className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              onClick={() => addRow(setPickup)}
            >
              Add pickup
            </button>
          </div>
          {pickup.map((r, i) => (
            <div key={`p-${i}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder="Name (e.g., Main Gate)"
                value={r.name}
                onChange={(e) => setField(setPickup, i, "name", e.target.value)}
              />
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder="Address"
                value={r.address}
                onChange={(e) => setField(setPickup, i, "address", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  placeholder="Notes"
                  value={r.notes}
                  onChange={(e) => setField(setPickup, i, "notes", e.target.value)}
                />
                {pickup.length > 1 && (
                  <button
                    className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 text-xs"
                    onClick={() => rmRow(setPickup, i)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Drop-offs</h4>
            <button
              className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              onClick={() => addRow(setDropoff)}
            >
              Add drop-off
            </button>
          </div>
          {dropoff.map((r, i) => (
            <div key={`d-${i}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder="Name (e.g., Stadium)"
                value={r.name}
                onChange={(e) => setField(setDropoff, i, "name", e.target.value)}
              />
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder="Address"
                value={r.address}
                onChange={(e) => setField(setDropoff, i, "address", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  placeholder="Notes"
                  value={r.notes}
                  onChange={(e) => setField(setDropoff, i, "notes", e.target.value)}
                />
                {dropoff.length > 1 && (
                  <button
                    className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 text-xs"
                    onClick={() => rmRow(setDropoff, i)}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-sm">Notes</label>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-2 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Saving..." : "Create booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function Bookings() {
  const { profile } = useAuth();
  const context = {
    tenant_id: profile?.tenant_id || null,
    school_org_id: profile?.active_org_id || null,
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listBookings({
        tenant_id: context.tenant_id,
        school_org_id: context.school_org_id,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Could not load bookings.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [context.tenant_id, context.school_org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (payload) => {
    await createBooking(payload);
    toast.success("Booking created.");
    await load();
  };

  const setStatus = async (id, status) => {
    await updateBooking(id, { status });
    toast.success(`Marked ${status}.`);
    await load();
  };

  return (
    <div className="space-y-4">
      <ToastContainer position="top-center" autoClose={1800} hideProgressBar />
      <div>
        <div className="text-sm text-gray-500">Bookings</div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Bus Bookings</h1>

          {/* Header button */}
          <button
            className="px-3 py-2 rounded bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => setOpen(true)}
          >
            + New Booking
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage ad-hoc bus bookings (not tied to trips).
        </p>
      </div>

      <div className="bg-white rounded shadow border border-gray-100">
        <div className="grid grid-cols-7 px-4 py-2 text-sm font-medium bg-gray-50">
          <div>Title</div>
          <div>When</div>
          <div>Students</div>
          <div>Adults</div>
          <div>Status</div>
          <div>Created</div>
          <div>Action</div>
        </div>

        {loading ? (
          <EmptyRow>Loading...</EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow>No bookings yet.</EmptyRow>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-7 px-4 py-2 border-t text-sm items-center"
            >
              <div className="truncate">{r.title}</div>
              <div>
                {dayjs(r.date_start).format("MMM D, HH:mm")} →{" "}
                {dayjs(r.date_end).format("MMM D, HH:mm")}
              </div>
              <div>{r.passengers_students}</div>
              <div>{r.passengers_adults}</div>
              <div className="capitalize">{r.status}</div>
              <div>{dayjs(r.created_at).format("MMM D, YYYY")}</div>
              <div className="flex gap-2">
                {r.status !== "approved" && (
                  <button
                    className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-xs"
                    onClick={() => setStatus(r.id, "approved")}
                  >
                    Approve
                  </button>
                )}
                {r.status !== "cancelled" && (
                  <button
                    className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 text-xs"
                    onClick={() => setStatus(r.id, "cancelled")}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={onSave}
        context={context}
      />

      {/* Floating Action Button (always on top-right corner of viewport) */}
      <button
        className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700"
        onClick={() => setOpen(true)}
        aria-label="New Booking"
      >
        <span className="font-medium hidden sm:inline">New Booking</span>
        <span className="text-2xl leading-none">+</span>
      </button>
    </div>
  );
}
