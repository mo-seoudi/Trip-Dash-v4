// client/src/components/TripDetails.jsx
import React from "react";
import StatusBadge from "./StatusBadge";
import { useAuth } from "../context/AuthContext";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import EditTripForm from "./EditTripForm";
import PassengersPanel from "./trips/PassengersPanel";
import useTripActions from "../hooks/useTripActions";
import { RxPerson } from "react-icons/rx";
import ModalWrapper from "./ModalWrapper";

function EmailPopover({ email = "-", onClose }) {
  const ref = React.useRef(null);
  const [copyState, setCopyState] = React.useState("idle");
  React.useEffect(() => {
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onKey = e => e.key === "Escape" && onClose?.();
    document.addEventListener("mousedown", onClick); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const onCopy = async () => { try { await navigator.clipboard.writeText(email || ""); setCopyState("success"); setTimeout(()=>setCopyState("idle"),1200); } catch { setCopyState("error"); setTimeout(()=>setCopyState("idle"),1500); } };
  return <div ref={ref} className="absolute z-[200] mt-1 right-0 w-64 rounded border bg-white shadow p-3 text-sm" role="dialog" aria-label="Requester email"><div className="font-mono break-all">{email||"-"}</div><div className="mt-2 flex justify-end"><button type="button" onClick={onCopy} disabled={copyState==="success"} className="px-2 py-1 rounded border hover:bg-gray-50">{copyState==="success"?"Copied!":copyState==="error"?"Retry":"Copy"}</button></div></div>;
}

function TripDetails({ trip }) {
  if (!trip) return null;
  const { activeWorkspace } = useAuth();
  const permissions = new Set(activeWorkspace?.permissions || []);
  const canReadPassengers = permissions.has("passenger.read");
  const canManagePassengers = permissions.has("passenger.manage");
  const [currentTrip,setCurrentTrip]=React.useState(trip); React.useEffect(()=>setCurrentTrip(trip),[trip]);
  const [,setSink]=React.useState([]); const {handleStatusChange,handleSoftDelete}=useTripActions(activeWorkspace,setSink);
  const [confirmAction,setConfirmAction]=React.useState(null),[assignTrip,setAssignTrip]=React.useState(null),[editTrip,setEditTrip]=React.useState(null),[showPassengersTrip,setShowPassengersTrip]=React.useState(null),[showRequesterEmail,setShowRequesterEmail]=React.useState(false);
  const patchTrip=updated=>{if(!updated)return;setCurrentTrip(prev=>({...prev,...updated}));try{window.dispatchEvent(new CustomEvent("trip:updated",{detail:{...currentTrip,...updated}}));}catch{}};
  const canSeePassengersButton=canReadPassengers&&["Accepted","Confirmed","Completed"].includes(currentTrip?.status);
  const buses=Array.isArray(currentTrip.buses)?currentTrip.buses:[];
  const formatDate=s=>{if(!s)return"-";const d=new Date(s);if(Number.isNaN(d.getTime()))return String(s);return `${String(d.getDate()).padStart(2,"0")}-${d.toLocaleString("default",{month:"short"})}-${d.getFullYear()}`;};
  const extractRequester=t=>({name:t?.requesterName||t?.requestedByName||t?.createdByName||t?.ownerName||t?.requester?.name||t?.requestedBy?.name||t?.createdBy?.name||t?.owner?.name||"—",email:t?.requesterEmail||t?.requestedByEmail||t?.createdByEmail||t?.ownerEmail||t?.requester?.email||t?.requestedBy?.email||t?.createdBy?.email||t?.owner?.email||""});
  const {name:requesterName,email:requesterEmail}=extractRequester(currentTrip);
  const students=currentTrip.students??"—",staffNum=currentTrip.staff!=null&&!Number.isNaN(Number(currentTrip.staff))?Number(currentTrip.staff):null,studentsNum=!Number.isNaN(Number(students))?Number(students):null,total=(studentsNum??0)+(Number.isFinite(staffNum)?staffNum:0);
  const origin=currentTrip.origin||currentTrip.from||currentTrip.startLocation||currentTrip.pickup||"School",destination=currentTrip.destination||currentTrip.to||currentTrip.endLocation||"—";
  return <div className="space-y-4"><div><h2 className="text-xl font-bold mb-2">Trip Summary</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border [&_strong]:font-medium">
    <div><strong>Trip Type:</strong> {currentTrip.tripType==="Other"?currentTrip.customType:currentTrip.tripType}</div><div className="relative"><strong>Requested by:</strong> <button type="button" className="text-blue-600 hover:underline font-medium" onClick={()=>setShowRequesterEmail(s=>!s)}>{requesterName}</button>{showRequesterEmail&&<EmailPopover email={requesterEmail} onClose={()=>setShowRequesterEmail(false)}/>}</div>
    <div><strong>Origin:</strong> {origin}</div><div><strong>Destination:</strong> {destination}</div><div><strong>Departure:</strong> {formatDate(currentTrip.date)} <span className="text-gray-500">at</span> {currentTrip.departureTime||"-"}</div><div><strong>Return:</strong> {formatDate(currentTrip.returnDate)} <span className="text-gray-500">at</span> {currentTrip.returnTime||"-"}</div>
    <div><strong>Students:</strong> {students}<span className="ml-4"><strong>Staff:</strong> {staffNum!=null?staffNum:<span className="text-gray-400">not set</span>}</span></div><div><strong>Passengers (Total):</strong> {Number.isFinite(total)&&total>0?total:"—"}</div>
    {!!currentTrip.boosterSeatsRequested&&Number(currentTrip.boosterSeatCount||0)>0&&<div className="sm:col-span-2"><strong>Booster Seats:</strong> {Number(currentTrip.boosterSeatCount)}</div>}{currentTrip.notes&&<div className="sm:col-span-2"><strong>Notes:</strong> {currentTrip.notes}</div>}<div className="sm:col-span-2 flex items-center"><strong className="mr-1">Status:</strong><StatusBadge status={currentTrip.status}/></div>
  </div></div>
  <div className="pt-1"><div className="flex flex-col gap-2 sm:flex-row sm:gap-4"><ActionsCell trip={currentTrip} hideView onStatusChange={async(t,s)=>{const updated=await handleStatusChange(t,s);patchTrip(updated);}} onAssignBus={setAssignTrip} onConfirmAction={(t,label,nextStatus)=>setConfirmAction({trip:t,label,nextStatus})} onEdit={setEditTrip} onSoftDelete={handleSoftDelete}/>{canSeePassengersButton&&<button onClick={()=>setShowPassengersTrip(currentTrip)} className="flex items-center px-2 py-1 border rounded text-sm font-semibold text-gray-700"><RxPerson className="mr-1"/>{canManagePassengers?"Manage Passengers":"View Passengers"}</button>}</div></div>
  {buses.length>0&&<><hr className="my-2 border-gray-300"/><div><h3 className="text-lg font-semibold mb-2">Assigned Buses</h3><div className="space-y-3">{buses.map((bus,index)=><div key={bus.id||index} className="bg-white border rounded p-4 shadow-sm"><p className="font-medium mb-1">Bus #{index+1}</p><div className="grid grid-cols-2 gap-3 text-sm"><div><strong>Type:</strong> {bus.busType}</div><div><strong>Seats:</strong> {bus.busSeats}</div>{bus.tripPrice!=null&&<div><strong>Price:</strong> AED {bus.tripPrice}</div>}{bus.driverName&&<div><strong>Driver Name:</strong> {bus.driverName}</div>}{bus.driverPhone&&<div><strong>Driver Phone:</strong> {bus.driverPhone}</div>}<div className="flex items-center"><strong className="mr-1">Status:</strong><StatusBadge status={bus.status||currentTrip.status}/></div></div></div>)}</div></div></>}
  {assignTrip&&<div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"><AssignBusForm trip={assignTrip} onClose={()=>setAssignTrip(null)} onSubmit={updated=>{setAssignTrip(null);patchTrip(updated);}}/></div>}
  {confirmAction&&<ConfirmActionPopup title={`${confirmAction.label} Trip`} description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`} onConfirm={async()=>{const current=confirmAction;setConfirmAction(null);const updated=await handleStatusChange(current.trip,current.nextStatus);patchTrip(updated);}} onClose={()=>setConfirmAction(null)}/>} 
  {editTrip&&<div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"><EditTripForm trip={editTrip} onClose={()=>setEditTrip(null)} onUpdated={updated=>{setEditTrip(null);if(updated)patchTrip(updated);}}/></div>}
  {showPassengersTrip&&<ModalWrapper onClose={()=>setShowPassengersTrip(null)}><PassengersPanel trip={showPassengersTrip} readOnly={!canManagePassengers}/></ModalWrapper>}
  </div>;
}
export default TripDetails;
