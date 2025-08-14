// client/src/components/trips/PassengersPanel.jsx

import { useEffect, useState } from "react";
import { getTripPassengers, addTripPassengers, updateTripPassenger, addTripPassengerPayment } from "@/services/tripService";

export default function PassengersPanel({ trip, onClose }) {
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    (async () => {
      const data = await getTripPassengers(trip.id);
      setRows(data);
    })();
  }, [trip.id]);

  async function handleAdd() {
    if (!newName.trim()) return;
    const created = await addTripPassengers(trip.id, [{ fullName: newName }], true);
    setRows((r) => [...r, ...created]);
    setNewName("");
  }

  async function toggleCheckIn(row) {
    const updated = await updateTripPassenger(trip.id, row.id, {
      checkedInAt: row.checkedInAt ? null : new Date().toISOString()
    });
    setRows((r) => r.map(x => (x.id === row.id ? updated : x)));
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className="border p-2 rounded w-full" />
        <button onClick={handleAdd} className="px-3 py-2 rounded bg-blue-600 text-white">Add</button>
        <button onClick={onClose} className="px-3 py-2 rounded bg-gray-200">Close</button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>Name</th><th>Seat</th><th>Pickup</th><th>Dropoff</th><th>Checked In</th><th>Payment</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b">
              <td>{row.fullName}</td>
              <td>{row.seatNumber || "-"}</td>
              <td>{row.pickupPoint || "-"}</td>
              <td>{row.dropoffPoint || "-"}</td>
              <td>{row.checkedInAt ? "Yes" : "No"}</td>
              <td>{row.paymentStatus || "—"}</td>
              <td>
                <button onClick={() => toggleCheckIn(row)} className="px-2 py-1 rounded bg-green-600 text-white">
                  {row.checkedInAt ? "Undo Check-in" : "Check-in"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
