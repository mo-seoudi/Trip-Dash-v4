// src/components/SmartTripTable.jsx
import React from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import StatusBadge from "./StatusBadge";
import { RxCaretSort, RxCaretUp, RxChevronDown, RxPerson } from "react-icons/rx";
import Pagination from "./Pagination";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import { usePagination } from "../hooks/usePagination";
import useTripActions from "../hooks/useTripActions";
import PassengersPanel from "./trips/PassengersPanel";
import EditTripForm from "./EditTripForm";

const SmartTripTable = ({ trips, dateSortOrder, setDateSortOrder, readOnly = false }) => {
  const { selectedWorkspace } = useWorkspace();
  const [tripData, setTripData] = React.useState([]);
  const [expandedTripId, setExpandedTripId] = React.useState(null);
  const [showDetailsTrip, setShowDetailsTrip] = React.useState(null);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null);
  const [showPassengersTrip, setShowPassengersTrip] = React.useState(null);
  React.useEffect(() => { setTripData(trips || []); }, [trips]);
  React.useEffect(() => { setExpandedTripId(null); setShowDetailsTrip(null); setConfirmAction(null); }, [selectedWorkspace?.schoolId]);
  const { paginatedData,currentPage,setCurrentPage,rowsPerPage,setRowsPerPage,jumpPageInput,setJumpPageInput,handleJump } = usePagination(tripData);
  const { loading:actionLoading, actionError, clearActionError, handleStatusChange, handleWorkflowAction, handleSoftDelete } = useTripActions(selectedWorkspace, setTripData, setExpandedTripId);
  const permissions=new Set(selectedWorkspace?.permissions||[]);
  const canReadPassengers=permissions.has("passenger.read");
  const canManagePassengers=permissions.has("passenger.manage");
  const passengerMutationStages=new Set(["Accepted","Quotation Submitted","Approved","Confirmed"]);
  const canMutatePassengers=trip=>canManagePassengers&&!trip?.cancelRequest&&passengerMutationStages.has(trip?.status);
  const handleDateSortToggle=()=>{if(dateSortOrder==="")setDateSortOrder("asc");else if(dateSortOrder==="asc")setDateSortOrder("desc");else setDateSortOrder("");};
  const closeRow=()=>setExpandedTripId(null);
  const canSeePassengersButton=status=>canReadPassengers&&["Accepted","Quotation Submitted","Approved","Confirmed","Completed"].includes(status);
  const displayStatus=trip=>trip?.cancelRequest?"Cancel Requested":trip?.status;
  const applyUpdatedTrip=updated=>{if(!updated?.id)return;setTripData(prev=>prev.map(t=>t.id===updated.id?{...t,...updated}:t));window.dispatchEvent(new CustomEvent("trip:updated",{detail:updated}));closeRow();};
  const runAction=async fn=>{clearActionError();const updated=await fn();if(updated)applyUpdatedTrip(updated);return updated;};
  return <div className="overflow-x-auto relative">
  {actionError&&<div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><strong>Trip action failed.</strong> {actionError}</div>}
  {actionLoading&&<div className="mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">Updating trip…</div>}
  <table className="min-w-full text-sm table-fixed"><thead className="bg-gray-100"><tr><th className="w-[160px] px-4 py-2 text-left">Trip Type</th><th className="w-[140px] px-4 py-2 text-left">Destination</th><th className="w-[90px] px-4 py-2 text-left">Students</th><th className="w-[160px] px-4 py-2 text-left cursor-pointer select-none" onClick={handleDateSortToggle}>Date <span className="inline-block w-4">{dateSortOrder===""&&<RxCaretSort/>}{dateSortOrder==="asc"&&"↑"}{dateSortOrder==="desc"&&"↓"}</span></th><th className="w-[100px] px-4 py-2 text-left">Time</th><th className="w-[130px] px-4 py-2 text-left">Status</th><th className="w-[50px] px-2 py-2"></th></tr></thead><tbody>
  {!paginatedData.length&&<tr><td colSpan={7} className="text-center py-4">No trips found.</td></tr>}
  {paginatedData.map(trip=><React.Fragment key={trip.id}><tr className={`border-b ${expandedTripId===trip.id?"bg-gray-50":"hover:bg-gray-50"} ${trip.status==="Pending"?"font-semibold":""}`}><td className="px-4 py-2">{trip.tripType}</td><td className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis"><button type="button" className="text-gray-900 hover:text-blue-700" onClick={()=>setShowDetailsTrip(trip)}>{trip.destination}</button></td><td className="px-4 py-2">{trip.students}</td><td className="px-4 py-2">{trip.date?new Date(trip.date).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}):""}</td><td className="px-4 py-2">{trip.departureTime}</td><td className="px-4 py-2"><StatusBadge status={displayStatus(trip)}/></td><td className="px-2 py-2 text-center cursor-pointer text-gray-400 hover:text-blue-600" onClick={()=>setExpandedTripId(expandedTripId===trip.id?null:trip.id)}>{expandedTripId===trip.id?<RxCaretUp size={24}/>:<RxChevronDown size={24}/>}</td></tr>
  {expandedTripId===trip.id&&<tr className="bg-gray-50 border-b"><td colSpan={7} className="px-4 py-2"><div className="flex flex-col gap-2 sm:flex-row sm:gap-4"><ActionsCell trip={trip} onStatusChange={(t,status)=>runAction(()=>handleStatusChange(t,status))} onWorkflowAction={(t,action)=>runAction(()=>handleWorkflowAction(t,action))} onAssignBus={setAssignTrip} onConfirmAction={(t,label,nextStatus,workflowAction)=>setConfirmAction({trip:t,label,nextStatus,workflowAction})} onView={setShowDetailsTrip} onEdit={setEditTrip} onSoftDelete={handleSoftDelete}/>{canSeePassengersButton(trip.status)&&<button onClick={()=>setShowPassengersTrip(trip)} className="flex items-center px-2 py-1 border rounded text-sm font-semibold text-gray-700"><RxPerson className="mr-1"/>{canMutatePassengers(trip)?"Manage Passengers":"View Passengers"}</button>}</div></td></tr>}</React.Fragment>)}
  </tbody></table><Pagination totalItems={tripData.length} rowsPerPage={rowsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} jumpPageInput={jumpPageInput} setJumpPageInput={setJumpPageInput} onJump={handleJump}/>
  {showDetailsTrip&&<ModalWrapper onClose={()=>setShowDetailsTrip(null)}><TripDetails trip={showDetailsTrip}/></ModalWrapper>}
  {assignTrip&&<AssignBusForm trip={assignTrip} onClose={()=>setAssignTrip(null)} onSubmit={updated=>{setAssignTrip(null);applyUpdatedTrip(updated);}}/>}
  {confirmAction&&<ConfirmActionPopup title={`${confirmAction.label} Trip`} description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`} onConfirm={async()=>{const current=confirmAction;setConfirmAction(null);try{await runAction(()=>current.workflowAction?handleWorkflowAction(current.trip,current.workflowAction):handleStatusChange(current.trip,current.nextStatus));}catch(_){/* error is rendered above */}} onClose={()=>setConfirmAction(null)}/>} 
  {showPassengersTrip&&<ModalWrapper onClose={()=>setShowPassengersTrip(null)}><PassengersPanel trip={showPassengersTrip} onClose={()=>setShowPassengersTrip(null)} readOnly={!canMutatePassengers(showPassengersTrip)}/></ModalWrapper>}
  {editTrip&&<EditTripForm trip={editTrip} onClose={()=>setEditTrip(null)} onUpdated={updated=>{setEditTrip(null);applyUpdatedTrip(updated);}}/>}
  </div>;
};
export default SmartTripTable;
