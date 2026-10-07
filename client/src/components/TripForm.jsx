import "./workflow/workflow.css";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
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
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeError, setTimeError] = useState("");

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
    if (step < 3) { if (step === 1 && !validateTimes()) return; setStep(step + 1); return; }
    if (!validateTimes()) return;
    setSubmitting(true);
    try {
      const payload = {
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
      <div className="space-y-6 px-6 py-5"><ol className="flex flex-wrap gap-2" aria-label="Booking steps">{["Journey","Schedule","Passengers","Review"].map((label,i)=><li key={label}><button type="button" disabled={i>step} aria-current={i===step?"step":undefined} onClick={()=>setStep(i)} className={`rounded-full px-3 py-2 text-xs font-semibold ${i===step?"bg-indigo-600 text-white":"bg-slate-100 text-slate-500"}`}>{i+1}. {label}</button></li>)}</ol>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Requesting for</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{activeWorkspace?.displayName || "No school workspace selected"}</div>
        </div>

        <fieldset hidden={step!==0} disabled={step!==0} className="space-y-4">
          <div><h3 className="text-sm font-semibold text-slate-950">Journey</h3><p className="mt-0.5 text-xs text-slate-500">Define the trip type and destination.</p></div>
          <FormField label="Trip type"><SelectInput name="tripType" value={formData.tripType} onChange={handleChange} required>{types.map((value) => <option key={value}>{value}</option>)}</SelectInput></FormField>
          {formData.tripType === "Other" && <FormField label="Custom trip type"><TextInput name="customType" value={formData.customType} onChange={handleChange} placeholder="Enter trip type" required /></FormField>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Origin"><TextInput name="origin" value={formData.origin} onChange={handleChange} /></FormField>
            <FormField label="Destination"><TextInput name="destination" value={formData.destination} onChange={handleChange} placeholder="Enter destination" required /></FormField>
          </div>
        </fieldset>

        <fieldset hidden={step!==1} disabled={step!==1} className="space-y-4">
          <div><h3 className="text-sm font-semibold text-slate-950">Schedule</h3><p className="mt-0.5 text-xs text-slate-500">Set the departure and expected return.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Departure date"><TextInput type="date" name="date" value={formData.date} onChange={handleChange} required /></FormField>
            <FormField label="Departure time">{timeFields("departure")}</FormField>
            <FormField label="Return date"><TextInput type="date" name="returnDate" value={formData.returnDate || formData.date} onChange={handleChange} required /></FormField>
            <FormField label="Return time">{timeFields("return")}</FormField>
          </div>
          {timeError && <FeedbackBanner tone="error">{timeError}</FeedbackBanner>}
        </fieldset>

        <fieldset hidden={step!==2} disabled={step!==2} className="space-y-4">
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
        </fieldset>

        <fieldset hidden={step!==2} disabled={step!==2} className="border-t border-slate-100 pt-5">
          <FormField label="Additional notes" optional hint="Add operational information the transport team should know."><TextArea name="notes" rows="4" value={formData.notes} onChange={handleChange} /></FormField>
        </fieldset>
        {step===3&&<div className="td-booking-review"><h3>Review your trip request</h3><p><strong>{formData.origin||"School"} → {formData.destination}</strong></p><p>{formData.date} · {formData.departureHour}:{formData.departureMinute} {formData.departureAmPm}<br/>Return {formData.returnDate||formData.date} · {formData.returnHour}:{formData.returnMinute} {formData.returnAmPm}</p><p>{Number(formData.students||0)+Number(formData.staff||0)} passengers{formData.boosterSeatsRequested?` · ${formData.boosterSeatCount} booster seats`:""}</p>{formData.notes&&<p className="whitespace-pre-wrap">{formData.notes}</p>}<p>The request will be sent to the provider for review.</p></div>}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
        {step>0&&<Button type="button" variant="secondary" disabled={submitting} onClick={()=>setStep(step-1)}>Back</Button>}<Button type="submit" loading={submitting}>{step===3?"Submit request":"Continue →"}</Button>
      </div>
    </form>
  );
};

export default TripForm;
