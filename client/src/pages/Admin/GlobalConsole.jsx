// client/src/pages/Admin/GlobalConsole.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  getMe, setActiveOrg,
  listTenants, createTenant,
  listOrgs, createOrg, updateOrg,
  listPartnerships, createPartnership, deletePartnership,
} from "../../services/globalService";

// tiny helper
const Btn = ({ children, loading, ...rest }) => (
  <button
    {...rest}
    disabled={rest.disabled || loading}
    className={`px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 ${rest.className||""}`}
  >
    {loading ? "..." : children}
  </button>
);

export default function GlobalConsole() {
  const [tab, setTab] = useState("orgswitcher");

  // me / org switcher
  const [me, setMe] = useState(null);
  const [switching, setSwitching] = useState(false);

  // tenants
  const [tenants, setTenants] = useState([]);
  const [tForm, setTForm] = useState({ name: "", slug: "" });
  const [tLoading, setTLoading] = useState(false);

  // orgs
  const [tenantId, setTenantId] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [oForm, setOForm] = useState({ name: "", type: "school", code: "", parent_org_id: "" });
  const [oLoading, setOLoading] = useState(false);

  // partnerships
  const [parts, setParts] = useState([]);
  const [pForm, setPForm] = useState({ school_org_id: "", bus_company_org_id: "" });
  const [pLoading, setPLoading] = useState(false);

  // bootstrap
  useEffect(() => { (async () => {
    try {
      const meData = await getMe();
      setMe(meData);
      const t = await listTenants();
      setTenants(t);
      // pick first tenant by default for convenience
      if (t?.length && !tenantId) setTenantId(t[0].id);
    } catch (e) {
      console.error("bootstrap failed:", e);
    }
  })(); }, []);

  // load orgs/partnerships when tenant changes
  useEffect(() => { (async () => {
    if (!tenantId) { setOrgs([]); setParts([]); return; }
    try {
      const [o, p] = await Promise.all([
        listOrgs(tenantId),
        listPartnerships(tenantId),
      ]);
      setOrgs(o);
      setParts(p);
    } catch (e) {
      console.error("load tenant data failed:", e);
    }
  })(); }, [tenantId]);

  const schools = useMemo(() => orgs.filter(o => o.type === "school"), [orgs]);
  const companies = useMemo(() => orgs.filter(o => o.type === "bus_company"), [orgs]);
  const parents = useMemo(() => orgs.filter(o => o.type === "parent_org"), [orgs]);

  // ---- handlers
  const handleSetOrg = async (org_id) => {
    try {
      setSwitching(true);
      await setActiveOrg(org_id);
      const fresh = await getMe();
      setMe(fresh);
      alert("Active organization updated.");
    } catch (e) {
      console.error(e);
      alert("Failed to set active organization.");
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!tForm.name || !tForm.slug) return alert("Name and slug are required.");
    try {
      setTLoading(true);
      const t = await createTenant({ ...tForm });
      setTenants(prev => [t, ...prev]);
      setTForm({ name: "", slug: "" });
      alert("Tenant created.");
    } catch (e) {
      console.error(e);
      alert("Failed to create tenant.");
    } finally {
      setTLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!tenantId) return alert("Pick a tenant first.");
    if (!oForm.name) return alert("Organization name is required.");
    try {
      setOLoading(true);
      const created = await createOrg({ ...oForm, tenant_id: tenantId, parent_org_id: oForm.parent_org_id || null, code: oForm.code || null });
      setOrgs(prev => [created, ...prev]);
      setOForm({ name: "", type: "school", code: "", parent_org_id: "" });
      alert("Organization created.");
    } catch (e) {
      console.error(e);
      alert("Failed to create organization.");
    } finally {
      setOLoading(false);
    }
  };

  const handleCreatePartnership = async () => {
    if (!tenantId) return alert("Pick a tenant first.");
    if (!pForm.school_org_id || !pForm.bus_company_org_id) return alert("Pick a school and a bus company.");
    try {
      setPLoading(true);
      const created = await createPartnership({ tenant_id: tenantId, ...pForm });
      setParts(prev => [created, ...prev]);
      setPForm({ school_org_id: "", bus_company_org_id: "" });
      alert("Partnership created.");
    } catch (e) {
      console.error(e);
      alert("Failed to create partnership.");
    } finally {
      setPLoading(false);
    }
  };

  const handleDeletePartnership = async (id) => {
    if (!confirm("Delete this partnership?")) return;
    try {
      await deletePartnership(id);
      setParts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete partnership.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Global Admin Console</h1>

      {/* tabs */}
      <div className="flex gap-2">
        {[
          ["orgswitcher", "Org Switcher"],
          ["tenants", "Tenants"],
          ["orgs", "Organizations"],
          ["partnerships", "Partnerships"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 rounded ${tab === key ? "bg-gray-900 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ORG SWITCHER */}
      {tab === "orgswitcher" && (
        <div className="bg-white rounded shadow p-4 space-y-4">
          <h2 className="text-lg font-medium">Active Organization</h2>
          <p className="text-sm text-gray-600">
            If a user belongs to multiple schools/companies, they can pick the current one here.
          </p>

          <div className="border rounded">
            <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-sm font-medium">
              <div>Organization</div>
              <div>Type</div>
              <div>Action</div>
            </div>
            {(me?.orgs || []).map((o) => (
              <div key={`${o.org_id}-${o.role}`} className="grid grid-cols-3 px-3 py-2 border-t items-center text-sm">
                <div className="truncate">{o.name}</div>
                <div className="capitalize">{o.type.replace("_", " ")}</div>
                <div>
                  {me?.active_org_id === o.org_id ? (
                    <span className="text-green-700 font-medium">Active</span>
                  ) : (
                    <Btn onClick={() => handleSetOrg(o.org_id)} loading={switching}>Set Active</Btn>
                  )}
                </div>
              </div>
            ))}
            {!me?.orgs?.length && (
              <div className="px-3 py-4 text-sm text-gray-600">No organizations for this user.</div>
            )}
          </div>
        </div>
      )}

      {/* TENANTS */}
      {tab === "tenants" && (
        <div className="bg-white rounded shadow p-4 space-y-4">
          <h2 className="text-lg font-medium">Tenants</h2>

          <div className="flex gap-2">
            <input
              value={tForm.name}
              onChange={(e) => setTForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Name"
              className="border rounded px-3 py-2 flex-1"
            />
            <input
              value={tForm.slug}
              onChange={(e) => setTForm((s) => ({ ...s, slug: e.target.value }))}
              placeholder="slug (unique)"
              className="border rounded px-3 py-2 w-64"
            />
            <Btn onClick={handleCreateTenant} loading={tLoading}>Add</Btn>
          </div>

          <div className="border rounded">
            <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-sm font-medium">
              <div>Name</div><div>Slug</div><div>Created</div>
            </div>
            {tenants.map(t => (
              <div key={t.id} className="grid grid-cols-3 px-3 py-2 border-t text-sm">
                <div className="truncate">{t.name}</div>
                <div>{t.slug}</div>
                <div>{new Date(t.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ORGS */}
      {tab === "orgs" && (
        <div className="bg-white rounded shadow p-4 space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm">Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm">Name</label>
              <input className="border rounded px-3 py-2 w-full" value={oForm.name}
                onChange={(e)=>setOForm(s=>({...s,name:e.target.value}))}/>
            </div>
            <div>
              <label className="text-sm">Type</label>
              <select className="border rounded px-3 py-2"
                value={oForm.type}
                onChange={(e)=>setOForm(s=>({...s,type:e.target.value}))}>
                <option value="school">school</option>
                <option value="bus_company">bus_company</option>
                <option value="parent_org">parent_org</option>
              </select>
            </div>
            <div>
              <label className="text-sm">Code</label>
              <input className="border rounded px-3 py-2 w-36" value={oForm.code}
                onChange={(e)=>setOForm(s=>({...s,code:e.target.value}))}/>
            </div>
            <div>
              <label className="text-sm">Parent Org (for schools)</label>
              <select className="border rounded px-3 py-2 w-56"
                value={oForm.parent_org_id}
                onChange={(e)=>setOForm(s=>({...s,parent_org_id:e.target.value}))}>
                <option value="">(none)</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <Btn onClick={handleCreateOrg} loading={oLoading}>Add</Btn>
          </div>

          <div className="border rounded">
            <div className="grid grid-cols-5 bg-gray-50 px-3 py-2 text-sm font-medium">
              <div>Name</div><div>Type</div><div>Code</div><div>Parent</div><div>Updated</div>
            </div>
            {orgs.map(o => (
              <div key={o.id} className="grid grid-cols-5 px-3 py-2 border-t text-sm">
                <div className="truncate">{o.name}</div>
                <div className="capitalize">{o.type.replace("_"," ")}</div>
                <div>{o.code || "-"}</div>
                <div className="truncate">
                  {o.parent?.name || "-"}
                </div>
                <div>{new Date(o.updated_at || o.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PARTNERSHIPS */}
      {tab === "partnerships" && (
        <div className="bg-white rounded shadow p-4 space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm">Tenant</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm">School</label>
              <select className="border rounded px-3 py-2 w-full"
                value={pForm.school_org_id}
                onChange={(e)=>setPForm(s=>({...s,school_org_id:e.target.value}))}>
                <option value="">(choose)</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm">Bus Company</label>
              <select className="border rounded px-3 py-2 w-full"
                value={pForm.bus_company_org_id}
                onChange={(e)=>setPForm(s=>({...s,bus_company_org_id:e.target.value}))}>
                <option value="">(choose)</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Btn onClick={handleCreatePartnership} loading={pLoading}>Link</Btn>
          </div>

          <div className="border rounded">
            <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 text-sm font-medium">
              <div>School</div><div>Bus Company</div><div>Created</div><div>Action</div>
            </div>
            {parts.map(p => (
              <div key={p.id} className="grid grid-cols-4 px-3 py-2 border-t text-sm items-center">
                <div className="truncate">{p.school_org?.name || p.school_org_id}</div>
                <div className="truncate">{p.bus_company?.name || p.bus_company_org_id}</div>
                <div>{new Date(p.created_at).toLocaleString()}</div>
                <div>
                  <button onClick={() => handleDeletePartnership(p.id)} className="text-red-600 underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
