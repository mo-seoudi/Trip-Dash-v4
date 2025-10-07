// src/components/SmartTripTable.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";
import { RxCaretSort, RxCaretUp, RxChevronDown, RxPerson } from "react-icons/rx";
import Pagination from "./Pagination";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import { usePagination } from "../hooks/usePagination";
import { useSubTrips } from "../hooks/useSubTrips";
import useTripActions from "../hooks/useTripActions";
import PassengersPanel from "./trips/PassengersPanel";
import EditTripForm from "./EditTripForm";

const SmartTripTable = ({ trips, dateSortOrder, setDateSortOrder, readOnly = false }) => {
  const { profile } = useAuth();
  const [tripData, setTripData] = React.useState([]);
  const [expandedTripId, setExpandedTripId] = React.useState(null);
  const [showDetailsTrip, setShowDetailsTrip] = React.useState(null);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null); // already existed

  const [showPassengersTrip, setShowPassengersTrip] = React.useState(null);

  React.useEffect(() => {
    setTripData(trips || []);
  }, [trips]);

  const {
    paginatedData,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    jumpPageInput,
    setJumpPageInput,
    handleJump,
  } = usePagination(tripData);

  // Kept to avoid breaking other logic; we no longer render sub-trips inline.
  const { subTripsMap } = useSubTrips(tripData);

  const { handleStatusChange, handleSoftDelete } = useTripActions(profile, setTripData);

  const handleDateSortToggle = () => {
    if (dateSortOrder === "") setDateSortOrder("asc");
    else if (dateSortOrder === "asc") setDateSortOrder("desc");
    else setDateSortOrder("");
  };

  const closeRow = () => setExpandedTripId(null);

  // Helper: after a successful edit, refresh the row in-memory if the caller passes updated data,
  // but EditTripForm already calls your service and you call onUpdated() to refetch outside.
  const refreshEditedTrip = () => {
    // If you have a fetch here, call it; otherwise the parent page likely refreshes.
  };

  // Role helpers for passengers feature
  const canSeePassengersButton = (role, status) =>
    (role === "school_staff" || role === "admin") &&
    ["Accepted", "Confirmed", "Completed"].includes(status);

  const isPassengersReadOnly = (role) => role !== "school_staff"; // admin = readOnly, staff = editable

  return (
    <div className="overflow-x-auto relative">
      <table className="min-w-full text-sm table-fixed">
        <thead className="bg-gray-100">
          <tr>
            <th className="w-[160px] px-4 py-2 text-left">Trip Type</th>
            <th className="w-[140px] px-4 py-2 text-left">Destination</th>
            <th className="w-[90px] px-4 py-2 text-left">Students</th>
            <th
              className="w-[160px] px-4 py-2 text-left cursor-pointer select-none"
              onClick={handleDateSortToggle}
            >
              Date{" "}
              <span className="inline-block w-4">
                {dateSortOrder === "" && <RxCaretSort />}
                {dateSortOrder === "asc" && "↑"}
                {dateSortOrder === "desc" && "↓"}
              </span>
            </th>
            <th className="w-[100px] px-4 py-2 text-left">Time</th>
            <th className="w-[130px] px-4 py-2 text-left">Status</th>
            <th className="w-[50px] px-2 py-2 text-center"></th>
          </tr>
        </thead>

        <tbody>
          {paginatedData.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-4">
                No trips found.
              </td>
            </tr>
          )}

          {paginatedData.map((trip) => (
            <React.Fragment key={trip.id}>
              <tr
                className={`border-b transition-colors ${
                  expandedTripId === trip.id ? "bg-gray-50" : "hover:bg-gray-50"
                } ${trip.status === "Pending" ? "font-semibold" : ""}`}
              >
                <td className="px-4 py-2">
                  {trip.tripType === "Other" ? trip.customType : trip.tripType}
                </td>

                {/* ✅ Destination is now a clickable link that opens TripDetails */}
                <td className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                  <button
                    type="button"
                    onClick={() => setShowDetailsTrip(trip)}
                    className="text-blue-600 hover:underline font-medium"
                    title="View trip details"
                  >
                    {trip.destination}
                  </button>
                </td>

                <td className="px-4 py-2">{trip.students}</td>
                <td className="px-4 py-2">
                  {trip.date
                    ? new Date(trip.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })
                    : ""}
                </td>
                <td className="px-4 py-2">{trip.departureTime}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={trip.status} />
                </td>
                <td
                  className="px-2 py-2 text-center cursor-pointer text-gray-400 hover:text-blue-600 transition"
                  onClick={() =>
                    setExpandedTripId(expandedTripId === trip.id ? null : trip.id)
                  }
                >
                  {expandedTripId === trip.id ? (
                    <RxCaretUp size={24} className="mx-auto" />
                  ) : (
                    <RxChevronDown size={24} className="mx-auto" />
                  )}
                </td>
              </tr>

              {expandedTripId === trip.id && (
                <tr className="bg-gray-50 border-b">
                  <td colSpan={7} className="px-4 py-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                      <ActionsCell
                        trip={trip}
                        role={profile?.role}
                        onStatusChange={(trip, status) => {
                          // Parent-trip status updates only.
                          handleStatusChange(trip, status);
                          // 🔔 broadcast optimistic update upstream so AllTrips can patch `trips`
                          try {
                            window.dispatchEvent(
                              new CustomEvent("trip:updated", { detail: { ...trip, status } })
                            );
                          } catch (_) {}
                          closeRow();
                        }}
                        onAssignBus={(trip) => setAssignTrip(trip)}
                        onConfirmAction={(trip, label, nextStatus) =>
                          setConfirmAction({ trip, label, nextStatus })
                        }
                        onView={(trip) => setShowDetailsTrip(trip)}
                        onEdit={(trip) => setEditTrip(trip)} // ✅ this now opens a modal
                        onSoftDelete={handleSoftDelete}
                      />

                      {/* Passengers button — staff (manage) & admin (view only). Hidden for bus_company */}
                      {canSeePassengersButton(profile?.role, trip.status) && (
                        <button
                          onClick={() => setShowPassengersTrip(trip)}
                          className="flex items-center px-2 py-1 border rounded text-sm font-semibold transition-colors duration-200 text-gray-700 hover:text-gray-900"
                          title={profile?.role === "admin" ? "View Passengers" : "Manage Passengers"}
                        >
                          <RxPerson className="mr-1" />
                          Passengers
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <Pagination
        totalItems={tripData.length}
        rowsPerPage={rowsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        jumpPageInput={jumpPageInput}
        setJumpPageInput={setJumpPageInput}
        onJump={handleJump}
      />

      {showDetailsTrip && (
        <ModalWrapper onClose={() => setShowDetailsTrip(null)}>
          <TripDetails trip={showDetailsTrip} />
        </ModalWrapper>
      )}

      {assignTrip && (
        <ModalWrapper onClose={() => setAssignTrip(null)}>
          <AssignBusForm
            trip={assignTrip}
            onClose={() => setAssignTrip(null)}
            onSubmit={(updatedTrip) => {
              setTripData((prev) =>
                prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
              );
              // 🔔 broadcast to parent
              try {
                window.dispatchEvent(
                  new CustomEvent("trip:updated", { detail: updatedTrip })
                );
              } catch (_) {}
              setAssignTrip(null);
              closeRow();
            }}
          />
        </ModalWrapper>
      )}

      {confirmAction && (
        <ConfirmActionPopup
          title={`${confirmAction.label} Trip`}
          description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`}
          onConfirm={() => {
            handleStatusChange(confirmAction.trip, confirmAction.nextStatus);
            // 🔔 broadcast optimistic update
            try {
              window.dispatchEvent(
                new CustomEvent("trip:updated", {
                  detail: { ...confirmAction.trip, status: confirmAction.nextStatus },
                })
              );
            } catch (_) {}
            setConfirmAction(null);
            closeRow();
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {/* Passengers modal */}
      {showPassengersTrip && (
        <ModalWrapper onClose={() => setShowPassengersTrip(null)}>
          <PassengersPanel
            trip={showPassengersTrip}
            onClose={() => setShowPassengersTrip(null)}
            readOnly={isPassengersReadOnly(profile?.role)} // admin = view-only, staff = can edit
          />
        </ModalWrapper>
      )}

      {/* ✅ NEW: Edit Trip modal (school_staff and others) */}
      {editTrip && (
        <ModalWrapper onClose={() => setEditTrip(null)}>
          <EditTripForm
            trip={editTrip}
            onClose={() => setEditTrip(null)}
            onUpdated={() => {
              refreshEditedTrip();
            }}
            // keep your rule from StaffActions: staff editing Confirmed ⇒ request mode
            isRequestMode={
              (profile?.role === "school_staff" && editTrip?.status === "Confirmed") ||
              false
            }
          />
        </ModalWrapper>
      )}
    </div>
  );
};

export default SmartTripTable;
