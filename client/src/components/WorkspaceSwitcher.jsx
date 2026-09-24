import React, { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";

export default function WorkspaceSwitcher() {
  const { workspaces, selectedWorkspace, selectWorkspace, loading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = workspaces.filter((workspace) => {
    const haystack = `${workspace.displayName} ${workspace.abbreviation || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const choose = (id) => {
    const changed = selectedWorkspace?.schoolId !== id;
    if (!selectWorkspace(id)) return;
    setOpen(false);
    setQuery("");
    if (changed && !location.pathname.startsWith("/admin")) navigate("/");
  };

  if (loading) return <div className="h-12 w-64 rounded-xl bg-gray-100 animate-pulse" aria-label="Loading workspaces" />;
  if (!selectedWorkspace) return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">No school workspace available</div>;

  const badge = selectedWorkspace.abbreviation || selectedWorkspace.displayName?.slice(0, 3).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-w-[280px] items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-left shadow-sm transition hover:border-violet-400 hover:bg-violet-50" aria-expanded={open}>
        <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-violet-600 px-1 text-[11px] font-bold text-white">{badge}</span>
        <span className="min-w-0 flex-1">
          <small className="block text-[10px] font-bold uppercase tracking-[0.14em] text-violet-500">Active school workspace</small>
          <strong className="block truncate text-sm text-gray-900">{selectedWorkspace.displayName}</strong>
        </span>
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:block">Switch</span>
        <FiChevronDown className={`text-violet-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <strong className="block text-sm text-gray-900">Switch school workspace</strong>
            <span className="text-xs text-gray-500">Trip data and actions remain isolated to the selected school.</span>
          </div>
          {workspaces.length > 5 && <div className="border-b border-gray-100 p-2"><label className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-500"><FiSearch /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a school…" className="w-full bg-transparent text-sm text-gray-800 outline-none" /></label></div>}
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.map((workspace) => {
              const selected = selectedWorkspace.schoolId === workspace.schoolId;
              return <button key={workspace.schoolId} type="button" onClick={() => choose(workspace.schoolId)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-violet-50 text-violet-800" : "hover:bg-gray-50"}`}>
                <span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-1 text-[11px] font-bold ${selected ? "bg-violet-600 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>{workspace.abbreviation || workspace.displayName.slice(0, 3).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{workspace.displayName}</strong><small className="text-gray-500">School workspace</small></span>
                {selected && <FiCheck className="text-violet-600" />}
              </button>;
            })}
            {!filtered.length && <p className="px-3 py-5 text-center text-sm text-gray-500">No matching school workspace.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
