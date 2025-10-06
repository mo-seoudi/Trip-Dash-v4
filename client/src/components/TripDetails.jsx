// client/src/components/TripDetails.jsx
import React from "react";
import StatusBadge from "./StatusBadge";
import { useAuth } from "../context/AuthContext";

// 🔁 reuse the exact action bar the table uses (for identical look & icons)
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import EditTripForm from "./EditTripForm";
import useTripActions from "../hooks/useTripActions";

function TripDetails({ trip }) {
  if (!trip) return null;

  const { profile } = useAuth();

  // Keep a local copy so the modal reflects updates immediately
  const [currentTrip, setCurrentTrip] = React.useState(trip);
  React.useEffect(() => setCurrentTrip(trip), [trip]);

  // We don't need to manage a list here, but useTripActions expects a setter.
  const [, setSink] = React.useState([]);
  const { handleStatusChange, handleSoftDelete } = useTripActions(profile, setSink);

  // Action modals (same ones the table opens)
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null);

  // When actions finish, patch local trip + notify parent via a window event
  const patchTrip = (updated) => {
    if (!updated) return;
    setCurrentTrip((prev) => ({ ...prev, ...updated }));
    try {
      window.dispatchEvent(new CustomEvent("trip:updated", { detail: { ...currentTrip, ...updated } }));
    } catch (_) {}
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formattedDate = formatDate(currentTrip.date);
  const returnDate = formatDate(currentTrip.returnDate);
  const departureTime = currentTrip.departureTime || "-";
  const returnTime = currentTrip.returnTime || "-";
  const buses = Array.isArray(currentTrip.buses) ? currentTrip.buses : [];

  return (
    <div className="space-y-4">
      {/* Trip Summary */}
      <div>
        <h2 className="text-xl font-bold mb-2">Trip Summary</h2>
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
          <div>
            <strong>Trip Type:</strong>{" "}
            {currentTrip.tripType === "Other" ? currentTrip.customType : currentTrip.tripType}
          </div>
          <div>
            <strong>Destination:</strong> {currentTrip.destination}
          </div>
          <div>
            <strong>Departure:</strong> {formattedDate} at: {departureTime}
          </div>
          <div>
            <strong>Return:</strong> {returnDate} at: {returnTime}
          </div>
          <div>
            <strong>Students:</strong> {currentTrip.students}
          </div>
          <div className="flex items-center">
            <strong className="mr-1">Status:</strong> <StatusBadge status={currentTrip.status} />
          </div>
          {currentTrip.notes && (
            <div className="col-span-2">
              <strong>Notes:</strong> {currentTrip.notes}
            </div>
          )}
          {currentTrip.requester && (
            <div className="col-span-2">
              <strong>Requested by:</strong> {currentTrip.requester}
            </div>
          )}
        </div>
      </div>

      {/* Compact Action Strip (identical look to table; no "View" button) */}
      <div className="pt-1">
        <ActionsCell
          trip={currentTrip}
          role={profile?.role}
          // ⬇️ update immediately in the modal and propagate upward
          onStatusChange={(tripArg, nextStatus) => {
            // optimistic local patch
            patchTrip({ status: nextStatus });
            // run the real action (server/API) via shared hook
            handleStatusChange(tripArg, nextStatus);
          }}
          onAssignBus={(t) => setAssignTrip(t)}
          onConfirmAction={(t, label, nextStatus) =>
            setConfirmAction({ trip: t, label, nextStatus })
          }
          // ⛔️ no onView — we're already in a view modal
          onEdit={(t) => setEditTrip(t)}
          onSoftDelete={handleSoftDelete}
        />
      </div>

      {/* Assigned Buses */}
      {buses.length > 0 && (
        <>
          <hr className="my-2 border-gray-300" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Assigned Buses</h3>
            <div className="space-y-3">
              {buses.map((bus, index) => {
                const busStatus =
                  bus?.status && String(bus.status).trim()
                    ? bus.status
                    : currentTrip.status;

                return (
                  <div key={index} className="bg-white border rounded p-4 shadow-sm">
                    <p className="font-medium mb-1">Bus #{index + 1}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><strong>Type:</strong> {bus.busType}</div>
                      <div><strong>Seats:</strong> {bus.busSeats}</div>
                      <div>
                        <strong>Price:</strong>{" "}
                        {bus.tripPrice ? `AED ${bus.tripPrice}` : "-"}
                      </div>
                      <div><strong>Driver Name:</strong> {bus.driverName || "-"}</div>
                      <div><strong>Driver Phone:</strong> {bus.driverPhone || "-"}</div>
                      <div className="flex items-center">
                        <strong className="mr-1">Status:</strong>{" "}
                        <StatusBadge status={busStatus} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modals matching table behavior */}
      {assignTrip && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <AssignBusForm
            trip={assignTrip}
            onClose={() => setAssignTrip(null)}
            onSubmit={(updatedTrip) => {
              setAssignTrip(null);
              // merge returned trip into local copy + broadcast
              patchTrip(updatedTrip);
            }}
          />
        </div>
      )}

      {confirmAction && (
        <ConfirmActionPopup
          title={`${confirmAction.label} Trip`}
          description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`}
          onConfirm={() => {
            // optimistic local patch
            patchTrip({ status: confirmAction.nextStatus });
            // server call via shared hook
            handleStatusChange(confirmAction.trip, confirmAction.nextStatus);
            setConfirmAction(null);
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {editTrip && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <EditTripForm
            trip={editTrip}
            onClose={() => setEditTrip(null)}
            onUpdated={(maybeUpdated) => {
              setEditTrip(null);
              if (maybeUpdated) patchTrip(maybeUpdated);
            }}
            isRequestMode={
              (profile?.role === "school_staff" && editTrip?.status === "Confirmed") || false
            }
          />
        </div>
      )}
    </div>
  );
}

export default TripDetails;
