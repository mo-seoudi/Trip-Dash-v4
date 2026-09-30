import React from "react";
import { FiArrowLeft } from "react-icons/fi";

export default function PageHeader({ context, title, description, actions, backLabel, onBack, meta }) {
  return (
    <header className="border-b border-slate-200 pb-5">
      {onBack && <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-950"><FiArrowLeft size={14}/>{backLabel || "Back"}</button>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {context && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{context}</div>}
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
