// client/src/components/booking/BusBookingForm.jsx

import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { createBooking } from "../../services/bookingService";

const timeOpts = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);
const minOpts = ["00", "15", "30", "45"];

const Row = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
);

const StopEditor = ({ label, items, setItems }) => {
  const add = () => setItems((prev) => [...prev, { location: "", time: "" }]);
  const remove = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const update = (idx, key, val) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <button type="button" onClick={add} className="text-indigo-600 underline">
          + Add
        </button>
      </div>
      {items.length === 0 && <div className="text-xs text-gray-500">No stops added.</div>}
      <div className="space-y-2">
        {items.map((s, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <input
              className="md:col-span-7 border rounded px-3 py-2"
              placeholder="Location (e.g., Gate A, Sports Complex)"
              value={s.location}
              onChange={(e) => update(idx, "location", e.target.value)}
              required
            />
            <input
              className="md:col-span-4 border rounded px-3 py-2"
              placeholder="Time (e.g., 07:30 AM)"
              value={s.time}
              onChange={(e) => update(idx, "time", e.target.value)}
              required
            />
            <button
              type="button"
              className="md:col-span-1 text-red-600 underline"
              onClick={() => remove(idx)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function BusBookingForm({ onSuccess, onCancel }) {
  const { profile } = useAuth();

  const [form, setForm] = useState({
    title: "",
    purpose: "",
    date: "",
    startHour: "08",
    startMinute: "00",
    startAmPm: "AM",
    endDate: "",
    endHour: "03",
    endMinute: "30",
    endAmPm: "PM",
    durationMinutes: "",
    students: "",
    adults: "",
    busesRequested: "",
    busType: "",
    notes: "",
  });

  const [pickupPoints, setPickupPoints] = useState([]);
  const [dropoffPoints, setDropoffPoints] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [timeError, setTimeError] = useState("");

  const startISO = useMemo(() => {
    if (!form.date) return null;
    return new Date(
      `${form.date} ${form.startHour}:${form.startMinute} ${form.startAmPm}`
    );
  }, [form.date, form.startHour, form.startMinute, form.startAmPm]);

  const endISO = useMemo(() => {
    const d = form.endDate || form.date;
    if (!d) return null;
    return new Date(`${d} ${form.endHour}:${form.endMinute} ${form.endAmPm}`);
  }, [form.endDate, form.date, form.endHour, form.endMinute, form.endAmPm]);

  const validateTimes = () => {
    if (!startISO || !endISO) return true;
    if (endISO <= startISO) {
      setTimeError("End time must be later than start time.");
      return false;
    }
    setTimeError("");
    return true;
  };

  const set = (name, value) => setForm((s) => ({ ...s, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!validateTimes()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title || null,
        purpose: form.purpose || null,

        date: form.date || null,
        startTime: `${form.startHour}:${form.startMinute} ${form.startAmPm}`,
        endDate: (form.endDate || form.date) || null,
        endTime: `${form.endHour}:${form.endMinute} ${form.endAmPm}`,

        durationMinutes: form.durationMinutes
          ? Number(form.durationMinutes)
          : null,

        students: form.students ? Number(form.students) : 0,
        adults: form.adults ? Number(form.adults) : 0,

        pickupPoints,
        dropoffPoints,

        busesRequested: form.busesRequested
          ? Number(form.busesRequested)
          : null,
        busType: form.busType || null,
        notes: form.notes || null,

        createdBy: profile?.name,
        createdByEmail: profile?.email,
        createdById: profile?.id ?? null,
        status: "Requested",
      };

      await createBooking(payload);
      toast.success("Booking submitted!");

      // Reset
      setForm({
        title: "",
        purpose: "",
        date: "",
        startHour: "08",
        startMinute: "00",
        startAmPm: "AM",
        endDate: "",
        endHour: "03",
        endMinute: "30",
        endAmPm: "PM",
        durationMinutes: "",
        students: "",
        adults: "",
        busesRequested: "",
        busType: "",
        notes: "",
      });
      setPickupPoints([]);
      setDropoffPoints([]);

      onSuccess && onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <h3 className="text-xl font-semibold">Request Bus Booking</h3>

      <Row>
        <div>
          <label className="block text-sm font-medium">Title (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g., Museum Visit Shuttle"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Purpose (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.purpose}
            onChange={(e) => set("purpose", e.target.value)}
            placeholder="What is this booking for?"
          />
        </div>
      </Row>

      <Row>
        <div>
          <label className="block text-sm font-medium">Date *</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Start Time *</label>
          <div className="flex gap-2">
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.startHour}
              onChange={(e) => set("startHour", e.target.value)}
            >
              {timeOpts.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.startMinute}
              onChange={(e) => set("startMinute", e.target.value)}
            >
              {minOpts.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.startAmPm}
              onChange={(e) => set("startAmPm", e.target.value)}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
        </div>
      </Row>

      <Row>
        <div>
          <label className="block text-sm font-medium">End Date *</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={form.endDate || form.date}
            onChange={(e) => set("endDate", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">End Time *</label>
          <div className="flex gap-2">
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.endHour}
              onChange={(e) => set("endHour", e.target.value)}
            >
              {timeOpts.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.endMinute}
              onChange={(e) => set("endMinute", e.target.value)}
            >
              {minOpts.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-2 w-1/3 text-center"
              value={form.endAmPm}
              onChange={(e) => set("endAmPm", e.target.value)}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
          {timeError && (
            <p className="text-red-500 text-sm mt-1">{timeError}</p>
          )}
        </div>
      </Row>

      <Row>
        <div>
          <label className="block text-sm font-medium">
            Duration (minutes, optional)
          </label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={form.durationMinutes}
            onChange={(e) => set("durationMinutes", e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="e.g., 240"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium">Students *</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={form.students}
              onChange={(e) => set("students", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Adults *</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={form.adults}
              onChange={(e) => set("adults", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              required
            />
          </div>
        </div>
      </Row>

      <StopEditor
        label="Pickup Points (location & time)"
        items={pickupPoints}
        setItems={setPickupPoints}
      />
      <StopEditor
        label="Drop-off Points (location & time)"
        items={dropoffPoints}
        setItems={setDropoffPoints}
      />

      <Row>
        <div>
          <label className="block text-sm font-medium">
            Buses Requested (optional)
          </label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={form.busesRequested}
            onChange={(e) => set("busesRequested", e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="e.g., 2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Preferred Bus Type (optional)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.busType}
            onChange={(e) => set("busType", e.target.value)}
            placeholder="e.g., 50-seater AC"
          />
        </div>
      </Row>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          className="w-full border rounded px-3 py-2"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 flex items-center justify-center min-w-[140px]"
        >
          {submitting ? (
            <span className="animate-pulse">Submitting…</span>
          ) : (
            "Submit Booking"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
