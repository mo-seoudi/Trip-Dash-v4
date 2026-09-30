import React from "react";
import { NavLink } from "react-router-dom";
import { FiGrid, FiUsers, FiDatabase } from "react-icons/fi";

const items=[
  {to:"/admin/platform",label:"Platform",icon:FiGrid},
  {to:"/admin/access",label:"Access & Directory",icon:FiUsers},
];

export default function AdminNav(){return <nav aria-label="Control Center" className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-1">{items.map(({to,label,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${isActive?"bg-white text-slate-950 shadow-sm":"text-slate-500 hover:text-slate-900"}`}><Icon size={14}/>{label}</NavLink>)}</nav>}
