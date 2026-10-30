import React, { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";
import UserAccessEditor from "@/components/admin/UserAccessEditor";
import OrganizationEditor from "@/components/admin/OrganizationEditor";
import RelationshipEditor from "@/components/admin/RelationshipEditor";
import DataSourceEditor from "@/components/admin/DataSourceEditor";

const STORAGE_KEY = "tripdash:control-center:tenant";
const display = user => user.display_name || user.email;

export default function ScopedAdministration({ section, search = "", onUpdated }) {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [overview, setOverview] = useState(null);
  const [roles, setRoles] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get("/access-admin/tenants").then(({data}) => {
      if (!alive) return;
      const items = Array.isArray(data) ? data : [];
      setTenants(items);
      const saved = window.localStorage.getItem(STORAGE_KEY);
      setTenantId(items.find(t => t.id === saved)?.id || items[0]?.id || "");
    }).catch(() => { if (alive) toast.error("Unable to load available workspaces."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const reload = async () => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const [access, roleList, sourceList] = await Promise.all([
        api.get("/access-admin/overview", { params: { tenant_id: tenantId } }),
        api.get("/access-admin/roles"),
        api.get("/data-sources", { params: { tenant_id: tenantId } })
      ]);
      setOverview(access.data);
      setRoles(Array.isArray(roleList.data) ? roleList.data : []);
      setSources(Array.isArray(sourceList.data) ? sourceList.data : []);
      onUpdated?.();
    } catch (error) {
      toast.error("Unable to load administration records. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setOverview(null);
    setSelectedUser(null);
    if (tenantId) {
      window.localStorage.setItem(STORAGE_KEY, tenantId);
      reload();
    }
  }, [tenantId]);

  const memberships = useMemo(() => {
    const map = new Map();
    for (const m of overview?.memberships || []) map.set(m.user_id, [...(map.get(m.user_id) || []), m]);
    return map;
  }, [overview]);
  const assignments = useMemo(() => {
    const map = new Map();
    for (const r of overview?.role_assignments || []) map.set(r.user_id, [...(map.get(r.user_id) || []), r]);
    return map;
  }, [overview]);
  const users = (overview?.users || []).filter(u => (display(u) + " " + u.email).toLowerCase().includes(search.toLowerCase()));
  const selected = (overview?.users || []).find(u => u.id === selectedUser);
  const organizations = overview?.organizations || [];

  return <div className="p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
        Manage within tenant
        <span className="relative">
          <select aria-label="Select tenant for administration" value={tenantId} onChange={e => setTenantId(e.target.value)} className="min-w-44 appearance-none rounded-lg border bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-800">
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500"/>
        </span>
      </label>
      <button type="button" onClick={reload} disabled={!tenantId || busy} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"><FiRefreshCw className={busy ? "animate-spin" : ""}/>Refresh</button>
    </div>
    {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading available tenants…</p> :
      !tenantId ? <p className="py-8 text-center text-sm text-slate-500">No tenant is available for scoped administration.</p> :
      !overview ? <p className="py-8 text-center text-sm text-slate-500">{busy ? "Loading management tools…" : "Management data unavailable. Select Refresh to retry."}</p> :
      section === "users" ? <div className="space-y-3">
        <p className="text-xs text-slate-500">Select a user to manage their organization memberships and role assignments in this tenant.</p>
        {users.map(user => <div key={user.id} className="rounded-xl border">
          <button type="button" onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)} aria-expanded={selectedUser === user.id} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
            <span><span className="block font-semibold text-slate-900">{display(user)}</span><span className="block text-sm text-slate-500">{user.email}</span></span>
            <span className="text-xs font-semibold text-violet-700">{selectedUser === user.id ? "Close" : "Manage user"}</span>
          </button>
          {selectedUser === user.id && <div className="border-t p-4"><UserAccessEditor user={selected || user} memberships={memberships.get(user.id) || []} roleAssignments={assignments.get(user.id) || []} organizations={organizations} roles={roles} tenantId={tenantId} onChanged={reload}/></div>}
        </div>)}
        {!users.length && <p className="py-8 text-center text-sm text-slate-500">No users match this search in the selected tenant.</p>}
      </div> :
      section === "organizations" ? <OrganizationEditor tenantId={tenantId} organizations={organizations} search={search} onChanged={reload}/> :
      section === "relationships" ? <RelationshipEditor organizations={organizations} relationships={overview.relationships || []} onChanged={reload}/> :
      section === "data-sources" ? <DataSourceEditor organizations={organizations} dataSources={sources} loading={busy} onChanged={reload}/> : null}
  </div>;
}
