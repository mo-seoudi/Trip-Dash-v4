import React from "react";

export function RecordField({label,children,icon:Icon,className=""}){return <div className={`min-w-0 ${className}`}><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{Icon&&<Icon size={12}/>}<span>{label}</span></div><div className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-800">{children??"—"}</div></div>}

export function WorkflowProgress({stages,current,aliases={}}){const index=stages.indexOf(current);if(index<0)return null;return <div className="overflow-x-auto"><div className="grid min-w-[620px] gap-2" style={{gridTemplateColumns:`repeat(${stages.length}, minmax(0, 1fr))`}}>{stages.map((stage,i)=><div key={stage}><div className={`mb-2 h-1.5 rounded-full ${i<index?"bg-emerald-400":i===index?"bg-slate-950":"bg-slate-200"}`}/><div className={`text-xs font-semibold ${i===index?"text-slate-950":"text-slate-500"}`}>{aliases[stage]||stage}</div></div>)}</div></div>}

export function RecordSectionLabel({children}){return <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{children}</div>}
