// client/src/components/TripCalendar.jsx

import React from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CustomCalendarToolbar from "./CustomCalendarToolbar";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";

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

// same color mapping as StatusBadge
const statusDotClass = (status) => {
  switch (status) {
    case "Pending":
      return "bg-yellow-400";
    case "Accepted":
      return "bg-blue-500";
    case "Confirmed":
      return "bg-green-500";
    case "Rejected":
      return "bg-red-500";
    case "Completed":
      return "bg-gray-700";
    case "Canceled":
    case "Cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

// custom event content: title left, status dot right
function CalendarEventContent({ event }) {
  const trip = event.extendedProps || event;
  const dot = statusDotClass(trip?.status);
  return (
    <div className="flex items-center justify-between w-full">
      <span className="truncate">{event.title}</span>
      <span
        className={`ml-2 inline-block w-2.5 h-2.5 rounded-full ${dot}`}
        aria-label={trip?.status || "status"}
        title={trip?.status}
      />
    </div>
  );
}

const TripCalendar = ({ trips = [], onEventClick }) => {
  // Local copy so calendar can update optimistically (like the table)
  const [calendarTrips, setCalendarTrips] = React.useState(trips || []);
  React.useEffect(() => setCalendarTrips(trips || []), [trips]);

  // Store only the selected ID; derive fresh object from local state
  const [selectedTripId, setSelectedTripId] = React.useState(null);
  const selectedTrip = React.useMemo(
    () => calendarTrips.find((t) => t.id === selectedTripId) || null,
    [calendarTrips, selectedTripId]
  );

  // Light-blue chip styling for all events
  const eventStyleGetter = React.useCallback(() => {
    return {
      style: {
        backgroundColor: "#EAF2FF",         // light blue (close to Tailwind blue-50)
        border: "1px solid #CFE0FF",        // soft border
        color: "#0F172A",                   // slate-900 for good contrast
        borderRadius: "8px",
        padding: "2px 6px",
        boxShadow: "none",
      },
    };
  }, []);

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
          event: CalendarEventContent,     // title + status dot
        }}
        eventPropGetter={eventStyleGetter} // 👈 light-blue event chip
        onSelectEvent={(event) => {
          const trip = event?.extendedProps || event;
          if (onEventClick) onEventClick(trip);
          setSelectedTripId(trip?.id);
        }}
      />

      {selectedTrip && (
        <ModalWrapper onClose={() => setSelectedTripId(null)}>
          <TripDetails trip={selectedTrip} />
        </ModalWrapper>
      )}
    </div>
  );
};

export default TripCalendar;
