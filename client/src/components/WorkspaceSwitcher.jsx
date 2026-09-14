import React, { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiGrid, FiSearch } from "react-icons/fi";
import { useWorkspace } from "../context/WorkspaceContext";

export default function WorkspaceSwitcher() {
  const { workspaces, selectedWorkspace, isPortfolio, selectWorkspace, loading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

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
    selectWorkspace(id);
    setOpen(false);
    setQuery("");
  };

  if (loading) {
    return <div className="h-10 w-56 rounded-lg bg-gray-100 animate-pulse" aria-label="Loading workspaces" />;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-[220px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm hover:border-violet-300"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          {isPortfolio ? <FiGrid /> : (selectedWorkspace?.abbreviation || selectedWorkspace?.displayName?.slice(0, 2).toUpperCase())}
        </span>
        <span className="min-w-0 flex-1">
          <small className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {isPortfolio ? "Portfolio" : "School workspace"}
          </small>
          <strong className="block truncate text-sm text-gray-800">
            {isPortfolio ? "All permitted schools" : selectedWorkspace?.displayName}
          </strong>
        </span>
        <FiChevronDown className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <button
              type="button"
              onClick={() => choose("portfolio")}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${isPortfolio ? "bg-violet-50 text-violet-700" : "hover:bg-gray-50"}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100"><FiGrid /></span>
              <span><strong className="block text-sm">Portfolio</strong><small className="text-gray-500">{workspaces.length} permitted school{workspaces.length === 1 ? "" : "s"}</small></span>
            </button>
          </div>

          {workspaces.length > 5 && (
            <div className="border-b border-gray-100 p-2">
              <label className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-gray-500">
                <FiSearch />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a school…" className="w-full bg-transparent text-sm text-gray-800 outline-none" />
              </label>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.map((workspace) => {
              const selected = selectedWorkspace?.schoolId === workspace.schoolId;
              return (
                <button
                  key={workspace.schoolId}
                  type="button"
                  onClick={() => choose(workspace.schoolId)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-violet-50 text-violet-700" : "hover:bg-gray-50"}`}
                >
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-1 text-[11px] font-bold">
                    {workspace.abbreviation || workspace.displayName.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="min-w-0"><strong className="block truncate text-sm">{workspace.displayName}</strong><small className="text-gray-500">School workspace</small></span>
                </button>
              );
            })}
            {!filtered.length && <p className="px-3 py-4 text-center text-sm text-gray-500">No matching school workspace.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
