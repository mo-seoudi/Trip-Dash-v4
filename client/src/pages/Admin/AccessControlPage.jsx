import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiUsers, FiGrid, FiShield, FiDatabase, FiLink2 } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";
import UserAccessEditor from "@/components/admin/UserAccessEditor";
import RelationshipEditor from "@/components/admin/RelationshipEditor";
import DataSourceEditor from "@/components/admin/DataSourceEditor";
import OrganizationEditor from "@/components/admin/OrganizationEditor";

const TABS = [["users","Users",FiUsers],["organizations","Organizations",FiGrid],["relationships","Relationships",FiLink2],["data-sources","Data Sources",FiDatabase],["roles","Roles & Access",FiShield]];
const TENANT_STORAGE_KEY = "tripdash:control-center:tenant";
function Pill({children}){return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>}
function Empty({children}){return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>}

function AccessControlPage(){
  const [tenants,setTenants]=useState([]),[tenantId,setTenantId]=useState("");
  const [tab,setTab]=useState("users"),[data,setData]=useState(null),[roles,setRoles]=useState([]),[dataSources,setDataSources]=useState([]),[loading,setLoading]=useState(false),[tenantsLoading,setTenantsLoading]=useState(true),[dataSourcesLoading,setDataSourcesLoading]=useState(false),[search,setSearch]=useState("");

  useEffect(()=>{let active=true;(async()=>{setTenantsLoading(true);try{const response=await api.get("/access-admin/tenants");if(!active)return;const next=Array.isArray(response.data)?response.data:[];setTenants(next);const saved=window.localStorage.getItem(TENANT_STORAGE_KEY);const selected=next.some(item=>item.id===saved)?saved:(next[0]?.id||"");setTenantId(selected)}catch(error){if(active)toast.error(error?.response?.data?.message||"Could not load Control Center scopes")}finally{if(active)setTenantsLoading(false)}})();return()=>{active=false}},[]);

  const load=async()=>{if(!tenantId)return;setLoading(true);try{const [overviewResponse,rolesResponse]=await Promise.all([api.get("/access-admin/overview",{params:{tenant_id:tenantId}}),api.get("/access-admin/roles")]);setData(overviewResponse.data);setRoles(Array.isArray(rolesResponse.data)?rolesResponse.data:[])}catch(error){toast.error(error?.response?.data?.message||"Could not load access control")}finally{setLoading(false)}};
  const loadDataSources=async()=>{if(!tenantId)return;setDataSourcesLoading(true);try{const response=await api.get("/data-sources",{params:{tenant_id:tenantId}});setDataSources(Array.isArray(response.data)?response.data:[])}catch(error){toast.error(error?.response?.data?.message||"Could not load operational data sources")}finally{setDataSourcesLoading(false)}};
  const refreshAll=async()=>Promise.all([load(),loadDataSources()]);
  useEffect(()=>{if(!tenantId){setData(null);setDataSources([]);return}window.localStorage.setItem(TENANT_STORAGE_KEY,tenantId);setSearch("");load();loadDataSources()},[tenantId]);

  const membershipsByUser=useMemo(()=>{const map=new Map();for(const membership of data?.memberships||[]){const list=map.get(membership.user_id)||[];list.push(membership);map.set(membership.user_id,list)}return map},[data]);
  const assignmentsByUser=useMemo(()=>{const map=new Map();for(const assignment of data?.role_assignments||[]){const list=map.get(assignment.user_id)||[];list.push(assignment);map.set(assignment.user_id,list)}return map},[data]);
  const q=search.trim().toLowerCase(); const users=(data?.users||[]).filter(u=>!q||`${u.display_name||""} ${u.email||""}`.toLowerCase().includes(q));

  if(tenantsLoading)return <div className="p-6"><div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading Control Center…</div></div>;
  if(!tenants.length)return <div className="p-6"><Empty>This account does not have an administrative tenant scope. A platform Super Admin or Tenant Admin assignment is required.</Empty></div>;

  return <div className="space-y-5 p-4 md:p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Administration</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Control Center</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Manage users, organization access, relationships and operational database connections from the canonical control plane.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="text-xs font-medium text-slate-500"><span className="mr-2">Administration scope</span><select value={tenantId} onChange={e=>setTenantId(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-violet-500">{tenants.map(tenant=><option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label><button onClick={refreshAll} disabled={loading||dataSourcesLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={loading||dataSourcesLoading?"animate-spin":""}/> Refresh</button></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[[data?.users?.length||0,"Users"],[data?.organizations?.length||0,"Organizations"],[data?.memberships?.length||0,"Memberships"],[data?.role_assignments?.length||0,"Role assignments"],[dataSources.length,"Data sources"]].map(([value,label])=><div key={label} className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}</div>
    <div className="rounded-xl border bg-white shadow-sm"><div className="flex gap-1 overflow-x-auto border-b p-2">{TABS.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={`inline-flex whitespace-nowrap items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab===key?"bg-violet-50 text-violet-700":"text-slate-600 hover:bg-slate-50"}`}><Icon/> {label}</button>)}</div><div className="p-4">
      {(tab==="users"||tab==="organizations")&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab}...`} className="mb-4 w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"/>}
      {loading&&!data?<div className="py-10 text-center text-sm text-slate-500">Loading access model…</div>:null}
      {tab==="users"&&data&&<div className="space-y-3">{users.map(user=><article key={user.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="font-semibold text-slate-900">{user.display_name||user.email}</div><div className="text-sm text-slate-500">{user.email}</div></div><Pill>{user.status||"UNKNOWN"}</Pill></div><UserAccessEditor user={user} memberships={membershipsByUser.get(user.id)||[]} roleAssignments={assignmentsByUser.get(user.id)||[]} organizations={data.organizations||[]} roles={roles} tenantId={tenantId} onChanged={load}/></article>)}{!users.length&&<Empty>No users match this search.</Empty>}</div>}
      {tab==="organizations"&&data&&<OrganizationEditor tenantId={tenantId} organizations={data.organizations||[]} search={search} onChanged={load}/>} 
      {tab==="relationships"&&data&&<div className="space-y-3"><RelationshipEditor organizations={data.organizations||[]} relationships={data.relationships||[]} onChanged={load}/>{data.capabilities?.note&&<div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{data.capabilities.note}</div>}</div>}
      {tab==="data-sources"&&data&&<DataSourceEditor organizations={data.organizations||[]} dataSources={dataSources} loading={dataSourcesLoading} onChanged={loadDataSources}/>} 
      {tab==="roles"&&data&&<div className="space-y-4"><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">These roles and permissions come from the canonical Control Plane. Assign roles to users from the Users tab at platform, tenant, or organization scope.</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roles.map(role=><div key={role.id||role.key} className="rounded-xl border p-4"><div className="font-semibold text-slate-900">{role.name}</div><div className="mt-1 font-mono text-xs text-slate-400">{role.key}</div>{role.description&&<div className="mt-2 text-xs text-slate-500">{role.description}</div>}<div className="mt-3 flex flex-wrap gap-1">{(role.permissions||[]).map(permission=><Pill key={permission}>{permission}</Pill>)}</div></div>)}</div></div>}
    </div></div>
  </div>;
}
export default AccessControlPage;
