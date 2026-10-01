import React from "react";
import { SelectInput } from "./FormControls";

const hours=Array.from({length:12},(_,i)=>(i+1).toString().padStart(2,"0"));
const minutes=["00","15","30","45"];
export const parseDisplayTime=(value,fallback="08:00 AM")=>{const raw=String(value||fallback).trim(),match=raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!match)return{hour:"08",minute:"00",ampm:"AM"};return{hour:match[1].padStart(2,"0"),minute:match[2],ampm:match[3].toUpperCase()}};
export default function TimeSelector({value,onChange,disabled=false}){const parsed=parseDisplayTime(value);const emit=next=>onChange?.(`${next.hour}:${next.minute} ${next.ampm}`);return <div className="grid grid-cols-3 gap-2"><SelectInput value={parsed.hour} disabled={disabled} onChange={e=>emit({...parsed,hour:e.target.value})}>{hours.map(v=><option key={v}>{v}</option>)}</SelectInput><SelectInput value={parsed.minute} disabled={disabled} onChange={e=>emit({...parsed,minute:e.target.value})}>{minutes.map(v=><option key={v}>{v}</option>)}</SelectInput><SelectInput value={parsed.ampm} disabled={disabled} onChange={e=>emit({...parsed,ampm:e.target.value})}><option>AM</option><option>PM</option></SelectInput></div>}
