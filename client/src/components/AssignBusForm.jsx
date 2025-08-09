import React, { useState, useEffect } from "react";
import { updateTrip, createSubTrips } from "../services/tripService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ModalWrapper from "./ModalWrapper";

const AssignBusForm = ({ trip, onClose, onSubmit }) => {
  const [busType, setBusType] = useState("Internal Yellow Bus");
  const [busSeats, setBusSeats] = useState(trip.students || "");
  const [tripPrice, setTripPrice] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [buses, setBuses] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (trip.buses && trip.buses.length) {
      setBuses(trip.buses);
    }
    // Initialize seats to requested students
    setBusSeats(trip.students || "");
  }, [trip]);

  const resetForm = () => {
    setBusType("Internal Yellow Bus");
    setBusSeats(trip.students || "");
    setTripPrice("");
    setDriverName("");
    setDriverPhone("");
    setEditingIndex(null);
  };

  const handleAddOrUpdateBus = () => {
    if (!busSeats) {
      toast.error("Please enter number of seats.");
      return;
    }

    const newBus = {
      busType,
      busSeats: Number(busSeats),
      tripPrice: tripPrice ? Number(tripPrice) : "",
      driverName,
      driverPhone,
    };

    if (editingIndex !== null) {
      const updated = [...buses];
      updated[editingIndex] = newBus;
      setBuses(updated);
      toast.success("Bus updated successfully.");
    } else {
      setBuses((prev) => [...prev, newBus]);
      toast.success("Bus added to list.");
    }

    resetForm();
  };

  const handleEditBus = (index) => {
    const bus = buses[index];
    setBusType(bus.busType);
    setBusSeats(bus.busSeats);
    setTripPrice(bus.tripPrice);
    setDriverName(bus.driverName);
    setDriverPhone(bus.driverPhone);
    setEditingIndex(index);
  };

  const handleRemoveBus = (index) => {
    const updated = buses.filter((_, i) => i !== index);
    setBuses(updated);
  };

  const handleSubmit = async () => {
    if (!buses.length) {
      toast.error("Please add at least one bus.");
      return;
    }

    setSubmitting(true);
    const statusToSet = "Confirmed";

    try {
      await updateTrip(trip.id, {
        buses,
        status: statusToSet,
      });
      console.log("Assigning buses to parent trip ID:", trip.id);
      
      // Create sub-trips
      await createSubTrips(trip.id, buses);

      toast.success("Buses assigned successfully!");

      // ✨ Call onSubmit with updated trip
      if (onSubmit) {
        const updatedTrip = { ...trip, buses, status: statusToSet };
        onSubmit(updatedTrip);
      }

      onClose();
    } catch (error) {
      console.error("Failed to assign buses:", error);
      toast.error("Failed to assign buses. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper title="Assign Bus" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Bus Type</label>
          <select
            value={busType}
            onChange={(e) => setBusType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option>Internal Yellow Bus</option>
            <option>External Yellow Bus</option>
            <option>White Bus</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Number of Seats</label>
          <input
            type="number"
            value={busSeats}
            onChange={(e) => setBusSeats(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Trip Price (AED)</label>
          <input
            type="number"
            value={tripPrice}
            onChange={(e) => setTripPrice(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Driver Name</label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Driver Phone</label>
          <input
            type="text"
            value={driverPhone}
            onChange={(e) => setDriverPhone(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          type="button"
          onClick={handleAddOrUpdateBus}
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          {editingIndex !== null ? "Update Bus" : "Add Bus to List"}
        </button>

        {buses.length > 0 && (
          <div className="bg-gray-50 p-3 rounded shadow-sm">
            <p className="font-medium mb-2">Assigned Buses:</p>
            {buses.map((bus, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b py-1"
              >
                <p>
                  #{index + 1}: {bus.busType}, Seats: {bus.busSeats}
                </p>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleEditBus(index)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveBus(index)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            {submitting ? "Assigning..." : "Save & Assign"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default AssignBusForm;
