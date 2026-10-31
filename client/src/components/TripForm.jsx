import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { listBookingProviders } from "../services/bookingService";
import { createWorkspaceTrip } from "../services/tripService";
import { useAuth } from "../context/AuthContext";
import Button from "./ui/Button";
import FeedbackBanner from "./ui/FeedbackBanner";
import { FormField, SelectInput, TextArea, TextInput } from "./ui/FormControls";

const initialForm = {
  tripType: "Academic Trip", customType: "", origin: "School", destination: "", date: "",
  departureHour: "08", departureMinute: "00", departureAmPm: "AM", returnDate: "",
  returnHour: "08", returnMinute: "00", returnAmPm: "AM", students: "", staff: "",
  notes: "", boosterSeatsRequested: false, boosterSeatCount: "",
};

const TripForm = ({ onSuccess, onClose }) => {
  const { activeWorkspace } = useAuth();
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState("");
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState("");
  useEffect(() => {
    let active = true;
    setProvidersLoading(true); setProvidersError(""); setProviders([]); setProviderId("");
    if (!activeWorkspace?.schoolId) { setProvidersLoading(false); return; }
    listBookingProviders(activeWorkspace.schoolId).then(result => {
      if (!active) return;
      const rows = result.data || [];
      setProviders(rows);
      if (rows.length === 1) setProviderId(rows[0].id);
    }).catch(() => { if (active) setProvidersError("Could not load transport providers."); })
      .finally(() => { if (active) setProvidersLoading(false); });
    return () => { active = false; };
  }, [activeWorkspace?.schoolId]);

  useEffect(() => {
    setFormData((previous) => ({ ...previous, returnHour: previous.departureHour, returnMinute: previous.departureMinute, returnAmPm: previous.departureAmPm }));
  }, [formData.departureHour, formData.departureMinute, formData.departureAmPm]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  };

  const validateTimes = () => {
    const departure = new Date(`${formData.date} ${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`);
    const returning = new Date(`${formData.returnDate || formData.date} ${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`);
    if (returning <= departure) {
      setTimeError("Return must be later than departure.");
      return false;
    }
    setTimeError("");
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!activeWorkspace?.schoolId) {
      toast.error("Select a school workspace before requesting a trip.");
      return;
    }
    if (!validateTimes()) return;
    if (providersLoading || providersError || !providerId) { toast.error("A transport provider is required."); return; }
    setSubmitting(true);
    try {
      const payload = {
        transportProviderOrganizationId: providerId,
        tripType: formData.tripType === "Other" ? formData.customType : formData.tripType,
        origin: formData.origin || null,
        destination: formData.destination,
        date: formData.date,
        departureTime: `${formData.departureHour}:${formData.departureMinute} ${formData.departureAmPm}`,
        returnDate: formData.returnDate || formData.date,
        returnTime: `${formData.returnHour}:${formData.returnMinute} ${formData.returnAmPm}`,
        students: Number(formData.students),
        staff: formData.staff === "" ? null : Number(formData.staff),
        notes: formData.notes,
        boosterSeatsRequested: formData.boosterSeatsRequested,
        boosterSeatCount: formData.boosterSeatsRequested ? Number(formData.boosterSeatCount) : 0,
      };
      await createWorkspaceTrip(activeWorkspace.schoolId, payload);
      toast.success("Trip request submitted.");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to submit trip:", error);
      toast.error(error?.response?.data?.message || "Trip request could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const hours = Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];
  const types = ["Academic Trip", "Boarding House Trip", "Day Trip", "Sports Trip", "Other"];
  const timeFields = (prefix) => (
    <div className="grid grid-cols-3 gap-2">
      <SelectInput name={`${prefix}Hour`} value={formData[`${prefix}Hour`]} onChange={handleChange}>{hours.map((value) => <option key={value}>{value}</option>)}</SelectInput>
      <SelectInput name={`${prefix}Minute`} value={formData[`${prefix}Minute`]} onChange={handleChange}>{minutes.map((value) => <option key={value}>{value}</option>)}</SelectInput>
      <SelectInput name={`${prefix}AmPm`} value={formData[`${prefix}AmPm`]} onChange={handleChange}><option>AM</option><option>PM</option></SelectInput>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6 px-6 py-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Requesting for</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{activeWorkspace?.displayName || "No school workspace selected"}</div>
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-950">Transport provider</h3>
          {providersLoading ? <p className="text-sm text-slate-500">Loading providers…</p> :
            providersError ? <FeedbackBanner tone="error">{providersError}</FeedbackBanner> :
            !providers.length ? <FeedbackBanner tone="error">No active transport provider is linked to this school.</FeedbackBanner> :
            providers.length === 1 ? <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"><strong>{providers[0].name}</strong><span className="text-xs text-slate-500">Automatically assigned</span></div> :
            <FormField label="Select transport provider"><SelectInput value={providerId} onChange={event => setProviderId(event.target.value)} required><option value="">Select provider</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</SelectInput></FormField>}
        </section>

        <section className="space-y-4">
          <div><h3 className="text-sm font-semibold text-slate-950">Journey</h3><p className="mt-0.5 text-xs text-slate-500">Define the trip type and destination.</p></div>
          <FormField label="Trip type"><SelectInput name="tripType" value={formData.tripType} onChange={handleChange} required>{types.map((value) => <option key={value}>{value}</option>)}</SelectInput></FormField>
          {formData.tripType === "Other" && <FormField label="Custom trip type"><TextInput name="customType" value={formData.customType} onChange={handleChange} placeholder="Enter trip type" required /></FormField>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Origin"><TextInput name="origin" value={formData.origin} onChange={handleChange} /></FormField>
            <FormField label="Destination"><TextInput name="destination" value={formData.destination} onChange={handleChange} placeholder="Enter destination" required /></FormField>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <div><h3 className="text-sm font-semibold text-slate-950">Schedule</h3><p className="mt-0.5 text-xs text-slate-500">Set the departure and expected return.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Departure date"><TextInput type="date" name="date" value={formData.date} onChange={handleChange} required /></FormField>
            <FormField label="Departure time">{timeFields("departure")}</FormField>
            <FormField label="Return date"><TextInput type="date" name="returnDate" value={formData.returnDate || formData.date} onChange={handleChange} required /></FormField>
            <FormField label="Return time">{timeFields("return")}</FormField>
          </div>
          {timeError && <FeedbackBanner tone="error">{timeError}</FeedbackBanner>}
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <div><h3 className="text-sm font-semibold text-slate-950">Passengers</h3><p className="mt-0.5 text-xs text-slate-500">Record the expected travelling group and any booster-seat requirement.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Students"><TextInput type="number" min="0" name="students" value={formData.students} onChange={handleChange} required /></FormField>
            <FormField label="Staff" optional><TextInput type="number" min="0" name="staff" value={formData.staff} onChange={handleChange} /></FormField>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
            <input type="checkbox" name="boosterSeatsRequested" checked={formData.boosterSeatsRequested} onChange={handleChange} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
            <span><span className="block text-sm font-semibold text-slate-800">Booster seats required</span><span className="mt-0.5 block text-xs text-slate-500">Include booster seats in the transport request.</span></span>
          </label>
          {formData.boosterSeatsRequested && <FormField label="Number of booster seats"><TextInput type="number" min="1" name="boosterSeatCount" value={formData.boosterSeatCount} onChange={handleChange} required /></FormField>}
        </section>

        <section className="border-t border-slate-100 pt-5">
          <FormField label="Additional notes" optional hint="Add operational information the transport team should know."><TextArea name="notes" rows="4" value={formData.notes} onChange={handleChange} /></FormField>
        </section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={providersLoading || Boolean(providersError) || !providerId} loading={submitting}>Submit request</Button>
      </div>
    </form>
  );
};

export default TripForm;
