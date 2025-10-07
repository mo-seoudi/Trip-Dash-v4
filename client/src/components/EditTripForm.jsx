// client/src/components/EditTripForm.jsx
import React from "react";
import ModalWrapper from "./ModalWrapper";
import { updateTrip, requestTripEdit } from "../services/tripService";
import { toast } from "react-toastify";

const toInputDate = (d) =>
  !d ? "" : typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);

export default function EditTripForm({
  trip,
  onClose,
  onUpdated,
  isRequestMode = false, // when true (e.g., school_staff editing Confirmed), send a request instead of immediate PATCH
}) {
  const [form, setForm] = React.useState(() => ({
    tripType: trip?.tripType || "Other",
    customType: trip?.customType || "",
    destination: trip?.destination || "",
    date: trip?.date || null,
    returnDate: trip?.returnDate || null,
    departureTime: trip?.departureTime || "",
    returnTime: trip?.returnTime || "",
    students: trip?.students || 0,
    notes: trip?.notes || "",
    boosterSeats: trip?.boosterSeats || 0,
  }));
  const [saving, setSaving] = React.useState(false);

  const onChange = (key) => (e) => {
    const value = e?.target?.type === "number" ? Number(e.target.value) : e?.target?.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const patch = { ...form };
      let updated;
      if (isRequestMode) {
        updated = await requestTripEdit(trip.id, patch);
        toast.success("Edit request sent to bus company.");
      } else {
        updated = await updateTrip(trip.id, patch);
        toast.success("Trip updated.");
      }
      onUpdated?.(updated);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error(isRequestMode ? "Failed to send edit request" : "Failed to update trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={isRequestMode ? "Request Edit" : "Edit Trip"} onClose={onClose} maxWidth="max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Trip Type</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={form.tripType}
            onChange={onChange("tripType")}
          >
            <option>Other</option>
            <option>Educational</option>
            <option>Sports</option>
            <option>Recreational</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Custom Type</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.customType}
            onChange={onChange("customType")}
            placeholder="If Trip Type is Other"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Destination</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.destination}
            onChange={onChange("destination")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Departure Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={toInputDate(form.date)}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Return Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={toInputDate(form.returnDate)}
            onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Departure Time</label>
          <input
            type="time"
            className="w-full border rounded px-3 py-2"
            value={form.departureTime || ""}
            onChange={onChange("departureTime")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Return Time</label>
          <input
            type="time"
            className="w-full border rounded px-3 py-2"
            value={form.returnTime || ""}
            onChange={onChange("returnTime")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Students</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={form.students}
            onChange={onChange("students")}
            min={0}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Booster Seats</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={form.boosterSeats}
            onChange={onChange("boosterSeats")}
            min={0}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            rows={3}
            className="w-full border rounded px-3 py-2"
            value={form.notes || ""}
            onChange={onChange("notes")}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {saving ? (isRequestMode ? "Sending…" : "Saving…") : (isRequestMode ? "Send Request" : "Save")}
        </button>
      </div>
    </ModalWrapper>
  );
}
