import React from "react";
import StatusBadge from "./StatusBadge";
import {EmptyState,LoadingState} from "./LoadingState";

export default function Timeline({items=[],loading=false,emptyTitle="No activity yet",emptyDescription="Activity will appear here as the record progresses."}){
 if(loading)return <LoadingState label="Loading activity…"/>;
 if(!items.length)return <EmptyState title={emptyTitle} description={emptyDescription}/>;
 return <ol className="divide-y divide-slate-100">{items.map((item,index)=><li key={item.id||`${item.title}-${index}`} className="relative flex gap-4 py-4 first:pt-0 last:pb-0"><div className="relative flex w-4 shrink-0 justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${item.tone==="success"?"bg-emerald-500":item.tone==="warning"?"bg-amber-500":item.tone==="danger"?"bg-red-500":item.tone==="info"?"bg-blue-500":"bg-slate-400"}`}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">{item.title}</div>{item.description&&<p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600">{item.description}</p>}</div>{item.status&&<StatusBadge tone={item.tone}>{item.status}</StatusBadge>}</div>{(item.actor||item.date)&&<div className="mt-2 text-xs text-slate-400">{item.actor}{item.actor&&item.date?" · ":""}{item.date}</div>}</div></li>)}</ol>;
}
