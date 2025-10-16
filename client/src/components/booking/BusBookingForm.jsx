// client/src/components/booking/BusBookingForm.jsx

import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { createBooking } from "../../services/bookingService";

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const mins = ["00", "15", "30", "45"];

const Field = ({ label, required, children, hint }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-800">
      {label} {required && <span className="text-rose-600">*</span>}
    </span>
    <div className="mt-1">{children}</div>
    {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </label>
);

const Card = ({ title, action, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      {action}
    </div>
    {children}
  </div>
);

const StopRow = ({ value, onChange, onRemove, canRemove }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
    <input
      className="md:col-span-5 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      placeholder="Name (e.g., Main Gate)"
      value={value.location}
      onChange={(e) => onChange({ ...value, location: e.target.value })}
      required
    />
    <input
      className="md:col-span-5 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      placeholder="Address / Extra notes (optional)"
      value={value.address || ""}
      onChange={(e) => onChange({ ...value, address: e.target.value })}
    />
    <input
      className="md:col-span-2 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      placeholder="Time (07:30 AM)"
      value={value.time}
      onChange={(e) => onChange({ ...value, time: e.target.value })}
      required
    />
    {canRemove && (
      <div className="md:col-span-12 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
        >
          Remove
        </button>
      </div>
    )}
  </div>
);

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

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const startISO = useMemo(() => {
    if (!form.date) return null;
    return new Date(`${form.date} ${form.startHour}:${form.startMinute} ${form.startAmPm}`);
  }, [form.date, form.startHour, form.startMinute, form.startAmPm]);

  const endISO = useMemo(() => {
    const d = form.endDate || form.date;
    if (!d) return null;
    return new Date(`${d} ${form.endHour}:${form.endMinute} ${form.endAmPm}`);
  }, [form.endDate, form.date, form.endHour, form.endMinute, form.endAmPm]);

  const validateTimes = () => {
    if (!startISO || !endISO) return true;
    if (endISO <= startISO) {
      setTimeError("End must be after Start.");
      return false;
    }
    setTimeError("");
    return true;
  };

  const reset = () => {
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
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validateTimes()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title || null,
        purpose: form.purpose || null,

        // backend expects date/startTime/endDate/endTime – keep as-is
        date: form.date || null,
        startTime: `${form.startHour}:${form.startMinute} ${form.startAmPm}`,
        endDate: (form.endDate || form.date) || null,
        endTime: `${form.endHour}:${form.endMinute} ${form.endAmPm}`,

        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        students: form.students ? Number(form.students) : 0,
        adults: form.adults ? Number(form.adults) : 0,

        pickupPoints,
        dropoffPoints,

        busesRequested: form.busesRequested ? Number(form.busesRequested) : null,
        busType: form.busType || null,
        notes: form.notes || null,

        createdBy: profile?.name,
        createdByEmail: profile?.email,
        createdById: profile?.id ?? null,
        status: "Requested",
      };

      await createBooking(payload);
      toast.success("Booking submitted!");
      reset();
      onSuccess && onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-1">
      {/* Details */}
      <Card title="Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Title" hint="A short name you’ll recognize later">
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g., Museum Shuttle"
            />
          </Field>

          <Field label="Purpose">
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="What is this booking for?"
            />
          </Field>
        </div>
      </Card>

      {/* Schedule (Start & End side-by-side, symmetrical) */}
      <Card title="Schedule">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Start */}
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 text-sm font-semibold text-gray-800">Start</div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <Field label="Date" required>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="col-span-6">
                <Field label="Time" required>
                  <div className="flex gap-2">
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.startHour}
                      onChange={(e) => set("startHour", e.target.value)}
                    >
                      {hours.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.startMinute}
                      onChange={(e) => set("startMinute", e.target.value)}
                    >
                      {mins.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.startAmPm}
                      onChange={(e) => set("startAmPm", e.target.value)}
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* End */}
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 text-sm font-semibold text-gray-800">End</div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <Field label="Date" required>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.endDate || form.date}
                    onChange={(e) => set("endDate", e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="col-span-6">
                <Field label="Time" required>
                  <div className="flex gap-2">
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.endHour}
                      onChange={(e) => set("endHour", e.target.value)}
                    >
                      {hours.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.endMinute}
                      onChange={(e) => set("endMinute", e.target.value)}
                    >
                      {mins.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      className="border rounded-lg px-2 py-2 w-1/3 text-center"
                      value={form.endAmPm}
                      onChange={(e) => set("endAmPm", e.target.value)}
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </Field>
              </div>
            </div>

            {timeError && <p className="mt-2 text-sm text-rose-600">{timeError}</p>}
          </div>
        </div>

        {/* Optional duration */}
        <div className="mt-3 max-w-xs">
          <Field label="Duration (minutes)" hint="Optional; used for quick estimates">
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={form.durationMinutes}
              onChange={(e) => set("durationMinutes", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="e.g., 240"
            />
          </Field>
        </div>
      </Card>

      {/* Passengers */}
      <Card title="Passengers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Students" required>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={form.students}
              onChange={(e) => set("students", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              min="0"
              required
            />
          </Field>
          <Field label="Adults" required>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={form.adults}
              onChange={(e) => set("adults", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              min="0"
              required
            />
          </Field>
        </div>
      </Card>

      {/* Stops */}
      <Card
        title="Pickup Points"
        action={
          <button
            type="button"
            onClick={() => setPickupPoints((p) => [...p, { location: "", address: "", time: "" }])}
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add pickup
          </button>
        }
      >
        <div className="space-y-3">
          {pickupPoints.length === 0 && (
            <div className="text-xs text-gray-500">No pickups added.</div>
          )}
          {pickupPoints.map((row, idx) => (
            <StopRow
              key={`p-${idx}`}
              value={row}
              onChange={(val) => {
                setPickupPoints((prev) => prev.map((r, i) => (i === idx ? val : r)));
              }}
              onRemove={() =>
                setPickupPoints((prev) => prev.filter((_, i) => i !== idx))
              }
              canRemove={pickupPoints.length > 0}
            />
          ))}
        </div>
      </Card>

      <Card
        title="Drop-off Points"
        action={
          <button
            type="button"
            onClick={() => setDropoffPoints((p) => [...p, { location: "", address: "", time: "" }])}
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add drop-off
          </button>
        }
      >
        <div className="space-y-3">
          {dropoffPoints.length === 0 && (
            <div className="text-xs text-gray-500">No drop-offs added.</div>
          )}
          {dropoffPoints.map((row, idx) => (
            <StopRow
              key={`d-${idx}`}
              value={row}
              onChange={(val) => {
                setDropoffPoints((prev) => prev.map((r, i) => (i === idx ? val : r)));
              }}
              onRemove={() =>
                setDropoffPoints((prev) => prev.filter((_, i) => i !== idx))
              }
              canRemove={dropoffPoints.length > 0}
            />
          ))}
        </div>
      </Card>

      {/* Preferences */}
      <Card title="Preferences">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Buses Requested">
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={form.busesRequested}
              onChange={(e) => set("busesRequested", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              min="0"
              placeholder="e.g., 2"
            />
          </Field>
          <Field label="Preferred Bus Type">
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.busType}
              onChange={(e) => set("busType", e.target.value)}
              placeholder="e.g., 50-seater AC"
            />
          </Field>
          <div className="md:col-span-3">
            <Field label="Notes">
              <textarea
                className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-w-[160px] bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Booking"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

