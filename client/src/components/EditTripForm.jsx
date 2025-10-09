// client/src/components/EditTripForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { updateTrip } from "../services/tripService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const EditTripForm = ({ trip, onClose, onUpdated, isRequestMode }) => {
  // Helpers
  const toDateInput = (val) => {
    if (!val) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return { hour: "08", minute: "00", ampm: "AM" };
    const [time, ampm] = timeStr.split(" ");
    const [hour, minute] = (time || "08:00").split(":");
    return {
      hour: hour?.padStart(2, "0") || "08",
      minute: minute?.padStart(2, "0") || "00",
      ampm: (ampm || "AM").toUpperCase(),
    };
  };

  const buildNotes = (notesText, boosterRequested, boosterCountRaw) => {
    const count = Number(boosterCountRaw) || 0;
    const boosterPart = boosterRequested
      ? count > 0
        ? `Booster seats: ${count}`
        : `Booster seats requested`
      : "";
    return [boosterPart, (notesText || "").trim()].filter(Boolean).join(" - ");
  };

  // Form state
  const dep = parseTime(trip.departureTime);
  const ret = parseTime(trip.returnTime);

  const [formData, setFormData] = useState({
    tripType: trip.tripType,
    customType: trip.customType || "",
    destination: trip.destination || "",
    date: toDateInput(trip.date),
    departureHour: dep.hour,
    departureMinute: dep.minute,
    departureAmPm: dep.ampm,
    returnDate: toDateInput(trip.returnDate) || toDateInput(trip.date),
    returnHour: ret.hour,
    returnMinute: ret.minute,
    returnAmPm: ret.ampm,
    students: trip.students,
    staff: trip.staff ?? "",                 // NEW
    notes: trip.notes || "",
    boosterSeatsRequested: !!trip.boosterSeatsRequested,
    boosterSeatCount: trip.boosterSeatCount || "",
  });

  const [timeError, setTimeError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Keep times synced (existing behavior)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      returnHour: prev.departureHour,
      returnMinute: prev.departureMinute,
      returnAmPm: prev.departureAmPm,
    }));
  }, [formData.departureHour, formData.departureMinute, formData.departureAmPm]); // eslint-disable-line

  // Keep return date synced if it matched previous
  const prevDateRef = useRef(formData.date);
  useEffect(() => {
    setFormData((prev) => {
      if (!prev.returnDate || prev.returnDate === prevDateRef.current) {
        return { ...prev, returnDate: prev.date };
      }
      return prev;
    });
    prevDateRef.current = formData.date;
  }, [formData.date]);

  // ESC close
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === "Escape" || e.key === "Esc") && !e.isComposing) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateTimes = () => {
    const depDate = new Date(
      `${formData.date} ${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`
    );
    const retDate = new Date(
      `${formData.returnDate} ${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`
    );
    if (retDate <= depDate) {
      setTimeError("Return time must be later than departure time.");
      return false;
    }
    setTimeError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateTimes()) return;

    setSubmitting(true);
    try {
      const departureTime = `${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`;
      const returnTime = `${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`;

      const payload = {
        tripType:
          formData.tripType === "Other" ? formData.customType : formData.tripType,
        customType: formData.customType,
        destination: formData.destination,
        date: formData.date,
        departureTime,
        returnDate: formData.returnDate,
        returnTime,
        students: Number(formData.students),
        staff: formData.staff === "" ? null : Number(formData.staff),   // NEW
        notes: buildNotes(
          formData.notes,
          formData.boosterSeatsRequested,
          formData.boosterSeatCount
        ),
        boosterSeatsRequested: formData.boosterSeatsRequested,
        boosterSeatCount: formData.boosterSeatsRequested
          ? Number(formData.boosterSeatCount)
          : 0,
      };

      if (isRequestMode) {
        await updateTrip(trip.id, { ...payload, status: "Pending", editRequest: true });
        toast.success("Edit request sent. Awaiting bus officer approval.");
      } else {
        await updateTrip(trip.id, payload);
        toast.success("Trip updated successfully!");
      }

      onUpdated?.();
      onClose?.();
    } catch (error) {
      console.error("Failed to update trip:", error);
      toast.error("Failed to update trip. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCancel = async () => {
    const confirm = window.confirm(
      "Are you sure you want to request to cancel this trip?"
    );
    if (!confirm) return;
    try {
      await updateTrip(trip.id, { status: "Pending", cancelRequest: true });
      toast.success("Cancel request sent. Awaiting bus officer approval.");
      onUpdated?.();
      onClose?.();
    } catch (error) {
      console.error("Failed to request cancellation:", error);
      toast.error("Failed to request cancellation.");
    }
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  );
  const minuteOptions = ["00", "15", "30", "45"];
  const tripTypeOptions = [
    "Academic Trip",
    "Boarding House Trip",
    "Day Trip",
    "Sports Trip",
    "Other",
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-xl max-h-screen overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl"
        >
          &times;
        </button>

        <h3 className="text-xl font-semibold mb-4">
          {isRequestMode ? "Edit Trip Request" : "Edit Trip"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trip type */}
          <div>
            <label className="block text-sm font-medium">Trip Type *</label>
            <select
              name="tripType"
              value={formData.tripType}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            >
              {tripTypeOptions.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {formData.tripType === "Other" && (
              <input
                type="text"
                name="customType"
                placeholder="Enter custom trip type"
                value={formData.customType}
                onChange={handleChange}
                className="w-full p-2 border rounded mt-2"
                required
              />
            )}
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium">Destination *</label>
            <input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          {/* Departure */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium">Departure Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded h-10"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium">Departure Time *</label>
              <div className="flex gap-1">
                <select
                  name="departureHour"
                  value={formData.departureHour}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  {hourOptions.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
                <select
                  name="departureMinute"
                  value={formData.departureMinute}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  {minuteOptions.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <select
                  name="departureAmPm"
                  value={formData.departureAmPm}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  <option>AM</option>
                  <option>PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Return */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium">Return Date *</label>
              <input
                type="date"
                name="returnDate"
                value={formData.returnDate}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded h-10"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium">Return Time *</label>
              <div className="flex gap-1">
                <select
                  name="returnHour"
                  value={formData.returnHour}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  {hourOptions.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
                <select
                  name="returnMinute"
                  value={formData.returnMinute}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  {minuteOptions.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <select
                  name="returnAmPm"
                  value={formData.returnAmPm}
                  onChange={handleChange}
                  className="w-1/3 p-2 border rounded h-10 text-center"
                >
                  <option>AM</option>
                  <option>PM</option>
                </select>
              </div>
              {timeError && <p className="text-red-500 text-sm mt-1">{timeError}</p>}
            </div>
          </div>

          {/* Students */}
          <div>
            <label className="block text-sm font-medium">Number of Students *</label>
            <input
              type="number"
              name="students"
              value={formData.students}
              onChange={handleChange}
              onWheel={(e) => e.target.blur()}
              required
              className="w-full p-2 border rounded"
            />
          </div>

          {/* NEW: Staff */}
          <div>
            <label className="block text-sm font-medium">Number of Staff</label>
            <input
              type="number"
              name="staff"
              value={formData.staff}
              onChange={handleChange}
              onWheel={(e) => e.target.blur()}
              className="w-full p-2 border rounded"
              placeholder="e.g., 4"
              min="0"
            />
          </div>

          {/* Booster seats */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="boosterCheckbox"
              name="boosterSeatsRequested"
              checked={formData.boosterSeatsRequested}
              onChange={handleChange}
            />
            <label htmlFor="boosterCheckbox" className="text-sm">
              Request Booster Seats
            </label>
          </div>

          {formData.boosterSeatsRequested && (
            <input
              type="number"
              name="boosterSeatCount"
              placeholder="Number of Booster Seats"
              value={formData.boosterSeatCount}
              onChange={handleChange}
              onWheel={(e) => e.target.blur()}
              className="w-full p-2 border rounded"
              min="0"
            />
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium">Additional Notes</label>
            <textarea
              name="notes"
              placeholder="Additional notes (optional)"
              value={formData.notes}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex-1"
            >
              {isRequestMode ? "Request Edit" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 flex-1"
            >
              Ignore Changes
            </button>
          </div>

          {/* Cancel buttons */}
          {isRequestMode ? (
            <button
              type="button"
              onClick={handleRequestCancel}
              className="bg-red-600 text-white w-full px-4 py-3 rounded hover:bg-red-700 mt-2"
            >
              Request Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRequestCancel}
              className="bg-red-600 text-white w-full px-4 py-3 rounded hover:bg-red-700 mt-2"
            >
              Cancel Trip
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default EditTripForm;
