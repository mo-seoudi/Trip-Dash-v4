// client/src/components/TripCalendar.jsx

import React from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CustomCalendarToolbar from "./CustomCalendarToolbar";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";

// 🔁 bring in the same action plumbing the table uses
import { useAuth } from "../context/AuthContext";
import useTripActions from "../hooks/useTripActions";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// robust parser: accepts Date or string or null
const toDate = (d) => (d instanceof Date ? d : d ? new Date(d) : null);

const TripCalendar = ({ trips = [], onEventClick }) => {
  // 👤 same context as table
  const { profile } = useAuth();

  // ✅ Local copy so calendar can update optimistically (like the table)
  const [calendarTrips, setCalendarTrips] = React.useState(trips || []);
  React.useEffect(() => setCalendarTrips(trips || []), [trips]);

  // ✅ Trip selection
  const [selectedTripId, setSelectedTripId] = React.useState(null);
  const selectedTrip = React.useMemo(
    () => calendarTrips.find((t) => t.id === selectedTripId) || null,
    [calendarTrips, selectedTripId]
  );

  // ✅ Same action hooks as the table (instant updates into local state)
  const { handleStatusChange, handleSoftDelete } = useTripActions(
    profile,
    setCalendarTrips
  );

  // ✅ Extra calendar-modal state mirroring the table behaviors
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);

  const closeDetails = () => setSelectedTripId(null);

  const calendarEvents = calendarTrips
    .map((trip) => {
      const base = toDate(trip.date);
      if (!base) return null;

      // compute start (08:00) and end (18:00) on the same day
      const start = new Date(base.getTime());
      start.setHours(8, 0, 0, 0);

      const endBase = toDate(trip.returnDate) || base;
      const end = new Date(endBase.getTime());
      end.setHours(18, 0, 0, 0);

      return {
        id: trip.id,
        title: trip.destination || trip.tripType || "Trip",
        start,
        end,
        allDay: false,
        extendedProps: trip,
      };
    })
    .filter(Boolean);

  return (
    <div className="bg-white rounded shadow">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        components={{
          toolbar: CustomCalendarToolbar,
        }}
        onSelectEvent={(event) => {
          const trip = event?.extendedProps || event;
          if (onEventClick) onEventClick(trip); // preserve external handler
          setSelectedTripId(trip?.id);          // open modal with freshest local data
        }}
      />

      {selectedTrip && (
        <ModalWrapper onClose={closeDetails}>
          <div className="space-y-4">
            <TripDetails trip={selectedTrip} />

            {/* 🔁 Replicate the table’s action row so updates are optimistic */}
            <div className="pt-2 border-t">
              <ActionsCell
                trip={selectedTrip}
                role={profile?.role}
                onStatusChange={(trip, nextStatus) => {
                  handleStatusChange(trip, nextStatus);
                }}
                onAssignBus={(trip) => setAssignTrip(trip)}
                onConfirmAction={(trip, label, nextStatus) =>
                  setConfirmAction({ trip, label, nextStatus })
                }
                onView={() => { /* already viewing in modal */ }}
                onEdit={() => { /* optional: add Edit form if you want parity */ }}
                onSoftDelete={handleSoftDelete}
              />
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 📦 Assign Bus modal — same as table */}
      {assignTrip && (
        <ModalWrapper onClose={() => setAssignTrip(null)}>
          <AssignBusForm
            trip={assignTrip}
            onClose={() => setAssignTrip(null)}
            onSubmit={(updatedTrip) => {
              setCalendarTrips((prev) =>
                prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
              );
              setAssignTrip(null);
              // keep details open; derived from local state so it updates instantly
            }}
          />
        </ModalWrapper>
      )}

      {/* ✅ Confirm action popup — same as table */}
      {confirmAction && (
        <ConfirmActionPopup
          title={`${confirmAction.label} Trip`}
          description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`}
          onConfirm={() => {
            handleStatusChange(confirmAction.trip, confirmAction.nextStatus);
            setConfirmAction(null);
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};

export default TripCalendar;
