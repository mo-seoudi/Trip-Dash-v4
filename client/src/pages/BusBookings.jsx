// client/src/pages/Bookings.jsx
import React, { useCallback, useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs";
import {
  listBookings,
  createBooking,
  updateBooking,
} from "../services/bookingService";
import { useAuth } from "../context/AuthContext";
import BusBookingForm from "../components/booking/BusBookingForm";

const EmptyRow = ({ children }) => (
  <div className="px-4 py-10 text-sm text-gray-500 text-center">{children}</div>
);

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-3xl mt-16 rounded-2xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-2xl leading-none" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

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
    setOpen(false);
    await load();
  };

  const setStatus = async (id, status) => {
    await updateBooking(id, { status });
    toast.success(`Marked ${status}.`);
    await load();
  };

  return (
    <div className="space-y-5">
      <ToastContainer position="top-center" autoClose={1800} hideProgressBar />

      {/* Header */}
      <div>
        <div className="text-sm text-gray-500">Bookings</div>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Bus Bookings</h1>
          <button
            className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
            onClick={() => setOpen(true)}
          >
            + New Booking
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage ad-hoc bus bookings (not tied to trips).
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
          <EmptyRow>Loading…</EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow>No bookings yet.</EmptyRow>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-7 px-4 py-2 border-t text-sm items-center"
            >
              <div className="truncate">{r.title || "—"}</div>
              <div>
                {r.date_start
                  ? `${dayjs(r.date_start).format("MMM D, HH:mm")} → ${dayjs(
                      r.date_end
                    ).format("MMM D, HH:mm")}`
                  : r.date
                  ? `${r.date} ${r.startTime} → ${r.endDate} ${r.endTime}`
                  : "—"}
              </div>
              <div>{r.passengers_students ?? r.students ?? 0}</div>
              <div>{r.passengers_adults ?? r.adults ?? 0}</div>
              <div className="capitalize">{r.status || "requested"}</div>
              <div>
                {r.created_at
                  ? dayjs(r.created_at).format("MMM D, YYYY")
                  : r.createdAt
                  ? dayjs(r.createdAt).format("MMM D, YYYY")
                  : "—"}
              </div>
              <div className="flex gap-2">
                {r.status !== "approved" && (
                  <button
                    className="px-2 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs"
                    onClick={() => setStatus(r.id, "approved")}
                  >
                    Approve
                  </button>
                )}
                {r.status !== "cancelled" && (
                  <button
                    className="px-2 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs"
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

      {/* Single modal (no floating FAB) */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Bus Booking">
        <BusBookingForm
          onSuccess={() => onSave}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </div>
  );
}
