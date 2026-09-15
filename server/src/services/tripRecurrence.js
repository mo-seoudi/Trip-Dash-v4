// Generic recurrence engine for TripSeries.
// Dates are handled as UTC calendar dates so schedule generation is stable
// regardless of the server's local timezone.

export const RECURRENCE_TYPES = Object.freeze({
  DAILY: "daily",
  WEEKDAYS: "weekdays",
  SELECTED_WEEKDAYS: "selected_weekdays",
  WEEKLY: "weekly",
});

const ALLOWED = new Set(Object.values(RECURRENCE_TYPES));
const MAX_OCCURRENCES = 366;

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function calendarDate(value, field = "date") {
  const raw = value instanceof Date
    ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`
    : String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw bad(`${field} must use YYYY-MM-DD`);
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw bad(`${field} must be a valid calendar date`);
  return date;
}

function dayKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function plusDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function normalizeRecurrence(input = {}) {
  const recurrenceType = String(input.recurrenceType || "").trim().toLowerCase();
  if (!ALLOWED.has(recurrenceType)) throw bad("Unsupported recurrence type");
  const interval = input.interval === undefined ? 1 : Number(input.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) throw bad("interval must be an integer from 1 to 52");
  const startDate = calendarDate(input.startDate, "startDate");
  const endDate = calendarDate(input.endDate, "endDate");
  if (endDate < startDate) throw bad("endDate must be on or after startDate");

  let daysOfWeek = Array.isArray(input.daysOfWeek) ? [...new Set(input.daysOfWeek.map(Number))].sort((a, b) => a - b) : [];
  if (daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw bad("daysOfWeek values must be integers from 0 (Sunday) to 6 (Saturday)");
  if (recurrenceType === RECURRENCE_TYPES.SELECTED_WEEKDAYS && !daysOfWeek.length) throw bad("selected_weekdays requires at least one dayOfWeek");
  if (recurrenceType === RECURRENCE_TYPES.WEEKLY) daysOfWeek = [startDate.getUTCDay()];
  if ([RECURRENCE_TYPES.DAILY, RECURRENCE_TYPES.WEEKDAYS].includes(recurrenceType)) daysOfWeek = [];

  return { recurrenceType, interval, daysOfWeek, startDate, endDate };
}

export function generateOccurrenceDates(input = {}) {
  const rule = normalizeRecurrence(input);
  const dates = [];
  let cursor = rule.startDate;
  let dayOffset = 0;
  while (cursor <= rule.endDate) {
    const weekday = cursor.getUTCDay();
    const weekOffset = Math.floor(dayOffset / 7);
    let include = false;
    if (rule.recurrenceType === RECURRENCE_TYPES.DAILY) include = dayOffset % rule.interval === 0;
    else if (rule.recurrenceType === RECURRENCE_TYPES.WEEKDAYS) include = weekday >= 1 && weekday <= 5 && weekOffset % rule.interval === 0;
    else include = rule.daysOfWeek.includes(weekday) && weekOffset % rule.interval === 0;
    if (include) {
      dates.push(new Date(cursor.getTime()));
      if (dates.length > MAX_OCCURRENCES) throw bad(`A recurring request cannot create more than ${MAX_OCCURRENCES} trips`);
    }
    cursor = plusDays(cursor, 1);
    dayOffset += 1;
  }
  if (!dates.length) throw bad("The recurrence rule does not produce any trips in the selected period");
  return { rule, dates, dateKeys: dates.map(dayKey) };
}
