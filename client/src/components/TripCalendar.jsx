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

const TripCalendar = ({ trips = [], onEventClick }) => {
  // ✅ store just the selected trip ID, not the whole object
  const [selectedTripId, setSelectedTripId] = React.useState(null);

  // always derive the freshest trip object from props
  const selectedTrip = React.useMemo(
    () => trips.find((t) => t.id === selectedTripId) || null,
    [trips, selectedTripId]
  );

  const calendarEvents = trips
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
        // keep passing the full trip for consumers of onEventClick,
        // but we won't store it locally to avoid staleness.
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
          if (onEventClick) onEventClick(trip); // preserve external handlers
          // ✅ set only the id to always re-derive the newest version
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
