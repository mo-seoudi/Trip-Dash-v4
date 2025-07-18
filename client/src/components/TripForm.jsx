import React, { useState, useEffect } from "react";
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
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Server error");

      toast.success("Trip submitted successfully!");
      if (onSuccess) onSuccess();

      // Reset form
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
      {/* — Form UI unchanged — */}
      {/* Keep all your form fields and JSX here as-is (already done above) */}
    </form>
  );
};

export default TripForm;
