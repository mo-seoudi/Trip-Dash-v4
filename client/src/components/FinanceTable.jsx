import React, { useState } from "react";

function FinanceTable({ trips, onTogglePaid }) {
  const [editingTripId, setEditingTripId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const startEdit = (trip) => {
    setEditingTripId(trip.id);
    setEditValues({
      requester: trip.requester,
      price: trip.price,
      tripType: trip.tripType,
    });
  };

  const cancelEdit = () => {
    setEditingTripId(null);
    setEditValues({});
  };

  const saveEdit = (tripId) => {
    // For now, just alert — in future you can call backend here
    alert(`Saved changes for trip ${tripId}:\n${JSON.stringify(editValues, null, 2)}`);
    cancelEdit();
  };

  const handleChange = (field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: field === "price" ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Finance Overview</h2>
      {trips.length === 0 ? (
        <p className="text-gray-500 italic">No trips match your filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow rounded-xl overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">tripType</th>
                <th className="text-left p-3">Requester</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Students</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const isEditing = editingTripId === trip.id;

                return (
                  <tr key={trip.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.tripType}
                          onChange={(e) =>
                            handleChange("tripType", e.target.value)
                          }
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        trip.tripType
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.requester}
                          onChange={(e) =>
                            handleChange("requester", e.target.value)
                          }
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        trip.requester
                      )}
                    </td>
                    <td className="p-3">
                      {new Date(trip.date).toLocaleString()}
                    </td>
                    <td className="p-3">{trip.student_count}</td>
                    <td className="p-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValues.price}
                          onChange={(e) =>
                            handleChange("price", e.target.value)
                          }
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        `$${trip.price}`
                      )}
                    </td>
                    <td className="p-3">{trip.status}</td>
                    <td className="p-3">
                      <button
                        onClick={() => onTogglePaid(trip.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          trip.paid
                            ? "bg-green-600 text-white"
                            : "bg-gray-300 text-gray-800"
                        }`}
                      >
                        {trip.paid ? "Paid" : "Mark as Paid"}
                      </button>
                    </td>
                    <td className="p-3 space-x-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(trip.id)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 bg-gray-400 text-white text-xs rounded"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(trip)}
                          className="px-2 py-1 bg-yellow-500 text-white text-xs rounded"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FinanceTable;
