import React, { useState, useEffect } from "react";
import { createTrip } from "../services/tripService";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const TripForm = ({ onSuccess, onClose }) => {
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    tripType: "Academic Trip",
    customType: "",
    destination: "",
    date: "",
    departureHour: "08",
    departureMinute: "00",
    departureAmPm: "AM",
    returnDate: "",
    returnHour: "10",
    returnMinute: "00",
    returnAmPm: "AM",
    students: "",
    notes: "",
    boosterSeatsRequested: false,
    boosterSeatCount: "",
  });

  const [timeError, setTimeError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If returnDate empty, default to the same as departure date
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      returnDate: prev.returnDate || prev.date,
    }));
  }, [formData.date]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on ESC (optional; leave if parent wraps in a modal with its own ESC)
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === "Escape" || e.key === "Esc") && !e.isComposing) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateTimes = () => {
    if (!formData.date || !formData.returnDate) return true;
    const dep = new Date(
      `${formData.date} ${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`
    );
    const ret = new Date(
      `${formData.returnDate} ${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`
    );
    if (!(dep instanceof Date) || isNaN(dep)) return true;
    if (!(ret instanceof Date) || isNaN(ret)) return true;
    if (ret <= dep) {
      setTimeError("Return time must be later than departure time.");
      return false;
    }
    setTimeError("");
    return true;
  };

  // Compose Notes to include Booster Seats, as requested
  const buildNotes = (notesText, boosterRequested, boosterCountRaw) => {
    const count = Number(boosterCountRaw) || 0;
    const boosterPart = boosterRequested
      ? count > 0
        ? `Booster seats: ${count}`
        : `Booster seats requested`
      : "";
    return [boosterPart, (notesText || "").trim()].filter(Boolean).join(" - ");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateTimes()) return;

    if (!profile?.name || !profile?.email) {
      toast.error("Missing user profile.");
      return;
    }

    // If requesting boosters but no count entered, you may enforce a value:
    // if (formData.boosterSeatsRequested && !Number(formData.boosterSeatCount)) {
    //   toast.error("Please enter the number of booster seats.");
    //   return;
    // }

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
        returnDate: formData.returnDate || formData.date,
        returnTime,
        students: Number(formData.students),
        notes: buildNotes(
          formData.notes,
          formData.boosterSeatsRequested,
          formData.boosterSeatCount
        ),
        boosterSeatsRequested: formData.boosterSeatsRequested,
        boosterSeatCount: formData.boosterSeatsRequested
          ? Number(formData.boosterSeatCount)
          : 0,
        createdBy: profile.name,
        createdByEmail: profile.email,
        status: "Pending",
        busInfo: { busType: "", seats: 0 },
        driverInfo: { name: "", mobile: "" },
        price: 0,
        editRequest: false,
        cancelRequest: false,
        createdAt: new Date(),
      };

      await createTrip(payload);
      toast.success("Trip request submitted!");
      onSuccess?.();
      onClose?.();

      // reset
      setFormData({
        tripType: "Academic Trip",
        customType: "",
        destination: "",
        date: "",
        departureHour: "08",
        departureMinute: "00",
        departureAmPm: "AM",
        returnDate: "",
        returnHour: "10",
        returnMinute: "00",
        returnAmPm: "AM",
        students: "",
        notes: "",
        boosterSeatsRequested: false,
        boosterSeatCount: "",
      });
    } catch (error) {
      console.error("Failed to submit trip:", error);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Trip Type */}
      <div>
        <label className="block text-sm font-medium">Trip Type *</label>
        <select
          name="tripType"
          value={formData.tripType}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        >
          {tripTypeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex-1"
        >
          Submit Request
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 flex-1"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default TripForm;
