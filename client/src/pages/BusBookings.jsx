// client/src/pages/BusBookings.jsx
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

function BookingModal({ open, onClose, onSave, context }) {
  /* … keep your existing modal implementation unchanged … */
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

      {/* Header (single, de-duplicated) */}
      <header className="mb-2">
        <div className="text-xs text-gray-500">
          School Trips <span className="mx-1">/</span>
          <span className="text-gray-700">Bus Bookings</span>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Bus Bookings</h1>
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
      </header>

      {/* Table */}
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

      {/* Single modal trigger lives in the header above */}
      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={onSave}
        context={context}
      />
    </div>
  );
}
