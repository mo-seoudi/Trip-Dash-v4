// client/src/components/TripCalendar.jsx

import React from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CustomCalendarToolbar from "./CustomCalendarToolbar";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";

// ✅ bring in auth + trip service to silently revalidate on mount
import { useAuth } from "../context/AuthContext";
import { getAllTrips, getTripsByUser } from "../services/tripService";

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
  const { profile } = useAuth();

  // Local copy so we can update optimistically/silently
  const [calendarTrips, setCalendarTrips] = React.useState(trips || []);
  React.useEffect(() => setCalendarTrips(trips || []), [trips]);

  // Store only the selected ID; derive fresh object from local state
  const [selectedTripId, setSelectedTripId] = React.useState(null);
  const selectedTrip = React.useMemo(
    () => calendarTrips.find((t) => t.id === selectedTripId) || null,
    [calendarTrips, selectedTripId]
  );

  // 🔇 Silent refresh on mount (and when profile becomes available)
  React.useEffect(() => {
    let isActive = true;
    const silentlyRefresh = async () => {
      try {
        if (!profile) return; // wait until auth is ready
        let latest = [];
        if (
          profile.role === "admin" ||
          profile.role === "school_staff" ||
          profile.role === "bus_company" ||
          profile.role === "finance"
        ) {
          latest = await getAllTrips();
        } else {
          latest = await getTripsByUser(profile?.name);
        }
        if (!isActive) return;

        // Optional: merge by id to avoid jarring reorder; here we just replace.
        setCalendarTrips(latest || []);
      } catch (e) {
        // silent fail (no UI flash) — just log for dev
        console.error("TripCalendar silent refresh failed:", e);
      }
    };

    silentlyRefresh();
    return () => {
      isActive = false;
    };
  }, [profile]); // runs when Calendar mounts and when profile becomes available

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
        // keep passing the full trip for consumers of onEventClick
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
        <ModalWrapper onClose={() => setSelectedTripId(null)}>
          <TripDetails trip={selectedTrip} />
        </ModalWrapper>
      )}
    </div>
  );
};

export default TripCalendar;
