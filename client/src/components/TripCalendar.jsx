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
  // Local copy so calendar can update optimistically (like the table)
  const [calendarTrips, setCalendarTrips] = React.useState(trips || []);
  React.useEffect(() => setCalendarTrips(trips || []), [trips]);

  // Store only the selected ID; derive fresh object from local state
  const [selectedTripId, setSelectedTripId] = React.useState(null);
  const selectedTrip = React.useMemo(
    () => calendarTrips.find((t) => t.id === selectedTripId) || null,
    [calendarTrips, selectedTripId]
  );

  // Optimistic updater
  const handleTripUpdated = React.useCallback((updatedTrip) => {
    if (!updatedTrip || !updatedTrip.id) return;
    setCalendarTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? { ...t, ...updatedTrip } : t))
    );
  }, []);

  // 🔔 Listen for global updates from elsewhere (e.g., table actions)
  React.useEffect(() => {
    const onTripUpdated = (e) => {
      const updatedTrip = e?.detail;
      if (!updatedTrip) return;
      handleTripUpdated(updatedTrip);
    };
    window.addEventListener("trip:updated", onTripUpdated);
    return () => window.removeEventListener("trip:updated", onTripUpdated);
  }, [handleTripUpdated]);

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
        extendedProps: trip, // consumers of onEventClick can still get the full trip
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
          if (onEventClick) onEventClick(trip); // preserve existing external handler
          setSelectedTripId(trip?.id);          // show modal with freshest local data
        }}
      />

      {selectedTrip && (
        <ModalWrapper onClose={() => setSelectedTripId(null)}>
          {/* If TripDetails triggers updates itself, it can call this prop */}
          <TripDetails trip={selectedTrip} onTripUpdated={handleTripUpdated} />
        </ModalWrapper>
      )}
    </div>
  );
};

export default TripCalendar;
