// client/src/pages/Admin/AccessControl.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  searchUsers,
  getUserGrants,
  grantRole,
  revokeRole,
  addScope,
  removeScope,
  listSchools,
  listOrgs,
  listTenants,
} from "../../services/accessService";

const Btn = ({ children, loading, className = "", ...rest }) => (
  <button
    {...rest}
    disabled={rest.disabled || loading}
    className={`px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 ${className}`}
  >
    {loading ? "…" : children}
  </button>
);

export default function AccessControl() {
  // bootstrap data
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");

  // orgs & schools in this tenant
  const [orgs, setOrgs] = useState([]);
  const schools = useMemo(() => orgs.filter(o => o.type === "school"), [orgs]);

  // user search/selection
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(null);

  // grants for selected user
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [grants, setGrants] = useState({ roles: [], scopes: [] });

  // grant form
  const [gOrg, setGOrg] = useState("");
  const [gRole, setGRole] = useState("");
  const [gDefault, setGDefault] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  // scope form
  const [sRole, setSRole] = useState("");
  const [sOrg, setSOrg] = useState(""); // the org where the role is held
  const [sSchool, setSSchool] = useState("");
  const [sLoading, setSLoading] = useState(false);

  // allowed role choices by org type
  const roleChoices = useMemo(() => ({
    parent_org: ["ADMIN", "FINANCE"],
    school: ["ADMIN", "FINANCE", "SCHOOL_STAFF"],
    bus_company: ["BUS_COMPANY", "FINANCE"],
  }), []);

  const orgOptionsForGrant = useMemo(() => orgs, [orgs]);

  useEffect(() => {
    (async () => {
      try {
        const t = await listTenants();
        setTenants(t);
        if (t?.length) setTenantId(t[0].id);
      } catch (e) {
        toast.error("Failed to load tenants");
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!tenantId) { setOrgs([]); return; }
      try {
        const o = await listOrgs(tenantId);
        setOrgs(o);
      } catch (e) {
        toast.error("Failed to load organizations");
        console.error(e);
      }
    })();
  }, [tenantId]);

  const doSearch = async () => {
    try {
      setSearching(true);
      const rows = await searchUsers(q);
      setResults(rows);
    } catch (e) {
      toast.error("Search failed");
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const loadGrants = async (u) => {
    if (!u) return;
    try {
      setLoadingGrants(true);
      const data = await getUserGrants(u.id);
      setGrants(data);
    } catch (e) {
      toast.error("Failed to load user grants");
      console.error(e);
    } finally {
      setLoadingGrants(false);
    }
  };

  const pickUser = (u) => {
    setUser(u);
    setGrants({ roles: [], scopes: [] });
    loadGrants(u);
  };

  const selectedOrg = useMemo(() => orgs.find(o => o.id === gOrg) || null, [gOrg, orgs]);
  const allowedRoles = useMemo(() => {
    if (!selectedOrg) return [];
    return roleChoices[selectedOrg.type] || [];
  }, [selectedOrg, roleChoices]);

  const onGrant = async () => {
    if (!user || !gOrg || !gRole) return toast.warn("Choose org & role");
    try {
      setGLoading(true);
      await grantRole(user.id, { org_id: gOrg, role: gRole, is_default: gDefault });
      toast.success("Role granted");
      setGDefault(false);
      setGOrg("");
      setGRole("");
      await loadGrants(user);
    } catch (e) {
      toast.error("Grant failed");
      console.error(e);
    } finally {
      setGLoading(false);
    }
  };

  const onRevoke = async (org_id, role) => {
    if (!user) return;
    try {
      await revokeRole(user.id, { org_id, role });
      toast.success("Role revoked");
      await loadGrants(user);
    } catch (e) {
      toast.error("Revoke failed");
      console.error(e);
    }
  };

  const onAddScope = async () => {
    if (!user || !sRole || !sOrg || !sSchool) return toast.warn("Pick role org & school");
    try {
      setSLoading(true);
      await addScope(user.id, { org_id: sOrg, role: sRole, school_org_id: sSchool });
      toast.success("Scope added");
      setSRole(""); setSOrg(""); setSSchool("");
      await loadGrants(user);
    } catch (e) {
      toast.error("Add scope failed");
      console.error(e);
    } finally {
      setSLoading(false);
    }
  };

  const onRemoveScope = async (payload) => {
    if (!user) return;
    try {
      await removeScope(user.id, payload);
      toast.success("Scope removed");
      await loadGrants(user);
    } catch (e) {
      toast.error("Remove scope failed");
      console.error(e);
    }
  };

  // helper: roles grouped by org for the selected user
  const rolesByOrg = useMemo(() => {
    const map = {};
    for (const r of grants.roles) {
      if (!map[r.org_id]) map[r.org_id] = { org: r.org, roles: [] };
      map[r.org_id].roles.push(r.role);
    }
    return map;
  }, [grants.roles]);

  const userHasRoleOnOrg = (org_id) =>
    grants.roles.some(r => r.org_id === org_id);

  const roleOptionsForScopes = useMemo(() => {
    // role+org combos this user currently has
    return grants.roles.map(r => ({
      key: `${r.org_id}:${r.role}`,
      org_id: r.org_id,
      role: r.role,
      orgName: r.org?.name || r.org_id
    }));
  }, [grants.roles]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Access Control</h1>

      <div className="bg-white rounded shadow p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Tenant</label>
            <select className="border rounded px-3 py-2 w-full"
                    value={tenantId}
                    onChange={(e)=>setTenantId(e.target.value)}>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm">Search Users (email / name)</label>
            <div className="flex gap-2">
              <input className="border rounded px-3 py-2 flex-1" value={q}
                     onChange={(e)=>setQ(e.target.value)}
                     placeholder="e.g. sarah@school.com" />
              <Btn onClick={doSearch} loading={searching}>Search</Btn>
            </div>
            {!!results.length && (
              <div className="mt-2 border rounded divide-y">
                {results.map(u => (
                  <button key={u.id}
                          onClick={()=>pickUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50">
                    <div className="font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected user */}
      <div className="bg-white rounded shadow p-4">
        {!user ? (
          <div className="text-gray-600">Pick a user to manage roles & scopes.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-medium">{user.full_name || user.email}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
              {loadingGrants && <div className="text-sm text-gray-500">Loading…</div>}
            </div>

            {/* Grant role */}
            <div className="border rounded p-3 space-y-3">
              <div className="font-medium">Grant role</div>
              <div className="grid md:grid-cols-4 gap-2">
                <select className="border rounded px-3 py-2"
                        value={gOrg}
                        onChange={(e)=>setGOrg(e.target.value)}>
                  <option value="">(choose org)</option>
                  {orgOptionsForGrant.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.type.replace("_"," ")}
                    </option>
                  ))}
                </select>
                <select className="border rounded px-3 py-2"
                        value={gRole}
                        onChange={(e)=>setGRole(e.target.value)}
                        disabled={!gOrg}>
                  <option value="">(choose role)</option>
                  {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={gDefault} onChange={(e)=>setGDefault(e.target.checked)} />
                  Make default for this org
                </label>
                <Btn onClick={onGrant} loading={gLoading} className="md:justify-self-start">Grant</Btn>
              </div>
              <div className="text-xs text-gray-500">
                Roles allowed depend on org type: parent_org → ADMIN/FINANCE; school → ADMIN/FINANCE/SCHOOL_STAFF; bus_company → BUS_COMPANY/FINANCE.
              </div>
            </div>

            {/* Current roles */}
            <div className="border rounded">
              <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-sm font-medium">
                <div>Organization</div><div>Roles</div><div>Action</div>
              </div>
              {Object.entries(rolesByOrg).map(([org_id, row]) => (
                <div key={org_id} className="grid grid-cols-3 px-3 py-2 border-t items-center text-sm">
                  <div className="truncate">{row.org?.name || org_id}</div>
                  <div className="truncate">{row.roles.join(", ")}</div>
                  <div className="space-x-2">
                    {row.roles.map(role => (
                      <button key={role}
                              className="text-red-600 underline"
                              onClick={()=>onRevoke(org_id, role)}>
                        Revoke {role}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!grants.roles.length && <div className="px-3 py-4 text-sm text-gray-600">No roles yet.</div>}
            </div>

            {/* Add scope */}
            <div className="border rounded p-3 space-y-3">
              <div className="font-medium">Limit a role to specific schools (scopes)</div>
              <div className="grid md:grid-cols-4 gap-2">
                <select className="border rounded px-3 py-2"
                        value={`${sOrg}:${sRole}` || ""}
                        onChange={(e)=>{
                          const [org_id, role] = e.target.value.split(":");
                          setSOrg(org_id); setSRole(role);
                        }}>
                  <option value="">(pick a granted role)</option>
                  {roleOptionsForScopes.map(opt => (
                    <option key={opt.key} value={`${opt.org_id}:${opt.role}`}>
                      {opt.orgName} — {opt.role}
                    </option>
                  ))}
                </select>
                <select className="border rounded px-3 py-2"
                        value={sSchool}
                        onChange={(e)=>setSSchool(e.target.value)}>
                  <option value="">(choose school)</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Btn onClick={onAddScope} loading={sLoading}>Add scope</Btn>
              </div>

              {/* existing scopes */}
              <div className="mt-3 border rounded">
                <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 text-sm font-medium">
                  <div>Role Org</div><div>Role</div><div>School</div><div>Action</div>
                </div>
                {grants.scopes.map(sc => (
                  <div key={`${sc.org_id}:${sc.role}:${sc.school_org_id}`}
                       className="grid grid-cols-4 px-3 py-2 border-t text-sm items-center">
                    <div className="truncate">{sc.org?.name || sc.org_id}</div>
                    <div>{sc.role}</div>
                    <div className="truncate">{(schools.find(s => s.id === sc.school_org_id)?.name) || sc.school_org_id}</div>
                    <div>
                      <button className="text-red-600 underline"
                              onClick={()=>onRemoveScope({ org_id: sc.org_id, role: sc.role, school_org_id: sc.school_org_id })}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!grants.scopes.length && <div className="px-3 py-4 text-sm text-gray-600">No scopes.</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <ToastContainer position="top-center" autoClose={1800} hideProgressBar />
    </div>
  );
}
