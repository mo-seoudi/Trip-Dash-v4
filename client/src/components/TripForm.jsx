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
    returnHour: "08",
    returnMinute: "00",
    returnAmPm: "AM",
    students: "",
    notes: "",
    boosterSeatsRequested: false,
    boosterSeatCount: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [timeError, setTimeError] = useState("");

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      returnHour: prev.departureHour,
      returnMinute: prev.departureMinute,
      returnAmPm: prev.departureAmPm,
    }));
  }, [formData.departureHour, formData.departureMinute, formData.departureAmPm]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateTimes = () => {
    const depDate = new Date(`${formData.date} ${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`);
    const retDate = new Date(`${formData.returnDate || formData.date} ${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`);
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
        tripType: formData.tripType === "Other" ? formData.customType : formData.tripType,
        customType: formData.customType,
        destination: formData.destination,
        date: formData.date,
        departureTime,
        returnDate: formData.returnDate || formData.date,
        returnTime,
        students: Number(formData.students),
        notes: formData.notes,
        boosterSeatsRequested: formData.boosterSeatsRequested,
        boosterSeatCount: formData.boosterSeatsRequested ? Number(formData.boosterSeatCount) : 0,
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
      toast.success("Trip submitted successfully!");

      if (onSuccess) onSuccess();

      setFormData({
        tripType: "Academic Trip",
        customType: "",
        destination: "",
        date: "",
        departureHour: "08",
        departureMinute: "00",
        departureAmPm: "AM",
        returnDate: "",
        returnHour: "08",
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

  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
  const minuteOptions = ["00", "15", "30", "45"];
  const tripTypeOptions = ["Academic Trip", "Boarding House Trip", "Day Trip", "Sports Trip", "Other"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <h3 className="text-xl font-semibold">Request a New Trip</h3>

      <div>
        <label className="block text-sm font-medium">Trip Type *</label>
        <select name="tripType" value={formData.tripType} onChange={handleChange} className="w-full p-2 border rounded" required>
          {tripTypeOptions.map((type) => <option key={type}>{type}</option>)}
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

      <div>
        <label className="block text-sm font-medium">Destination *</label>
        <input type="text" name="destination" value={formData.destination} onChange={handleChange} required className="w-full p-2 border rounded" />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Departure Date *</label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full p-2 border rounded h-10" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 whitespace-nowrap">Departure Time *</label>
          <div className="flex gap-1">
            <select name="departureHour" value={formData.departureHour} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              {hourOptions.map((h) => <option key={h}>{h}</option>)}
            </select>
            <select name="departureMinute" value={formData.departureMinute} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              {minuteOptions.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select name="departureAmPm" value={formData.departureAmPm} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Return Date *</label>
          <input type="date" name="returnDate" value={formData.returnDate || formData.date} onChange={handleChange} required className="w-full p-2 border rounded h-10" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1 whitespace-nowrap">Return Time *</label>
          <div className="flex gap-1">
            <select name="returnHour" value={formData.returnHour} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              {hourOptions.map((h) => <option key={h}>{h}</option>)}
            </select>
            <select name="returnMinute" value={formData.returnMinute} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              {minuteOptions.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select name="returnAmPm" value={formData.returnAmPm} onChange={handleChange} className="w-1/3 p-2 border rounded text-center h-10">
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
          {timeError && <p className="text-red-500 text-sm mt-1">{timeError}</p>}
        </div>
      </div>

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

      <div className="flex items-center space-x-2 cursor-default">
        <input
          type="checkbox"
          name="boosterSeatsRequested"
          checked={formData.boosterSeatsRequested}
          onChange={handleChange}
          className="cursor-default"
        />
        <span className="text-sm cursor-default">Request Booster Seats</span>
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

      <div>
        <label className="block text-sm font-medium">Additional Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded" />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex-1"
        >
          {submitting ? "Submitting..." : "Submit Trip"}
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
