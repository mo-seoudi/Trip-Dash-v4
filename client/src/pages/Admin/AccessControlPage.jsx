import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiUsers, FiGrid, FiLink2, FiShield, FiDatabase, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import UserAccessEditor from "@/components/admin/UserAccessEditor";

const TABS = [
  ["users", "Users", FiUsers],
  ["organizations", "Organizations", FiGrid],
  ["relationships", "Relationships", FiLink2],
  ["data-sources", "Data Sources", FiDatabase],
  ["roles", "Roles & Access", FiShield],
];

const ROLE_LABELS = {
  super_admin: "Super Admin",
  tenant_admin: "Tenant Admin",
  group_staff: "Group Staff",
  school_staff: "School Staff",
  bus_operator: "Bus Operator",
  service_partner: "Service Partner",
  finance: "Finance",
};

const ORG_LABELS = {
  SCHOOL_GROUP: "School Group",
  SCHOOL: "School",
  BUS_OPERATOR: "Bus Operator",
  SERVICE_PARTNER: "Service Partner",
};

const RELATIONSHIP_LABELS = {
  BELONGS_TO_GROUP: "Belongs to Group",
  TRANSPORT_PROVIDER: "Transport Provider",
  TRIP_MANAGER: "Trip Manager",
  WORKS_WITH_TRANSPORT_PROVIDER: "Works with Bus Operator",
};

