import React, { useState, useEffect } from "react";
import { updateTrip } from "../services/tripService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ModalWrapper from "./ModalWrapper";

const EditBusForm = ({ trip, onSuccess }) => {
  const [formData, setFormData] = useState({
    busType: trip.busType || "Internal Yellow Bus",
    busSeats: trip.busSeats || "",
    tripPrice: trip.tripPrice || "",
    driverName: trip.driverName || "",
    driverPhone: trip.driverPhone || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const busOptions = ["School Yellow Bus", "External Yellow Bus", "White Bus"];

  useEffect(() => {
    setFormData({
      busType: trip.busType || "Internal Yellow Bus",
      busSeats: trip.busSeats || "",
      tripPrice: trip.tripPrice || "",
      driverName: trip.driverName || "",
      driverPhone: trip.driverPhone || "",
    });
  }, [trip]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await updateTrip(trip.id, {
        busType: formData.busType,
        busSeats: Number(formData.busSeats),
        tripPrice: formData.tripPrice ? Number(formData.tripPrice) : "",
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
      });

      toast.success("Bus info updated successfully!");
      onSuccess();
    } catch (error) {
      console.error("Failed to update bus info:", error);
      toast.error("Failed to update info. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title="Edit Bus Info" onClose={onSuccess} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Bus Type</label>
          <select
            value={formData.busType}
            onChange={(e) => handleInputChange("busType", e.target.value)}
            className="w-full p-2 border rounded"
          >
            {busOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Number of Seats</label>
          <input
            type="number"
            value={formData.busSeats}
            onChange={(e) => handleInputChange("busSeats", e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Trip Price (AED)</label>
          <input
            type="number"
            value={formData.tripPrice}
            onChange={(e) => handleInputChange("tripPrice", e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Driver Name</label>
          <input
            type="text"
            value={formData.driverName}
            onChange={(e) => handleInputChange("driverName", e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Driver Phone</label>
          <input
            type="text"
            value={formData.driverPhone}
            onChange={(e) => handleInputChange("driverPhone", e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onSuccess}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default EditBusForm;
