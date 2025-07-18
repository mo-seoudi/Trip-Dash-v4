import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";
import { RxCaretSort, RxChevronRight, RxChevronLeft } from "react-icons/rx";
import Pagination from "./Pagination";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";

import { usePagination } from "../hooks/usePagination";
import { useSubTrips } from "../hooks/useSubTrips";
import { useTripActions } from "../hooks/useTripActions";

const SmartTripTable = ({ data, dateSortOrder, setDateSortOrder, refreshCallback }) => {
  const { profile } = useAuth();
  const {
    paginatedData,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    jumpPageInput,
    setJumpPageInput,
    handleJump,
  } = usePagination(data);

  const { subTripsMap } = useSubTrips(data);
  const {
    showDetailsTrip,
    setShowDetailsTrip,
    confirmRejectTrip,
    setConfirmRejectTrip,
    handleStatusChange,
    handleViewTrip,
    handleCancel,
  } = useTripActions(refreshCallback);

  const [showActionsColumns, setShowActionsColumns] = React.useState(false);
  const [calendarView, setCalendarView] = React.useState(false);

  const handleDateSortToggle = () => {
    if (dateSortOrder === "") setDateSortOrder("asc");
    else if (dateSortOrder === "asc") setDateSortOrder("desc");
    else setDateSortOrder("");
  };

  const calendarEvents = data.map((trip) => ({
    id: trip.id,
    title: `${trip.destination}`,
    date: trip.date,
    extendedProps: trip,
  }));

  return (
    <div className="overflow-x-auto relative">
      <button
        onClick={() => setCalendarView(!calendarView)}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {calendarView ? "Show Table View" : "Show Calendar View"}
      </button>

      {calendarView ? (
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={calendarEvents}
          height="auto"
          eventClick={(info) => {
            const trip = info.event.extendedProps;
            handleViewTrip(trip);
          }}
        />
      ) : (
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-100">
            <tr>
              <th className="w-[140px] px-4 py-2 text-left">Trip Type</th>
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
              {showActionsColumns && (
                <>
                  <th className="w-[150px] px-4 py-2 text-left">Actions</th>
                  <th className="w-[70px] px-4 py-2 text-center">Options</th>
                </>
              )}
              <th
                onClick={() => setShowActionsColumns(!showActionsColumns)}
                className="w-[50px] px-2 py-2 text-center cursor-pointer text-gray-500 hover:text-blue-600 transition"
              >
                {showActionsColumns ? <RxChevronLeft size={24} className="mx-auto" /> : <RxChevronRight size={24} className="mx-auto" />}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={showActionsColumns ? 9 : 7} className="text-center py-4">
                  No trips found.
                </td>
              </tr>
            )}
            {paginatedData.map((trip) => (
              <React.Fragment key={trip.id}>
                <tr className={`border-b transition-colors ${showActionsColumns ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-2">{trip.tripType === "Other" ? trip.customType : trip.tripType}</td>
                  <td className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis">{trip.destination}</td>
                  <td className="px-4 py-2">{trip.students}</td>
                  <td className="px-4 py-2">{trip.date}</td>
                  <td className="px-4 py-2">{trip.departureTime}</td>
                  <td className="px-4 py-2"><StatusBadge status={trip.status} /></td>
                  {showActionsColumns && (
                    <>
                      <td className="px-4 py-2">
                        <ActionsCell
                          trip={trip}
                          role={profile?.role}
                          onAccept={(t) => handleStatusChange(t, "Accepted")}
                          onReject={(t) => setConfirmRejectTrip(t)}
                          onAssign={(t) => handleStatusChange(t, "Confirmed")}
                          onComplete={(t) => handleStatusChange(t, "Completed")}
                          onEdit={() => console.log("Edit info", trip)}
                          onCancel={handleCancel}
                          onView={handleViewTrip}
                          mode="actions"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <ActionsCell
                          trip={trip}
                          role={profile?.role}
                          onAccept={(t) => handleStatusChange(t, "Accepted")}
                          onReject={(t) => setConfirmRejectTrip(t)}
                          onAssign={(t) => handleStatusChange(t, "Confirmed")}
                          onComplete={(t) => handleStatusChange(t, "Completed")}
                          onEdit={() => console.log("Edit info", trip)}
                          onCancel={handleCancel}
                          onView={handleViewTrip}
                          mode="icons"
                        />
                      </td>
                    </>
                  )}
                  <td
                    className="px-2 py-2 text-center cursor-pointer text-gray-400 hover:text-blue-600 transition"
                    onClick={() => setShowActionsColumns(!showActionsColumns)}
                  >
                    {showActionsColumns ? <RxChevronLeft size={24} className="mx-auto" /> : <RxChevronRight size={24} className="mx-auto" />}
                  </td>
                </tr>

                {subTripsMap[trip.id]?.map((subTrip, index) => (
                  <tr key={subTrip.id} className="bg-gray-50 border-b">
                    <td className="px-4 py-2">↳ Bus #{index + 1}</td>
                    <td className="px-4 py-2">Seats: {subTrip.busSeats}</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"><StatusBadge status={subTrip.status} /></td>
                    <td className="px-4 py-2" colSpan={showActionsColumns ? 3 : 1}>
                      <button
                        onClick={() => handleViewTrip({ ...trip, subTrip })}
                        className="flex items-center text-green-600 underline hover:text-green-800 transition-colors px-1 text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {!calendarView && (
        <Pagination
          totalItems={data.length}
          rowsPerPage={rowsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          jumpPageInput={jumpPageInput}
          setJumpPageInput={setJumpPageInput}
          onJump={handleJump}
        />
      )}

      {showDetailsTrip && (
        <ModalWrapper onClose={() => setShowDetailsTrip(null)}>
          <TripDetails trip={showDetailsTrip} />
        </ModalWrapper>
      )}

      {confirmRejectTrip && (
        <ConfirmActionPopup
          title="Reject Trip"
          description="Are you sure you want to reject this trip? This action cannot be undone."
          onConfirm={() => handleStatusChange(confirmRejectTrip, "Rejected")}
          onClose={() => setConfirmRejectTrip(null)}
        />
      )}
    </div>
  );
};

export default SmartTripTable;