function Pill({ children }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>;
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function AccessControlPage() {
  const { access } = useWorkspace();
  const tenantId = access?.tenantId;
  const [tab, setTab] = useState("users");
  const [data, setData] = useState(null);
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await api.get("/access-admin/overview", { params: { tenant_id: tenantId } });
      setData(response.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load access control");
    } finally {
      setLoading(false);
    }
  };

  const loadDataSources = async () => {
    if (!tenantId) return;
    setDataSourcesLoading(true);
    try {
      const response = await api.get("/data-sources", { params: { tenant_id: tenantId } });
      setDataSources(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load operational data sources");
    } finally {
      setDataSourcesLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([load(), loadDataSources()]);
  };

  const verifyDataSource = async (id) => {
    setVerifyingId(id);
    try {
      const response = await api.post(`/data-sources/${id}/verify`);
      const verified = response.data?.dataSource;
      if (verified) {
        setDataSources((current) => current.map((item) => item.id === id ? verified : item));
      } else {
        await loadDataSources();
      }
      toast.success("Operational database connection verified");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not verify the operational database connection");
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    load();
    loadDataSources();
  }, [tenantId]);

  const membershipsByUser = useMemo(() => {
    const map = new Map();
    for (const membership of data?.memberships || []) {
      const list = map.get(membership.user_id) || [];
      list.push(membership);
      map.set(membership.user_id, list);
    }
    return map;
  }, [data]);

  const scopesByUser = useMemo(() => {
    const map = new Map();
    for (const scope of data?.scopes || []) {
      const list = map.get(scope.user_id) || [];
      list.push(scope);
      map.set(scope.user_id, list);
    }
    return map;
  }, [data]);

  const organizationsById = useMemo(() => {
    const map = new Map();
    for (const org of data?.organizations || []) map.set(org.id, org);
    return map;
  }, [data]);

  const q = search.trim().toLowerCase();
  const users = (data?.users || []).filter((u) => !q || `${u.display_name} ${u.email}`.toLowerCase().includes(q));
  const organizations = (data?.organizations || []).filter((o) => !q || `${o.display_name} ${o.abbreviation || ""} ${o.type}`.toLowerCase().includes(q));

  if (!tenantId) {
    return <div className="p-6"><Empty>This account does not yet have a tenant access context. Complete the access migration before managing organizations.</Empty></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Access Control</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Manage who belongs to each organization, what role they have, which schools they can access, how organizations work together, and where each school's operational data is stored.</p>
        </div>
        <button onClick={refreshAll} disabled={loading || dataSourcesLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <FiRefreshCw className={loading || dataSourcesLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          [data?.users?.length || 0, "Users"],
          [data?.organizations?.length || 0, "Organizations"],
          [data?.memberships?.length || 0, "Role memberships"],
          [data?.relationships?.length || 0, "Relationships"],
          [dataSources.length, "Data sources"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b p-2">
          {TABS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`inline-flex whitespace-nowrap items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon /> {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {(tab === "users" || tab === "organizations") && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}...`} className="mb-4 w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          )}

          {loading && !data ? <div className="py-10 text-center text-sm text-slate-500">Loading access model…</div> : null}

          {tab === "users" && data && (
            <div className="space-y-3">
              {users.map((user) => {
                const memberships = membershipsByUser.get(user.id) || [];
                const scopes = scopesByUser.get(user.id) || [];
                return (
                  <article key={user.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{user.display_name}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </div>
                      <Pill>{user.is_active ? "Active" : "Inactive"}</Pill>
                    </div>
                    <UserAccessEditor
                      user={user}
                      memberships={memberships}
                      scopes={scopes}
                      organizations={data.organizations || []}
                      onChanged={load}
                    />
                  </article>
                );
              })}
              {!users.length && <Empty>No users match this search.</Empty>}
            </div>
          )}

          {tab === "organizations" && data && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {organizations.map((org) => (
                <article key={org.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-semibold text-slate-900">{org.display_name}</div><div className="mt-1 text-xs text-slate-500">{org.abbreviation || "No abbreviation"}</div></div>
                    <Pill>{ORG_LABELS[org.type] || org.type}</Pill>
                  </div>
                  {org.parent_org_id && <div className="mt-3 text-xs text-slate-500">Part of a parent organization</div>}
                </article>
              ))}
              {!organizations.length && <Empty>No organizations match this search.</Empty>}
            </div>
          )}

          {tab === "relationships" && data && (
            <div className="space-y-3">
              {(data.relationships || []).map((r) => (
                <article key={r.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{r.from_organization?.display_name}</div><div className="text-xs text-slate-500">{ORG_LABELS[r.from_organization?.type]}</div></div>
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-700"><FiLink2 /> {RELATIONSHIP_LABELS[r.type] || r.type}</div>
                  <div className="min-w-0 flex-1 md:text-right"><div className="font-semibold text-slate-900">{r.to_organization?.display_name}</div><div className="text-xs text-slate-500">{ORG_LABELS[r.to_organization?.type]}</div></div>
                </article>
              ))}
              {!data.relationships?.length && <Empty>No organization relationships have been configured.</Empty>}
              {data.capabilities?.note && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{data.capabilities.note}</div>}
            </div>
          )}

          {tab === "data-sources" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Each school resolves to one active operational PostgreSQL database. Credentials stay on the server through the configured secret reference and are never exposed here.
              </div>

              {dataSourcesLoading && !dataSources.length ? <div className="py-10 text-center text-sm text-slate-500">Loading operational data sources…</div> : null}

              <div className="grid gap-3 xl:grid-cols-2">
                {dataSources.map((source) => {
                  const org = organizationsById.get(source.organizationId);
                  const verified = Boolean(source.lastVerifiedAt);
                  return (
                    <article key={source.id} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{org?.display_name || source.organizationId}</div>
                          <div className="mt-1 text-xs text-slate-500">{org?.abbreviation || "School operational database"}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill>{source.provider || "PostgreSQL"}</Pill>
                          <Pill>{source.isActive ? "Active" : "Inactive"}</Pill>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Mode</dt><dd className="mt-1 text-slate-700">{source.mode === "CUSTOMER_POSTGRES" ? "Customer PostgreSQL" : "Hosted"}</dd></div>
                        <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Credential</dt><dd className="mt-1 text-slate-700">{source.secretConfigured ? "Configured" : "Missing"}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Last verified</dt><dd className="mt-1 flex items-center gap-2 text-slate-700">{verified ? <FiCheckCircle className="text-emerald-600" /> : <FiAlertCircle className="text-amber-600" />} {formatDate(source.lastVerifiedAt)}</dd></div>
                      </dl>

                      <div className="mt-4 flex justify-end border-t pt-4">
                        <button
                          type="button"
                          onClick={() => verifyDataSource(source.id)}
                          disabled={verifyingId === source.id || !source.secretConfigured}
                          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FiRefreshCw className={verifyingId === source.id ? "animate-spin" : ""} />
                          {verifyingId === source.id ? "Verifying…" : "Verify connection"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!dataSourcesLoading && !dataSources.length && <Empty>No operational data sources have been configured for this tenant yet.</Empty>}
            </div>
          )}

          {tab === "roles" && data && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Roles describe what a user may do. Memberships describe which organization the user belongs to. School scopes can narrow inherited access. Organization relationships extend access only where the backend policy permits it.</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(ROLE_LABELS).map(([key, label]) => <div key={key} className="rounded-xl border p-4"><div className="font-semibold text-slate-900">{label}</div><div className="mt-1 font-mono text-xs text-slate-400">{key}</div></div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccessControlPage;
