import React, { useState } from "react";
import { FiCalendar, FiList, FiSearch } from "react-icons/fi";
import TripFilters from "../components/TripFilters";
import dayjs from "dayjs";
import { useFilteredTrips } from "../hooks/useFilteredTrips";

const TripsLayout = ({ title = "Trips", trips = [], calendarComponent: CalendarViewComponent, tableComponent: TableViewComponent }) => {
  const [calendarMode, setCalendarMode] = useState(false);
  const { filteredTrips, search, setSearch, statusFilter, setStatusFilter, monthFilter, setMonthFilter, dateSortOrder, setDateSortOrder, resetFilters } = useFilteredTrips(trips);
  const uniqueMonths = Array.from(new Set((trips || []).map(trip => dayjs(trip.departureDate || trip.date || trip.returnDate).format("MMMM YYYY")))).sort((a,b)=>dayjs(b,"MMMM YYYY")-dayjs(a,"MMMM YYYY"));
  const statusOptions = ["Pending","Accepted","Confirmed","Completed","Canceled","Rejected"];

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-950">{title}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{filteredTrips.length}</span></div>
          <p className="mt-0.5 text-xs text-slate-500">Search, filter and switch between operational table and calendar views.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-none"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trips" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-[250px]"/></div>
          {CalendarViewComponent&&<div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button onClick={()=>setCalendarMode(false)} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${!calendarMode?"bg-white text-slate-950 shadow-sm":"text-slate-500 hover:text-slate-900"}`}><FiList size={14}/>Table</button>
            <button onClick={()=>setCalendarMode(true)} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${calendarMode?"bg-white text-slate-950 shadow-sm":"text-slate-500 hover:text-slate-900"}`}><FiCalendar size={14}/>Calendar</button>
          </div>}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3"><TripFilters search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} statusOptions={statusOptions} monthFilter={monthFilter} setMonthFilter={setMonthFilter} monthOptions={uniqueMonths} onReset={resetFilters} filteredData={filteredTrips}/></div>
    </div>
    <div className="relative min-h-[620px] w-full bg-white">{calendarMode&&CalendarViewComponent?<CalendarViewComponent trips={filteredTrips}/>:<TableViewComponent trips={filteredTrips} dateSortOrder={dateSortOrder} setDateSortOrder={setDateSortOrder}/>}</div>
  </section>;
};
export default TripsLayout;
