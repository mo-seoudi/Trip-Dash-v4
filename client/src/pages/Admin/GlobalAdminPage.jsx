import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

/** ---------- helpers ---------- */
async function fetchJSON(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}
const api = {
  tenants: {
    list: () => fetchJSON("/api/global/tenants"),
    create: (p) =>
      fetchJSON("/api/global/tenants", { method: "POST", body: JSON.stringify(p) }),
    update: (id, p) =>
      fetchJSON(`/api/global/tenants/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
  },
  orgs: {
    list: (tenant_id) =>
      fetchJSON(`/api/global/orgs?tenant_id=${encodeURIComponent(tenant_id)}`),
    create: (p) =>
      fetchJSON("/api/global/orgs", { method: "POST", body: JSON.stringify(p) }),
    update: (id, p) =>
      fetchJSON(`/api/global/orgs/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
  },
  partnerships: {
    list: (tenant_id) =>
      fetchJSON(`/api/global/partnerships?tenant_id=${encodeURIComponent(tenant_id)}`),
    create: (p) =>
      fetchJSON("/api/global/partnerships", { method: "POST", body: JSON.stringify(p) }),
    remove: (id) =>
      fetchJSON(`/api/global/partnerships/${id}`, { method: "DELETE" }),
  },
  users: {
    search: (q) => fetchJSON(`/api/global/users?q=${encodeURIComponent(q || "")}`),
    grants: (id) => fetchJSON(`/api/global/users/${id}/grants`),
  },
};
const ORG_TYPES = [
  { value: "parent_org", label: "Edu_Group (Parent)" },
  { value: "school", label: "School" },
  { value: "bus_company", label: "Bus Company" },
];

/** ---------- page ---------- */
export default function GlobalAdminPage() {
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [parts, setParts] = useState([]);

  // create/edit forms
  const [tForm, setTForm] = useState({ name: "", slug: "" });
  const [oForm, setOForm] = useState({
    tenant_id: "",
    name: "",
    type: "school",
    code: "",
    parent_org_id: "",
  });
  const [pForm, setPForm] = useState({
    tenant_id: "",
    school_org_id: "",
    bus_company_org_id: "",
  });

  // initial load
  useEffect(() => {
    api.tenants.list()
      .then((rows) => {
        setTenants(rows || []);
        if (rows?.length && !activeTenantId) setActiveTenantId(rows[0].id);
      })
      .catch((e) => toast.error(`Failed to load tenants: ${e.message}`));
  }, []); // eslint-disable-line

  // reload orgs/partnerships when tenant changes
  useEffect(() => {
    if (!activeTenantId) return;
    api.orgs.list(activeTenantId)
      .then(setOrgs)
      .catch((e) => toast.error(`Failed to load organizations: ${e.message}`));
    api.partnerships.list(activeTenantId)
      .then(setParts)
      .catch((e) => toast.error(`Failed to load partnerships: ${e.message}`));
    setOForm((f) => ({ ...f, tenant_id: activeTenantId }));
    setPForm((f) => ({ ...f, tenant_id: activeTenantId }));
  }, [activeTenantId]);

  const eduGroups = useMemo(() => orgs.filter((o) => o.type === "parent_org"), [orgs]);
  const schools   = useMemo(() => orgs.filter((o) => o.type === "school"), [orgs]);
  const companies = useMemo(() => orgs.filter((o) => o.type === "bus_company"), [orgs]);

  async function onCreateTenant(e) {
    e.preventDefault();
    try {
      const created = await api.tenants.create(tForm);
      setTenants((prev) => [created, ...prev]);
      setTForm({ name: "", slug: "" });
      toast.success("Tenant created");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function onCreateOrg(e) {
    e.preventDefault();
    try {
      const created = await api.orgs.create({
        ...oForm,
        code: oForm.code || null,
        parent_org_id: oForm.parent_org_id || null,
      });
      setOrgs((prev) => [created, ...prev]);
      setOForm({ tenant_id: activeTenantId, name: "", type: "school", code: "", parent_org_id: "" });
      toast.success("Organization created");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function onCreatePartnership(e) {
    e.preventDefault();
    try {
      const created = await api.partnerships.create(pForm);
      setParts((prev) => [created, ...prev]);
      setPForm({ tenant_id: activeTenantId, school_org_id: "", bus_company_org_id: "" });
      toast.success("Partnership created");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function onDeletePartnership(id) {
    try {
      await api.partnerships.remove(id);
      setParts((p) => p.filter((x) => x.id !== id));
      toast.success("Partnership removed");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Global Admin</h1>

      {/* Tenant Switcher */}
      <section className="bg-white border rounded p-4 space-y-2">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Active Tenant:</label>
          <select
            className="border rounded p-2"
            value={activeTenantId}
            onChange={(e) => setActiveTenantId(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>

        {/* Create Tenant */}
        <form onSubmit={onCreateTenant} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <input
            className="border rounded p-2"
            placeholder="Tenant Name"
            value={tForm.name}
            onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
            required
          />
          <input
            className="border rounded p-2"
            placeholder="tenant slug"
            value={tForm.slug}
            onChange={(e) => setTForm({ ...tForm, slug: e.target.value })}
            required
          />
          <button className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700" type="submit">
            Create Tenant
          </button>
        </form>
      </section>

      {/* Organizations */}
      <section className="bg-white border rounded p-4 space-y-4">
        <h2 className="text-xl font-semibold">Organizations</h2>

        {/* Create Org */}
        <form onSubmit={onCreateOrg} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <select
            className="border rounded p-2"
            value={oForm.type}
            onChange={(e) => setOForm({ ...oForm, type: e.target.value })}
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="border rounded p-2"
            placeholder="Organization Name"
            value={oForm.name}
            onChange={(e) => setOForm({ ...oForm, name: e.target.value })}
            required
          />
          <input
            className="border rounded p-2"
            placeholder="Code (optional)"
            value={oForm.code}
            onChange={(e) => setOForm({ ...oForm, code: e.target.value })}
          />
          {/* parent only when School */}
          <select
            className="border rounded p-2"
            value={oForm.parent_org_id}
            onChange={(e) => setOForm({ ...oForm, parent_org_id: e.target.value })}
            disabled={oForm.type !== "school"}
            title={oForm.type !== "school" ? "Parent applies to School only" : ""}
          >
            <option value="">Parent (Edu_Group) — optional</option>
            {eduGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700" type="submit">
            Add Organization
          </button>
        </form>

        {/* Orgs table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Parent</th>
                <th className="text-left p-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{o.name}</td>
                  <td className="p-2">{o.type}</td>
                  <td className="p-2">{o.code || "—"}</td>
                  <td className="p-2">{o.parent?.name || "—"}</td>
                  <td className="p-2">{new Date(o.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={5}>
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Partnerships */}
      <section className="bg-white border rounded p-4 space-y-4">
        <h2 className="text-xl font-semibold">Partnerships</h2>

        {/* Create */}
        <form onSubmit={onCreatePartnership} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            className="border rounded p-2"
            value={pForm.school_org_id}
            onChange={(e) => setPForm({ ...pForm, school_org_id: e.target.value })}
          >
            <option value="">Select School</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded p-2"
            value={pForm.bus_company_org_id}
            onChange={(e) => setPForm({ ...pForm, bus_company_org_id: e.target.value })}
          >
            <option value="">Select Bus Company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="p-2 text-gray-500 self-center">
            one school ↔ one bus company (repeat to add more)
          </div>
          <button className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700" type="submit">
            Add Partnership
          </button>
        </form>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">School</th>
                <th className="text-left p-2">Bus Company</th>
                <th className="text-left p-2">Created</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{p.school_org?.name || p.school_org_id}</td>
                  <td className="p-2">{p.bus_company?.name || p.bus_company_org_id}</td>
                  <td className="p-2">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    <button
                      onClick={() => onDeletePartnership(p.id)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {parts.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={4}>
                    No partnerships yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
