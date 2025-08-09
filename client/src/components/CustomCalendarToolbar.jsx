import React from "react";
import { RxChevronLeft, RxChevronRight } from "react-icons/rx";

export default function CustomCalendarToolbar({ label, onNavigate, onView, views, view }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-white text-gray-700">

      {/* Left: Today button */}
      <div>
        <button
          onClick={() => onNavigate("TODAY")}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Today
        </button>
      </div>

      {/* Center: Month name with fixed-position chevrons */}
      <div className="flex items-center justify-center gap-4 w-[300px]">
        <button
          onClick={() => onNavigate("PREV")}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <RxChevronLeft size={18} />
        </button>
        <span className="font-semibold text-lg text-center w-[160px]">
          {label}
        </span>
        <button
          onClick={() => onNavigate("NEXT")}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <RxChevronRight size={18} />
        </button>
      </div>

      {/* Right: View toggle buttons (Month / Week / Day / Agenda) */}
      <div className="flex gap-2">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`px-3 py-1 text-sm rounded border ${
              v === view ? "bg-violet-100 text-violet-600 font-medium" : "hover:bg-gray-100"
            }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
