import test from "node:test";
import assert from "node:assert/strict";
import { generateOccurrenceDates, normalizeRecurrence } from "../src/services/tripRecurrence.js";

function keys(input) { return generateOccurrenceDates(input).dateKeys; }

test("daily recurrence generates each calendar date", () => {
  assert.deepEqual(keys({ recurrenceType: "daily", startDate: "2026-01-05", endDate: "2026-01-09" }), ["2026-01-05","2026-01-06","2026-01-07","2026-01-08","2026-01-09"]);
});

test("weekdays excludes Saturday and Sunday", () => {
  assert.deepEqual(keys({ recurrenceType: "weekdays", startDate: "2026-01-02", endDate: "2026-01-06" }), ["2026-01-02","2026-01-05","2026-01-06"]);
});

test("selected weekdays use Sunday zero through Saturday six", () => {
  assert.deepEqual(keys({ recurrenceType: "selected_weekdays", daysOfWeek: [1,3], startDate: "2026-01-05", endDate: "2026-01-14" }), ["2026-01-05","2026-01-07","2026-01-12","2026-01-14"]);
});

test("weekly repeats on the start date weekday", () => {
  assert.deepEqual(keys({ recurrenceType: "weekly", startDate: "2026-01-06", endDate: "2026-01-27" }), ["2026-01-06","2026-01-13","2026-01-20","2026-01-27"]);
});

test("interval can skip recurrence periods", () => {
  assert.deepEqual(keys({ recurrenceType: "weekly", interval: 2, startDate: "2026-01-06", endDate: "2026-02-03" }), ["2026-01-06","2026-01-20","2026-02-03"]);
});

test("invalid ranges and selected weekday rules fail closed", () => {
  assert.throws(() => normalizeRecurrence({ recurrenceType: "daily", startDate: "2026-02-02", endDate: "2026-02-01" }), /endDate/);
  assert.throws(() => normalizeRecurrence({ recurrenceType: "selected_weekdays", startDate: "2026-02-01", endDate: "2026-02-10", daysOfWeek: [] }), /dayOfWeek/);
  assert.throws(() => normalizeRecurrence({ recurrenceType: "monthly", startDate: "2026-02-01", endDate: "2026-02-10" }), /Unsupported/);
});

test("recurrence safety ceiling blocks oversized generation", () => {
  assert.throws(() => generateOccurrenceDates({ recurrenceType: "daily", startDate: "2026-01-01", endDate: "2027-12-31" }), /cannot create more than/);
});
