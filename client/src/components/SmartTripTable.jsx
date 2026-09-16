// src/components/SmartTripTable.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";
import { RxCaretSort, RxCaretUp, RxChevronDown, RxPerson } from "react-icons/rx";
import Pagination from "./Pagination";
import ModalWrapper from "./ModalWrapper";
import TripDetails from "./TripDetails";
import ActionsCell from "./actions/ActionsCell";
import ConfirmActionPopup from "./ConfirmActionPopup";
import AssignBusForm from "./AssignBusForm";
import FinaliseTrip from "./FinaliseTrip";
import { usePagination } from "../hooks/usePagination";
import useTripActions from "../hooks/useTripActions";
import PassengersPanel from "./trips/PassengersPanel";
import EditTripForm from "./EditTripForm";

const SmartTripTable = ({ trips, dateSortOrder, setDateSortOrder, readOnly = false }) => {
  const { activeWorkspace } = useAuth();
  const [tripData, setTripData] = React.useState([]);
  const [expandedTripId, setExpandedTripId] = React.useState(null);
  const [showDetailsTrip, setShowDetailsTrip] = React.useState(null);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [assignTrip, setAssignTrip] = React.useState(null);
  const [finaliseTrip, setFinaliseTrip] = React.useState(null);
  const [editTrip, setEditTrip] = React.useState(null);
  const [showPassengersTrip, setShowPassengersTrip] = React.useState(null);
  React.useEffect(() => { setTripData(trips || []); }, [trips]);
  const { paginatedData,currentPage,setCurrentPage,rowsPerPage,setRowsPerPage,jumpPageInput,setJumpPageInput,handleJump } = usePagination(tripData);
  const { handleStatusChange, handleSoftDelete } = useTripActions(activeWorkspace, setTripData, setExpandedTripId);
  const permissions=new Set(activeWorkspace?.permissions||[]);
  const canReadPassengers=permissions.has("passenger.read");
  const canManagePassengers=permissions.has("passenger.manage");
  const handleDateSortToggle=()=>{if(dateSortOrder==="")setDateSortOrder("asc");else if(dateSortOrder==="asc")setDateSortOrder("desc");else setDateSortOrder("");};
  const closeRow=()=>setExpandedTripId(null);
  const canSeePassengersButton=status=>canReadPassengers&&["Accepted","Quotation Submitted","Approved","Confirmed","Completed"].includes(status);
  const displayStatus=trip=>trip?.cancelRequest?"Cancel Requested":trip?.status;
  const applyUpdatedTrip=updated=>{if(!updated?.id)return;setTripData(prev=>prev.map(t=>t.id===updated.id?updated:t));window.dispatchEvent(new CustomEvent("trip:updated",{detail:updated}));closeRow();setShowDetailsTrip(updated);};
  return <div className="overflow-x-auto relative"><table className="min-w-full text-sm table-fixed"><thead className="bg-gray-100"><tr><th className="w-[160px] px-4 py-2 text-left">Trip Type</th><th className="w-[140px] px-4 py-2 text-left">Destination</th><th className="w-[90px] px-4 py-2 text-left">Students</th><th className="w-[160px] px-4 py-2 text-left cursor-pointer select-none" onClick={handleDateSortToggle}>Date <span className="inline-block w-4">{dateSortOrder===""&&<RxCaretSort/>}{dateSortOrder==="asc"&&"↑"}{dateSortOrder==="desc"&&"↓"}</span></th><th className="w-[100px] px-4 py-2 text-left">Time</th><th className="w-[130px] px-4 py-2 text-left">Status</th><th className="w-[50px] px-2 py-2"></th></tr></thead><tbody>
  {!paginatedData.length&&<tr><td colSpan={7} className="text-center py-4">No trips found.</td></tr>}
  {paginatedData.map(trip=><React.Fragment key={trip.id}><tr className={`border-b ${expandedTripId===trip.id?"bg-gray-50":"hover:bg-gray-50"} ${trip.status==="Pending"?"font-semibold":""}`}><td className="px-4 py-2">{trip.tripType}</td><td className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis"><button type="button" className="text-gray-900 hover:text-blue-700" onClick={()=>setShowDetailsTrip(trip)}>{trip.destination}</button></td><td className="px-4 py-2">{trip.students}</td><td className="px-4 py-2">{trip.date?new Date(trip.date).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"}):""}</td><td className="px-4 py-2">{trip.departureTime}</td><td className="px-4 py-2"><StatusBadge status={displayStatus(trip)}/></td><td className="px-2 py-2 text-center cursor-pointer text-gray-400 hover:text-blue-600" onClick={()=>setExpandedTripId(expandedTripId===trip.id?null:trip.id)}>{expandedTripId===trip.id?<RxCaretUp size={24}/>:<RxChevronDown size={24}/>}</td></tr>
  {expandedTripId===trip.id&&<tr className="bg-gray-50 border-b"><td colSpan={7} className="px-4 py-2"><div className="flex flex-col gap-2 sm:flex-row sm:gap-4"><ActionsCell trip={trip} onStatusChange={async(t,status)=>{try{const updated=await handleStatusChange(t,status);window.dispatchEvent(new CustomEvent("trip:updated",{detail:updated||{...t,status}}));setShowDetailsTrip(updated||{...t,status});closeRow();}catch(_){}}} onAssignBus={setAssignTrip} onFinaliseTrip={setFinaliseTrip} onConfirmAction={(t,label,nextStatus)=>setConfirmAction({trip:t,label,nextStatus})} onView={setShowDetailsTrip} onEdit={setEditTrip} onSoftDelete={handleSoftDelete}/>{canSeePassengersButton(trip.status)&&<button onClick={()=>setShowPassengersTrip(trip)} className="flex items-center px-2 py-1 border rounded text-sm font-semibold text-gray-700"><RxPerson className="mr-1"/>{canManagePassengers?"Manage Passengers":"View Passengers"}</button>}</div></td></tr>}</React.Fragment>)}
  </tbody></table><Pagination totalItems={tripData.length} rowsPerPage={rowsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} jumpPageInput={jumpPageInput} setJumpPageInput={setJumpPageInput} onJump={handleJump}/>
  {showDetailsTrip&&<ModalWrapper onClose={()=>setShowDetailsTrip(null)}><TripDetails trip={showDetailsTrip}/></ModalWrapper>}
  {assignTrip&&<ModalWrapper onClose={()=>setAssignTrip(null)}><AssignBusForm trip={assignTrip} onClose={()=>setAssignTrip(null)} onSubmit={updated=>{setAssignTrip(null);applyUpdatedTrip(updated);}}/></ModalWrapper>}
  {finaliseTrip&&<div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"><FinaliseTrip trip={finaliseTrip} onClose={()=>setFinaliseTrip(null)} onSubmit={updated=>{setFinaliseTrip(null);applyUpdatedTrip(updated);}}/></div>}
  {confirmAction&&<ConfirmActionPopup title={`${confirmAction.label} Trip`} description={`Are you sure you want to ${confirmAction.label.toLowerCase()} this trip?`} onConfirm={async()=>{const current=confirmAction;setConfirmAction(null);try{const updated=await handleStatusChange(current.trip,current.nextStatus);window.dispatchEvent(new CustomEvent("trip:updated",{detail:updated||{...current.trip,status:current.nextStatus}}));setShowDetailsTrip(updated||{...current.trip,status:current.nextStatus});}catch(_){}closeRow();}} onClose={()=>setConfirmAction(null)}/>} 
  {showPassengersTrip&&<ModalWrapper onClose={()=>setShowPassengersTrip(null)}><PassengersPanel trip={showPassengersTrip} onClose={()=>setShowPassengersTrip(null)} readOnly={!canManagePassengers}/></ModalWrapper>}
  {editTrip&&<ModalWrapper onClose={()=>setEditTrip(null)}><EditTripForm trip={editTrip} onClose={()=>setEditTrip(null)} onUpdated={updated=>{if(updated?.id){setTripData(prev=>prev.map(t=>t.id===updated.id?updated:t));window.dispatchEvent(new CustomEvent("trip:updated",{detail:updated}));setShowDetailsTrip(updated);}}}/></ModalWrapper>}
 </div>;
};export default SmartTripTable;
