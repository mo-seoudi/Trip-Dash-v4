import React from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CustomCalendarToolbar from "./CustomCalendarToolbar";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const TripCalendar = ({ trips = [], onEventClick }) => {
  const calendarEvents = trips.map((trip) => ({
    id: trip.id,
    title: trip.destination,
    start: new Date(trip.date + "T08:00:00"),
    end: new Date(trip.date + "T18:00:00"),
    extendedProps: trip,
  }));

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
          if (onEventClick) {
            onEventClick(event.extendedProps);
          }
        }}
      />
    </div>
  );
};

export default TripCalendar;
