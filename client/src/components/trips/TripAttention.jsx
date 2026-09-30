import React from "react";
import { FiArrowRight, FiCheckCircle, FiClock, FiAlertCircle } from "react-icons/fi";

export function getTripAttention(trip, permissions = []) {
  const p = new Set(permissions || []);
  const status = trip?.cancelRequest ? "Cancel Requested" : trip?.status;
  const operator = p.has("trip.respond") || p.has("bus_assignment.manage");
  const school = p.has("trip.edit_request") && !operator;
  if (status === "Pending") return operator
    ? { tone:"action", label:"Your action", title:"Review request", detail:"Accept or reject this transport request." }
    : { tone:"waiting", label:"Waiting", title:"Provider review", detail:"The transport provider is reviewing this request." };
  if (status === "Accepted") return operator
    ? { tone:"action", label:"Your action", title:"Prepare quotation", detail:"Review requirements and submit transport pricing." }
    : { tone:"waiting", label:"Waiting", title:"Quotation preparation", detail:"The transport provider is preparing a quotation." };
  if (status === "Quotation Submitted") return school
    ? { tone:"action", label:"Your action", title:"Review quotation", detail:"A quotation is ready for school review." }
    : { tone:"waiting", label:"Waiting", title:"School approval", detail:"The quotation is awaiting school review." };
  if (status === "Approved") return operator
    ? { tone:"action", label:"Your action", title:"Finalize transport", detail:"Add final bus details and confirm the operation." }
    : { tone:"waiting", label:"Waiting", title:"Transport confirmation", detail:"The provider is finalizing transport details." };
  if (status === "Confirmed") return { tone:"scheduled", label:"Scheduled", title:"Ready to operate", detail:"Transport is confirmed for the scheduled date." };
  if (status === "Completed") return { tone:"done", label:"Complete", title:"Trip completed", detail:"No operational action is required." };
  if (["Rejected","Cancelled","Canceled"].includes(status)) return { tone:"closed", label:"Closed", title:status, detail:"This record is no longer active." };
  if (status === "Cancel Requested") return operator
    ? { tone:"action", label:"Your action", title:"Review cancellation", detail:"The school has requested cancellation." }
    : { tone:"waiting", label:"Waiting", title:"Cancellation review", detail:"The provider is reviewing the cancellation request." };
  return { tone:"neutral", label:"Current", title:status || "Trip", detail:"Open the record for details." };
}

const styles={action:"bg-amber-50 text-amber-800 ring-amber-200",waiting:"bg-blue-50 text-blue-700 ring-blue-200",scheduled:"bg-emerald-50 text-emerald-700 ring-emerald-200",done:"bg-slate-100 text-slate-600 ring-slate-200",closed:"bg-red-50 text-red-700 ring-red-200",neutral:"bg-slate-100 text-slate-600 ring-slate-200"};
const icons={action:FiAlertCircle,waiting:FiClock,scheduled:FiArrowRight,done:FiCheckCircle,closed:FiAlertCircle,neutral:FiArrowRight};
export function AttentionBadge({attention}){const Icon=icons[attention?.tone]||FiArrowRight;return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[attention?.tone]||styles.neutral}`}><Icon size={13}/>{attention?.label}</span>}
