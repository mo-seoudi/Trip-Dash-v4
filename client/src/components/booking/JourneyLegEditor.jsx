import React from "react";
import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../ui/Button";
import { FormField, TextArea, TextInput } from "../ui/FormControls";
import TimeSelector from "../ui/TimeSelector";

const makeStop = () => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, location: "", plannedTime: "", passengerCount: "", notes: "" });

export const makeJourneyLeg = (sequence = 1, defaults = {}) => ({
  id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  sequence,
  label: defaults.label || (sequence === 1 ? "Outbound journey" : `Journey ${sequence}`),
  origin: defaults.origin || "",
  destination: defaults.destination || "",
  departureTime: defaults.departureTime || "08:00 AM",
  arrivalTime: defaults.arrivalTime || "",
  notes: defaults.notes || "",
  stops: defaults.stops || [],
});

export default function JourneyLegEditor({ leg, index, total, onChange, onRemove, onMove }) {
  const set = (key, value) => onChange({ ...leg, [key]: value });
  const updateStop = (id, key, value) => set("stops", leg.stops.map(stop => stop.id === id ? { ...stop, [key]: value } : stop));
  const addStop = () => set("stops", [...leg.stops, makeStop()]);
  const removeStop = id => set("stops", leg.stops.filter(stop => stop.id !== id));
  const moveStop = (from, direction) => {
    const to = from + direction;
    if (to < 0 || to >= leg.stops.length) return;
    const next = [...leg.stops];
    [next[from], next[to]] = [next[to], next[from]];
    set("stops", next);
  };

  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Journey {index + 1}</div>
        <TextInput className="mt-1" value={leg.label} onChange={e => set("label", e.target.value)} aria-label={`Journey ${index + 1} label`} />
      </div>
      <div className="flex gap-1">
        {index > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onMove(index, -1)}><FiArrowUp />Move up</Button>}
        {index < total - 1 && <Button type="button" variant="ghost" size="sm" onClick={() => onMove(index, 1)}><FiArrowDown />Move down</Button>}
        {total > 1 && <Button type="button" variant="ghost" size="sm" onClick={onRemove}><FiTrash2 />Remove</Button>}
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="From"><TextInput value={leg.origin} onChange={e => set("origin", e.target.value)} required placeholder="Starting location" /></FormField>
      <FormField label="To"><TextInput value={leg.destination} onChange={e => set("destination", e.target.value)} required placeholder="Destination" /></FormField>
      <FormField label="Departure time"><TimeSelector value={leg.departureTime} onChange={value => set("departureTime", value)} /></FormField>
      <FormField label="Arrival time" optional><TimeSelector value={leg.arrivalTime || leg.departureTime} onChange={value => set("arrivalTime", value)} /></FormField>
    </div>

    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-semibold text-slate-900">Stops</div><div className="text-xs text-slate-500">Optional ordered pickup or drop-off points between From and To.</div></div>
        <Button type="button" variant="secondary" size="sm" onClick={addStop}><FiPlus />Add stop</Button>
      </div>
      {leg.stops.length > 0 && <div className="mt-3 space-y-2">
        {leg.stops.map((stop, stopIndex) => <div key={stop.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 lg:grid-cols-[36px_minmax(180px,1fr)_180px_110px_auto] lg:items-end">
          <div className="pb-2 text-center text-xs font-bold text-slate-400">{stopIndex + 1}</div>
          <FormField label="Location"><TextInput value={stop.location} onChange={e => updateStop(stop.id, "location", e.target.value)} placeholder="Pickup / drop-off point" /></FormField>
          <FormField label="Planned time" optional><TimeSelector value={stop.plannedTime || leg.departureTime} onChange={value => updateStop(stop.id, "plannedTime", value)} /></FormField>
          <FormField label="Passengers" optional><TextInput type="number" min="0" value={stop.passengerCount} onChange={e => updateStop(stop.id, "passengerCount", e.target.value)} /></FormField>
          <div className="flex gap-1 pb-1">
            <button type="button" disabled={stopIndex === 0} onClick={() => moveStop(stopIndex, -1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move stop up"><FiArrowUp /></button>
            <button type="button" disabled={stopIndex === leg.stops.length - 1} onClick={() => moveStop(stopIndex, 1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move stop down"><FiArrowDown /></button>
            <button type="button" onClick={() => removeStop(stop.id)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Remove stop"><FiTrash2 /></button>
          </div>
        </div>)}
      </div>}
    </div>

    <div className="mt-4"><FormField label="Journey notes" optional><TextArea rows="2" value={leg.notes} onChange={e => set("notes", e.target.value)} /></FormField></div>
  </section>;
}
