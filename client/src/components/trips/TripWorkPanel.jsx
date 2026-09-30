import React from "react";
import { FiArrowLeft, FiCalendar, FiMapPin, FiUsers, FiX } from "react-icons/fi";
import StatusBadge from "../ui/StatusBadge";
import { AttentionBadge, getTripAttention } from "./TripAttention";
import ActionsCell from "../actions/ActionsCell";

export default function TripWorkPanel({trip,permissions,onClose,onView,onStatusChange,onWorkflowAction,onAssignBus,onConfirmAction,onEdit,onSoftDelete,onPassengers}){
 if(!trip)return null;const attention=getTripAttention(trip,permissions);const date=trip.date?new Date(trip.date).toLocaleDateString(undefined,{weekday:"short",year:"numeric",month:"short",day:"numeric"}):"Date not set";
 return <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-2xl sm:top-0">
  <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5"><div className="flex min-w-0 items-center gap-3"><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><FiArrowLeft/></button><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Trip work item</div><div className="truncate text-sm font-semibold text-slate-950">{trip.tripType||trip.destination||"Transport request"}</div></div></div><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close work panel"><FiX size={18}/></button></div>
  <div className="flex-1 overflow-y-auto p-5">
   <div className="flex flex-wrap items-center gap-2"><StatusBadge>{trip.cancelRequest?"Cancel Requested":trip.status}</StatusBadge><AttentionBadge attention={attention}/></div>
   <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">{trip.destination||trip.tripType||"Trip"}</h2>
   <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3"><FiCalendar className="text-slate-400"/>{date}{trip.departureTime?` · ${trip.departureTime}`:""}</div><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3"><FiUsers className="text-slate-400"/>{trip.students??trip.passengerCount??"—"} passengers</div><div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 sm:col-span-2"><FiMapPin className="text-slate-400"/>{trip.destination||"Destination not set"}</div></div>
   <div className={`mt-5 rounded-xl border p-4 ${attention.tone==="action"?"border-amber-200 bg-amber-50":"border-slate-200 bg-slate-50"}`}><div className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">{attention.label}</div><div className="mt-1 font-semibold text-slate-950">{attention.title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{attention.detail}</p></div>
   <div className="mt-6"><div className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-slate-400">Available actions</div><ActionsCell trip={trip} hideView onStatusChange={onStatusChange} onWorkflowAction={onWorkflowAction} onAssignBus={onAssignBus} onConfirmAction={onConfirmAction} onView={onView} onEdit={onEdit} onSoftDelete={onSoftDelete}/></div>
   {onPassengers&&<button onClick={()=>onPassengers(trip)} className="mt-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Open passenger record</button>}
   <button onClick={()=>onView?.(trip)} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline">Open full trip record <FiArrowRight/></button>
  </div>
 </aside>
}
