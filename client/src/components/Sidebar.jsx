import React, { useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FiGrid, FiCalendar, FiRepeat, FiActivity, FiDollarSign, FiShield } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const sidebar = useRef(null);
  const trigger = useRef(null);
  const { profile } = useAuth();
  const { can, access } = useWorkspace();
  const roles = Array.isArray(profile?.roles) ? profile.roles : profile?.role ? [profile.role] : [];
  const hasLegacyRole = role => roles.includes(role);
  const hasAccessModel = Boolean(access);
  const permitted = (permission, legacyRoles = []) => hasAccessModel ? can(permission) : legacyRoles.some(hasLegacyRole);

  const canReadTrips = permitted("trip.read", ["school_staff", "trip_manager", "bus_operator", "admin"]);
  const canCreateTrips = permitted("trip.create", ["school_staff", "trip_manager", "admin"]);
  const canReadFinance = permitted("finance.read", ["finance", "admin"]);
  const canAdmin = permitted("access.admin", ["admin"]);

  const sections = [
    ...(canReadTrips ? [{ label: "Workspace", links: [{ to: "/", label: "Overview", icon: FiGrid }] }] : []),
    ...(canReadTrips || canCreateTrips ? [{ label: "Bookings", links: [
      ...(canReadTrips ? [{ to: "/trips", label: "Single Bookings", icon: FiCalendar }] : []),
      ...(canCreateTrips ? [{ to: "/bookings", label: "Recurring Bookings", icon: FiRepeat }] : []),
    ] }] : []),
    ...(canReadTrips ? [{ label: "Operations", links: [{ to: "/trips", label: "Trips", icon: FiActivity }] }] : []),
    ...(canReadFinance ? [{ label: "Commercial", links: [{ to: "/finance", label: "Finance", icon: FiDollarSign }] }] : []),
    ...(canAdmin ? [{ label: "Administration", links: [{ to: "/admin", label: "Control Center", icon: FiShield }] }] : []),
  ];

  useEffect(() => { const handleClickOutside=e=>{if(!sidebar.current||!trigger.current||!sidebarOpen)return;if(sidebar.current.contains(e.target)||trigger.current.contains(e.target))return;setSidebarOpen(false)};document.addEventListener("click",handleClickOutside);return()=>document.removeEventListener("click",handleClickOutside)},[sidebarOpen,setSidebarOpen]);
  useEffect(() => { const handleEsc=e=>{if(sidebarOpen&&e.key==="Escape")setSidebarOpen(false)};document.addEventListener("keydown",handleEsc);return()=>document.removeEventListener("keydown",handleEsc)},[sidebarOpen,setSidebarOpen]);

  return <>
    <div className={`fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${sidebarOpen?"opacity-100":"pointer-events-none opacity-0"}`} aria-hidden="true" />
    <aside ref={sidebar} className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-slate-200 bg-white transform transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">TripDash</div><div className="text-sm font-semibold text-slate-900">Transport Operations</div></div>
        <button ref={trigger} onClick={()=>setSidebarOpen(false)} className="rounded-md p-1 text-xl text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Close navigation">×</button>
      </div>
      <nav className="space-y-6 px-3 py-5">
        {sections.map(section => section.links.length ? <div key={section.label}>
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{section.label}</div>
          <div className="space-y-1">{section.links.map(link => { const Icon=link.icon; return <NavLink key={`${section.label}-${link.label}`} to={link.to} end={link.to==="/"||link.to==="/admin"} className={({isActive})=>`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive?"bg-slate-900 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} onClick={()=>setSidebarOpen(false)}><Icon size={17}/><span>{link.label}</span></NavLink>})}</div>
        </div> : null)}
      </nav>
    </aside>
  </>;
}
export default Sidebar;
