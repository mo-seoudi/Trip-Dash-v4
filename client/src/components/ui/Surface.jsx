import React from "react";

export function Surface({ children, className = "", padded = true }) {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${padded ? "p-5" : ""} ${className}`}>{children}</section>;
}

export function SectionHeader({ title, description, actions }) {
  return <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><h2 className="text-base font-semibold text-slate-950">{title}</h2>{description&&<p className="mt-0.5 text-sm text-slate-500">{description}</p>}</div>
    {actions&&<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}
