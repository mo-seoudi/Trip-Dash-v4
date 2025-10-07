import React, { useEffect, useMemo, useState } from "react";
import ModalWrapper from "./ModalWrapper";
import { updateTrip } from "../services/tripService";
import { requestTripEdit } from "../services/tripService"; // new helper (see below)
import { toast } from "react-toastify";

/** ---------- tiny format helpers ---------- **/
const pad2 = (n) => String(n).padStart(2, "0");

// Ensure value for <input type="date">
function toDateInputValue(src) {
  if (!src) return "";
  const d = src instanceof Date ? src : new Date(src);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Parse stored time like "09:00 AM" into pieces
function parseTimeLabel(label) {
  if (!label || typeof label !== "string") return { hh: "09", mm: "00", ap: "AM" };
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return { hh: "09", mm: "00", ap: "AM" };
  let [_, h, mm, ap] = m;
  return { hh: pad2(Number(h)), mm, ap: ap.toUpperCase() };
}

// Build the time label as "HH:MM AM/PM"
function toTimeLabel(hh, mm, ap) {
  const H = pad2(Number(hh) || 0);
  const M = pad2(Number(mm) || 0);
  const A = ap === "PM" ? "PM" : "AM";
  return `${H}:${M} ${A}`;
}

export default function EditTripForm({
  trip,
  onClose,
  onUpdated,
  isRequestMode = false, // when staff edits a Confirmed trip => send request for edit instead of direct update
}) {
  // ----- initial values (preserve existing) -----
  const [tripType, setTripType] = useState(trip?.tripType || "Day Trip");
  const [destination, setDestination] = useState(trip?.destination || "");
  const [students, setStudents] = useState(trip?.students ?? 0);
  const [notes, setNotes] = useState(trip?.notes || "");
  const [booster, setBooster] = useState(Boolean(trip?.booster || trip?.requestBooster));

  // Dates → ensure YYYY-MM-DD for the inputs
  const [date, setDate] = useState(toDateInputValue(trip?.date));
  const [returnDate, setReturnDate] = useState(toDateInputValue(trip?.returnDate));

  // Times → parse "09:00 AM" etc.
  const depParsed = useMemo(() => parseTimeLabel(trip?.departureTime), [trip?.departureTime]);
  const retParsed = useMemo(() => parseTimeLabel(trip?.returnTime), [trip?.returnTime]);

  const [depHH, setDepHH] = useState(depParsed.hh);
  const [depMM, setDepMM] = useState(depParsed.mm);
  const [depAP, setDepAP] = useState(depParsed.ap);

  const [retHH, setRetHH] = useState(retParsed.hh);
  const [retMM, setRetMM] = useState(retParsed.mm);
  const [retAP, setRetAP] = useState(retParsed.ap);

  const [submitting, setSubmitting] = useState(false);

  // If trip changes while modal is open, keep in sync
  useEffect(() => {
    setTripType(trip?.tripType || "Day Trip");
    setDestination(trip?.destination || "");
    setStudents(trip?.students ?? 0);
    setNotes(trip?.notes || "");
    setBooster(Boolean(trip?.booster || trip?.requestBooster));
    setDate(toDateInputValue(trip?.date));
    setReturnDate(toDateInputValue(trip?.returnDate));
    const dp = parseTimeLabel(trip?.departureTime);
    setDepHH(dp.hh); setDepMM(dp.mm); setDepAP(dp.ap);
    const rp = parseTimeLabel(trip?.returnTime);
    setRetHH(rp.hh); setRetMM(rp.mm); setRetAP(rp.ap);
  }, [trip]);

  const departureTimeLabel = toTimeLabel(depHH, depMM, depAP);
  const returnTimeLabel = toTimeLabel(retHH, retMM, retAP);

  const hours = Array.from({ length: 12 }, (_, i) => pad2(i === 0 ? 12 : i));
  const minutes = ["00", "15", "30", "45"];

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!destination || !date || !returnDate) {
      toast.error("Please fill destination, dates and times.");
      return;
    }

    const payload = {
      tripType,
      destination,
      students: Number(students) || 0,
      notes: notes || "",
      // Send plain date strings for backend + valid <input type="date">
      date,             // "YYYY-MM-DD"
      returnDate,       // "YYYY-MM-DD"
      departureTime: departureTimeLabel, // "HH:MM AM/PM"
      returnTime: returnTimeLabel,
      requestBooster: !!booster,
    };

    setSubmitting(true);
    try {
      if (isRequestMode) {
        // Staff editing a Confirmed trip -> create a request (fallback flags if endpoint missing)
        await requestTripEdit(trip.id, payload);
        toast.success("Edit request sent to the bus company.");
        onUpdated?.({ editRequested: true, editDraft: payload });
      } else {
        // Regular edit (Pending/Accepted etc.)
        await updateTrip(trip.id, payload);
        toast.success("Trip updated.");
        onUpdated?.(payload);
      }
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update trip. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalWrapper title={isRequestMode ? "Request Trip Edit" : "Edit Trip"} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Trip Type */}
        <div>
          <label className="block text-sm font-medium">Trip Type *</label>
          <select
            value={tripType}
            onChange={(e) => setTripType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option>Day Trip</option>
            <option>Sports Trip</option>
            <option>Academic Trip</option>
            <option>Other</option>
          </select>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium">Destination *</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        {/* Dates & Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Departure Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Departure Time *</label>
            <div className="flex gap-2">
              <select value={depHH} onChange={(e) => setDepHH(e.target.value)} className="p-2 border rounded">
                {hours.map((h) => <option key={h}>{h}</option>)}
              </select>
              <select value={depMM} onChange={(e) => setDepMM(e.target.value)} className="p-2 border rounded">
                {minutes.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={depAP} onChange={(e) => setDepAP(e.target.value)} className="p-2 border rounded">
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Return Date *</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Return Time *</label>
            <div className="flex gap-2">
              <select value={retHH} onChange={(e) => setRetHH(e.target.value)} className="p-2 border rounded">
                {hours.map((h) => <option key={h}>{h}</option>)}
              </select>
              <select value={retMM} onChange={(e) => setRetMM(e.target.value)} className="p-2 border rounded">
                {minutes.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={retAP} onChange={(e) => setRetAP(e.target.value)} className="p-2 border rounded">
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          </div>
        </div>

        {/* Students & Booster */}
        <div>
          <label className="block text-sm font-medium">Number of Students *</label>
          <input
            type="number"
            value={students}
            onChange={(e) => setStudents(e.target.value)}
            className="w-full p-2 border rounded"
            required
            min={0}
          />
        </div>

        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={booster} onChange={(e) => setBooster(e.target.checked)} />
          Request Booster Seats
        </label>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium">Additional Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Additional notes (optional)"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            {submitting ? (isRequestMode ? "Sending…" : "Saving…") : (isRequestMode ? "Send Request" : "Save Changes")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded transition"
          >
            Ignore Changes
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
