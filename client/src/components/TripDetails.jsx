import React from "react";
import StatusBadge from "./StatusBadge";
import { useAuth } from "../context/AuthContext";

import ActionsCell from "./actions/ActionsCell";       // reuse the table's action bar
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import EditTripForm from "./EditTripForm";
import PassengersPanel from "./trips/PassengersPanel";
import useTripActions from "../hooks/useTripActions";
import { RxPerson } from "react-icons/rx";
import ModalWrapper from "./ModalWrapper";             // use same modal wrapper as table

// tiny in-file popover for showing/copying the email
function EmailPopover({ email = "-", onClose }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email || "");
    } catch {}
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute z-[200] mt-1 w-64 rounded border bg-white shadow p-3 text-sm"
      role="dialog"
      aria-label="Requester email"
    >
      <div className="font-mono break-all">{email || "-"}</div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={copy}
          className="text-blue-600 hover:underline"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

function TripDetails({ trip }) {
  if (!trip) return null;

  const { profile } = useAuth();

  // keep a local copy for instant updates inside the modal
  const [currentTrip, setCurrentTrip] = React.useState(trip);
  React.useEffect(() => setCurrentTrip(trip), [trip]);

  // useTripActions expects a setter; we give it a small sink
  const [, setSink] = React.useState([]);
  const { handleStatusChange, handleSoftDelete } = useTripActions(profile, setSink);

  // auxiliary modals / UI states
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null);
  const [showPassengersTrip, setShowPassengersTrip] = React.useState(null);
  const [showRequesterEmail, setShowRequesterEmail] = React.useState(false);

  const patchTrip = (updated) => {
    if (!updated) return;
    setCurrentTrip((prev) => ({ ...prev, ...updated }));
    // broadcast so AllTrips patches parent `trips` (keeps table & calendar in sync)
    try {
      window.dispatchEvent(
        new CustomEvent("trip:updated", { detail: { ...currentTrip, ...updated } })
      );
    } catch {}
  };

  const canSeePassengersButton =
    (profile?.role === "school_staff" || profile?.role === "admin") &&
    ["Accepted", "Confirmed", "Completed"].includes(currentTrip?.status);

  const isPassengersReadOnly = (role) => role !== "school_staff"; // admin=view-only

  const buses = Array.isArray(currentTrip.buses) ? currentTrip.buses : [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Broad, tolerant requester extractor
  const extractRequester = (t) => {
    const nameFromStrings =
      t?.requesterName ||
      t?.requestedByName ||
      t?.createdByName ||
      t?.ownerName ||
      t?.requester ||           // sometimes name is stored directly in "requester"
      t?.requestedBy ||
      t?.createdBy ||
      t?.owner ||
      null;

    const nameFromObjects =
      t?.requester?.name ||
      t?.requestedBy?.name ||
      t?.createdBy?.name ||
      t?.owner?.name ||
      null;

    const emailFromStrings =
      t?.requesterEmail ||
      t?.requestedByEmail ||
      t?.createdByEmail ||
      t?.ownerEmail ||
      null;

    const emailFromObjects =
      t?.requester?.email ||
      t?.requestedBy?.email ||
      t?.createdBy?.email ||
      t?.owner?.email ||
      null;

    const name = nameFromStrings || nameFromObjects || null;
    const email = emailFromStrings || emailFromObjects || null;
    return { name, email };
  };

  const { name: requesterName, email: requesterEmail } = extractRequester(currentTrip);

  const formattedDate = formatDate(currentTrip.date);
  const returnDate = formatDate(currentTrip.returnDate);
  const departureTime = currentTrip.departureTime || "-";
  const returnTime = currentTrip.returnTime || "-";

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

          {/* Notes */}
          {currentTrip.notes && (
            <div className="col-span-2">
              <strong>Notes:</strong> {currentTrip.notes}
            </div>
          )}

          {/* Requested by (name-only popover for email) */}
          {(requesterName || requesterEmail) && (
            <div className="col-span-2">
              <strong>Requested by:</strong>{" "}
              <span className="relative inline-block">
                {requesterName ? (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setShowRequesterEmail((s) => !s)}
                    aria-expanded={showRequesterEmail}
                    aria-controls="requester-email-popover"
                    title="Show email"
                  >
                    {requesterName}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setShowRequesterEmail((s) => !s)}
                    aria-expanded={showRequesterEmail}
                    aria-controls="requester-email-popover"
                    title="Show email"
                  >
                    View email
                  </button>
                )}

                {showRequesterEmail && (
                  <div id="requester-email-popover">
                    <EmailPopover
                      email={requesterEmail}
                      onClose={() => setShowRequesterEmail(false)}
                    />
                  </div>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Compact action strip (identical look to table; View hidden) */}
      <div className="pt-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <ActionsCell
            trip={currentTrip}
            role={profile?.role}
            hideView                 // hide the View button in the modal
            onStatusChange={(tripArg, nextStatus) => {
              patchTrip({ status: nextStatus });          // optimistic local update
              handleStatusChange(tripArg, nextStatus);     // server call via shared hook
            }}
            onAssignBus={(t) => setAssignTrip(t)}
            onConfirmAction={(t, label, nextStatus) =>
              setConfirmAction({ trip: t, label, nextStatus })
            }
            onEdit={(t) => setEditTrip(t)}
            onSoftDelete={handleSoftDelete}
          />

          {/* Passengers — same button logic & styling as SmartTripTable */}
          {canSeePassengersButton && (
            <button
              onClick={() => setShowPassengersTrip(currentTrip)}
              className="flex items-center px-2 py-1 border rounded text-sm font-semibold transition-colors duration-200 text-gray-700 hover:text-gray-900"
              title={profile?.role === "admin" ? "View Passengers" : "Manage Passengers"}
            >
              <RxPerson className="mr-1" />
              Passengers
            </button>
          )}
        </div>
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

      {/* Modals (same behavior as table) */}
      {assignTrip && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <AssignBusForm
            trip={assignTrip}
            onClose={() => setAssignTrip(null)}
            onSubmit={(updatedTrip) => {
              setAssignTrip(null);
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
            patchTrip({ status: confirmAction.nextStatus });
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

      {/* Passengers modal (uses the SAME ModalWrapper as the table) */}
      {showPassengersTrip && (
        <ModalWrapper onClose={() => setShowPassengersTrip(null)}>
          <PassengersPanel
            trip={showPassengersTrip}
            readOnly={isPassengersReadOnly(profile?.role)}
          />
        </ModalWrapper>
      )}
    </div>
  );
}

export default TripDetails;
