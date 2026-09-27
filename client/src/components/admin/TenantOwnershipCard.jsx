import React,{useEffect,useState}from"react";
import{FiArrowRight,FiShield}from"react-icons/fi";
import{toast}from"react-toastify";
import api from"@/services/apiClient";

export default function TenantOwnershipCard({organizationId,onChanged}){
 const [state,setState]=useState(null),[target,setTarget]=useState(""),[confirming,setConfirming]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await api.get(`/platform-control/organizations/${encodeURIComponent(organizationId)}/tenant-ownership`);setState(r.data);setTarget(r.data?.tenant?.id||"");}catch(e){toast.error(e?.response?.data?.message||"Could not load tenant ownership");}finally{setLoading(false)}};
 useEffect(()=>{load()},[organizationId]);
 if(loading)return <div className="py-5 text-sm text-slate-400">Loading tenant ownership…</div>;
 if(!state)return <div className="py-5 text-sm text-red-500">Tenant ownership could not be loaded.</div>;
 const current=state.tenant,changed=target&&target!==current?.id,targetTenant=(state.available_tenants||[]).find(t=>t.id===target);
 const submit=async()=>{if(!changed)return;setSaving(true);try{await api.put(`/platform-control/organizations/${encodeURIComponent(organizationId)}/tenant-ownership`,{tenantId:target});toast.success(current?"Organization transferred to new tenant":"Tenant assigned");setConfirming(false);await load();await onChanged?.();}catch(e){toast.error(e?.response?.data?.message||"Could not change tenant");}finally{setSaving(false)}};
 return <div className="space-y-4">
  {state.invalid_multiple_owners&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This legacy organization is linked to more than one tenant. Assigning a tenant below will repair it to one owner.</div>}
  <div className={`rounded-xl border p-4 ${current?"border-slate-200":"border-amber-200 bg-amber-50/50"}`}>
   <div className="flex items-start gap-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><FiShield/></span><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current tenant</div><div className="mt-1 font-semibold text-slate-900">{current?.name||"No tenant assigned"}</div><div className="mt-1 text-xs text-slate-500">{current?"Top-level account owner for this organization.":"Legacy organization — assign a tenant to complete its setup."}</div></div></div>
  </div>
  <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium text-slate-700">{current?"Move to tenant":"Assign tenant"}<select value={target} onChange={e=>{setTarget(e.target.value);setConfirming(false)}} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"><option value="">Select tenant…</option>{(state.available_tenants||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" disabled={!changed} onClick={()=>setConfirming(true)} className="h-10 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{current?"Change tenant":"Assign tenant"}</button></div>
  {confirming&&targetTenant&&<div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4"><div className="text-sm font-semibold text-slate-900">{current?"Confirm tenant transfer":"Confirm tenant assignment"}</div><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600"><b>{current?.name||"No tenant"}</b><FiArrowRight/><b>{targetTenant.name}</b></div><p className="mt-2 text-xs leading-5 text-slate-500">Organization memberships and organization roles stay with the organization. Tenant-level access does not automatically move.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>setConfirming(false)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?"Saving…":current?"Confirm transfer":"Confirm assignment"}</button></div></div>}
 </div>;
}
