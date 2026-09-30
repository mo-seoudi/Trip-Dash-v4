import React from "react";

export default function IconButton({ icon: Icon, label, loading=false, disabled=false, className="", ...props }) {
  return <button type="button" title={label} aria-label={label} aria-busy={loading||undefined} disabled={disabled||loading} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>
    {loading?<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>:<Icon size={16}/>} 
  </button>;
}
