// src/components/SmartTripTable.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";
import { RxCaretSort, RxCaretUp, RxChevronDown } from "react-icons/rx";
import Pagination from "./Pagination";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import { usePagination } from "../hooks/usePagination";
import { useSubTrips } from "../hooks/useSubTrips";
import useTripActions from "../hooks/useTripActions";

// NEW: passengers panel
import PassengersPanel from "./trips/PassengersPanel";

const SmartTripTable = ({ trips, dateSortOrder, setDateSortOrder, readOnly = false }) => {
  const { profile } = useAuth();
  const [tripData, setTripData] = React.useState([]);
  const [expandedTripId, setExpandedTripId] = React.useState(null);
  const [showDetailsTrip, setShowDetailsTrip] = React.useState(null);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null);

  // NEW: track which trip is showing the Passengers panel
  const [showPassengersTrip, setShowPassengersTrip] = React.useState(null);

  React.useEffect(() => {
    setTripData(trips || []);
  }, [trips]);

  const { paginatedData, currentPage, setCurrentPage, rowsPerPage, setRowsPerPage, jumpPageInput, setJumpPageInput, handleJump } = usePagination(tripData);
  const { subTripsMap } = useSubTrips(tripData);
  const { handleStatusChange, handleSoftDelete } = useTripActions(profile, setTripData);

  const handleDateSortToggle = () => {
    if (dateSortOrder === "") setDateSortOrder("asc");
    else if (dateSortOrder === "asc") setDateSortOrder("desc");
    else setDateSortOrder("");
  };

  const closeRow = () => setExpandedTripId(null);

  return (
    <div className="overflow-x-auto relative">
      <table className="min-w-full text-sm table-fixed">
        <thead className="bg-gray-100">
          <tr>
            <th className="w-[160px] px-4 py-2 text-left">Trip Type</th>
            <th className="w-[140px] px-4 py-2 text-left">Destination</th>
            <th className="w-[90px] px-4 py-2 text-left">Students</th>
            <th className="w-[160px] px-4 py-2 text-left cursor-pointer select-none" onClick={handleDateSortToggle}>
              Date <span className="inline-block w-4">
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
              <td colSpan={7} className="text-center py-4">No trips found.</td>
            </tr>
          )}

          {paginatedData.map((trip) => (
            <React.Fragment key={trip.id}>
              <tr className={`border-b transition-colors ${expandedTripId === trip.id ? "bg-gray-50" : "hover:bg-gray-50"} ${trip.status === "Pending" ? "font-semibold" : ""}`}>
                <td className="px-4 py-2">{trip.tripType === "Other" ? trip.customType : trip.tripType}</td>
                <td className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis">{trip.destination}</td>
                <td className="px-4 py-2">{trip.students}</td>
                <td className="px-4 py-2">
                  {trip.date ? new Date(trip.date).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "2-digit"
                  }) : ""}
                </td>  
                <td className="px-4 py-2">{trip.departureTime}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={trip.status} />
                </td>
                <td className="px-2 py-2 text-center cursor-pointer text-gray-400 hover:text-blue-600 transition" onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}>
                  {expandedTripId === trip.id ? <RxCaretUp size={24} className="mx-auto" /> : <RxChevronDown size={24} className="mx-auto" />}
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
                          handleStatusChange(trip, status);
                          closeRow();
                        }}
                        onAssignBus={(trip) => setAssignTrip(trip)}
                        onConfirmAction={(trip, label, nextStatus) => setConfirmAction({ trip, label, nextStatus })}
                        onView={(trip) => setShowDetailsTrip(trip)}
                        onEdit={(trip) => setEditTrip(trip)}
                        onSoftDelete={handleSoftDelete}
                      />

                      {/* NEW: Passengers button — only when the trip is beyond Pending */}
                      {["Accepted", "Confirmed", "Completed"].includes(trip.status) && (
                        <button
                          onClick={() => setShowPassengersTrip(trip)}
                          className="px-3 py-2 rounded bg-indigo-600 text-white"
                        >
                          Passengers
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {subTripsMap[trip.id]?.map((subTrip, index) => (
                <tr key={subTrip.id} className="bg-gray-50 border-b">
                  <td className="px-4 py-2">↳ Bus #{index + 1}</td>
                  <td className="px-4 py-2">Seats: {subTrip.busSeats}</td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">
                    <StatusBadge status={subTrip.status} />
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => setShowDetailsTrip({ ...trip, subTrip })} className="flex items-center text-green-600 underline hover:text-green-800 transition-colors px-1 text-sm">
                      View
                    </button>
                  </td>
                </tr>
              ))}
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
            setConfirmAction(null);
            closeRow();
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {/* NEW: Passengers modal */}
      {showPassengersTrip && (
        <ModalWrapper onClose={() => setShowPassengersTrip(null)}>
          <PassengersPanel
            trip={showPassengersTrip}
            onClose={() => setShowPassengersTrip(null)}
          />
        </ModalWrapper>
      )}
    </div>
  );
};

export default SmartTripTable;
