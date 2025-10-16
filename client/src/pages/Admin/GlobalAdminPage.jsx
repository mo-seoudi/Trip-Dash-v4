// client/src/pages/Admin/GlobalAdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

/** ---------- constants ---------- */
const ORG_TYPES = [
  { value: "edu_group", label: "Edu Group (Parent)" },
  { value: "school", label: "School" },
  { value: "bus_company", label: "Bus Company" },
];

/** ---------- helpers ---------- */
const readErr = (e) =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || "Request failed";

/** Small, consistent UI atoms */
const Card = ({ title, subtitle, right, children }) => (
  <section className="bg-white border rounded-xl p-4 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const Input = (props) => (
  <input
    {...props}
    className={
      "border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 " +
      (props.className || "")
    }
  />
);
const Select = ({ className = "", ...props }) => (
  <select
    {...props}
    className={
      "border rounded-lg px-3 py-2 w-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 " +
      className
    }
  />
);
const Button = ({ variant = "primary", className = "", ...props }) => {
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "bg-white text-gray-700 border hover:bg-gray-50",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed",
  };
  return (
    <button
      {...props}
      className={
        "rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 " +
        variants[variant] +
        " " +
        className
      }
    />
  );
};

/** ---------- API wrappers ---------- */
const apiGlobal = {
  tenants: {
    list: () => api.get("/global/tenants").then((r) => r.data),
    create: (p) => api.post("/global/tenants", p).then((r) => r.data),
    update: (id, p) => api.patch(`/global/tenants/${id}`, p).then((r) => r.data),
  },
  orgs: {
    list: (tenant_id) => api.get("/global/orgs", { params: { tenant_id } }).then((r) => r.data),
    create: (p) => api.post("/global/orgs", p).then((r) => r.data),
    update: (id, p) => api.patch(`/global/orgs/${id}`, p).then((r) => r.data),
  },
  partnerships: {
    list: (tenant_id) =>
      api.get("/global/partnerships", { params: { tenant_id } }).then((r) => r.data),
    create: (p) => api.post("/global/partnerships", p).then((r) => r.data),
    remove: (id) => api.delete(`/global/partnerships/${id}`).then((r) => r.data),
  },
  users: {
    search: (q) => api.get("/global/users", { params: { q: q || "" } }).then((r) => r.data),
    grants: (id) => api.get(`/global/users/${id}/grants`).then((r) => r.data),
  },
};

/** ---------- main ---------- */
export default function GlobalAdminPage() {
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState("");

  const [orgs, setOrgs] = useState([]);
  const [parts, setParts] = useState([]);

  // create forms
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

  // inline edit rows
  const [editTenant, setEditTenant] = useState(null); // { id, name, slug }
  const [editOrg, setEditOrg] = useState(null); // full org row

  /** initial */
  useEffect(() => {
    apiGlobal.tenants
      .list()
      .then((rows) => {
        setTenants(rows || []);
        if (rows?.length && !activeTenantId) setActiveTenantId(rows[0].id);
      })
      .catch((e) => toast.error(`Failed to load tenants: ${readErr(e)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** when tenant changes, reload section data & seed forms */
  useEffect(() => {
    if (!activeTenantId) return;
    apiGlobal.orgs
      .list(activeTenantId)
      .then(setOrgs)
      .catch((e) => toast.error(`Failed to load organizations: ${readErr(e)}`));
    apiGlobal.partnerships
      .list(activeTenantId)
      .then(setParts)
      .catch((e) => toast.error(`Failed to load partnerships: ${readErr(e)}`));
    setOForm((f) => ({ ...f, tenant_id: activeTenantId }));
    setPForm((f) => ({ ...f, tenant_id: activeTenantId }));
  }, [activeTenantId]);

  /** easy groupings */
  const eduGroups = useMemo(() => orgs.filter((o) => o.type === "edu_group"), [orgs]);
  const schools = useMemo(() => orgs.filter((o) => o.type === "school"), [orgs]);
  const companies = useMemo(() => orgs.filter((o) => o.type === "bus_company"), [orgs]);

  /** actions: tenants */
  async function onCreateTenant(e) {
    e.preventDefault();
    try {
      const created = await apiGlobal.tenants.create(tForm);
      setTenants((prev) => [created, ...prev]);
      setTForm({ name: "", slug: "" });
      setActiveTenantId(created.id);
      toast.success("Tenant created");
    } catch (e) {
      toast.error(`Failed to create tenant: ${readErr(e)}`);
    }
  }
  async function onSaveTenant() {
    try {
      const updated = await apiGlobal.tenants.update(editTenant.id, {
        name: editTenant.name,
        slug: editTenant.slug,
      });
      setTenants((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      setEditTenant(null);
      toast.success("Tenant updated");
    } catch (e) {
      toast.error(`Failed to update tenant: ${readErr(e)}`);
    }
  }

  /** actions: orgs */
  async function onCreateOrg(e) {
    e.preventDefault();
    try {
      const payload = {
        ...oForm,
        code: oForm.code || null,
        parent_org_id: oForm.type === "school" ? oForm.parent_org_id || null : null,
      };
      const created = await apiGlobal.orgs.create(payload);
      // If created for a different tenant, only show in that tenant’s view
      if (created.tenant_id === activeTenantId) setOrgs((prev) => [created, ...prev]);
      setOForm({ tenant_id: activeTenantId, name: "", type: "school", code: "", parent_org_id: "" });
      toast.success("Organization created");
    } catch (e) {
      toast.error(`Failed to create organization: ${readErr(e)}`);
    }
  }
  async function onSaveOrg() {
    try {
      const { id, name, type, code, parent_org_id } = editOrg;
      const updated = await apiGlobal.orgs.update(id, {
        name,
        type,
        code: code || null,
        parent_org_id: type === "school" ? parent_org_id || null : null,
      });
      setOrgs((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      setEditOrg(null);
      toast.success("Organization updated");
    } catch (e) {
      toast.error(`Failed to update organization: ${readErr(e)}`);
    }
  }

  /** actions: partnerships */
  async function onCreatePartnership(e) {
    e.preventDefault();
    try {
      const created = await apiGlobal.partnerships.create(pForm);
      setParts((prev) => [created, ...prev]);
      setPForm({ tenant_id: activeTenantId, school_org_id: "", bus_company_org_id: "" });
      toast.success("Partnership created");
    } catch (e) {
      toast.error(`Failed to create partnership: ${readErr(e)}`);
    }
  }
  async function onDeletePartnership(id) {
    try {
      await apiGlobal.partnerships.remove(id);
      setParts((p) => p.filter((x) => x.id !== id));
      toast.success("Partnership removed");
    } catch (e) {
      toast.error(`Failed to remove partnership: ${readErr(e)}`);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Global Admin</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active Tenant</span>
          <Select
            value={activeTenantId}
            onChange={(e) => setActiveTenantId(e.target.value)}
            className="min-w-[220px]"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tenants */}
      <Card title="Tenants" subtitle="Manage tenants: list, edit inline, or create new.">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* list + inline edit */}
          <div className="lg:col-span-2">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Slug</th>
                    <th className="text-left p-2">Updated</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) =>
                    editTenant?.id === t.id ? (
                      <tr key={t.id} className="border-b">
                        <td className="p-2">
                          <Input
                            value={editTenant.name}
                            onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={editTenant.slug}
                            onChange={(e) => setEditTenant({ ...editTenant, slug: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-gray-500">{new Date(t.updated_at).toLocaleString()}</td>
                        <td className="p-2 flex gap-2">
                          <Button onClick={onSaveTenant}>Save</Button>
                          <Button variant="ghost" onClick={() => setEditTenant(null)}>
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{t.name}</td>
                        <td className="p-2">{t.slug}</td>
                        <td className="p-2 text-gray-500">{new Date(t.updated_at).toLocaleString()}</td>
                        <td className="p-2">
                          <Button variant="ghost" onClick={() => setEditTenant({ id: t.id, name: t.name, slug: t.slug })}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  )}
                  {tenants.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={4}>
                        No tenants yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* create tenant */}
          <div className="border rounded-lg p-3">
            <h3 className="font-medium mb-2">Add Tenant</h3>
            <form onSubmit={onCreateTenant} className="space-y-2">
              <Input
                placeholder="Tenant Name"
                value={tForm.name}
                onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="tenant slug"
                value={tForm.slug}
                onChange={(e) => setTForm({ ...tForm, slug: e.target.value })}
                required
              />
              <div className="flex justify-end">
                <Button type="submit">Create Tenant</Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Organizations */}
      <Card
        title="Organizations"
        subtitle="View & edit organizations for a tenant. Create new ones on the right."
        right={
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
            <span>Tenant:</span>
            <Select value={activeTenantId} onChange={(e) => setActiveTenantId(e.target.value)} className="min-w-[220px]">
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </Select>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* list + inline edit */}
          <div className="lg:col-span-2">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">Parent</th>
                    <th className="text-left p-2">Updated</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) =>
                    editOrg?.id === o.id ? (
                      <tr key={o.id} className="border-b">
                        <td className="p-2">
                          <Input
                            value={editOrg.name}
                            onChange={(e) => setEditOrg({ ...editOrg, name: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={editOrg.type}
                            onChange={(e) => setEditOrg({ ...editOrg, type: e.target.value })}
                          >
                            {ORG_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={editOrg.code || ""}
                            onChange={(e) => setEditOrg({ ...editOrg, code: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={editOrg.parent_org_id || ""}
                            onChange={(e) => setEditOrg({ ...editOrg, parent_org_id: e.target.value })}
                            disabled={editOrg.type !== "school"}
                          >
                            <option value="">—</option>
                            {eduGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="p-2 text-gray-500">{new Date(o.updated_at).toLocaleString()}</td>
                        <td className="p-2 flex gap-2">
                          <Button onClick={onSaveOrg}>Save</Button>
                          <Button variant="ghost" onClick={() => setEditOrg(null)}>
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={o.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{o.name}</td>
                        <td className="p-2">{o.type}</td>
                        <td className="p-2">{o.code || "—"}</td>
                        <td className="p-2">{o.parent?.name || "—"}</td>
                        <td className="p-2 text-gray-500">{new Date(o.updated_at).toLocaleString()}</td>
                        <td className="p-2">
                          <Button variant="ghost" onClick={() => setEditOrg({ ...o })}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  )}
                  {orgs.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={6}>
                        No organizations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* create org */}
          <div className="border rounded-lg p-3">
            <h3 className="font-medium mb-2">Add Organization</h3>
            <form onSubmit={onCreateOrg} className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs text-gray-500">Tenant</label>
                <Select
                  value={oForm.tenant_id}
                  onChange={(e) => setOForm({ ...oForm, tenant_id: e.target.value })}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs text-gray-500">Type</label>
                <Select value={oForm.type} onChange={(e) => setOForm({ ...oForm, type: e.target.value })}>
                  {ORG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Input
                placeholder="Organization Name"
                value={oForm.name}
                onChange={(e) => setOForm({ ...oForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="Code (optional)"
                value={oForm.code}
                onChange={(e) => setOForm({ ...oForm, code: e.target.value })}
              />

              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs text-gray-500">Parent (Edu Group) — optional</label>
                <Select
                  value={oForm.parent_org_id}
                  onChange={(e) => setOForm({ ...oForm, parent_org_id: e.target.value })}
                  disabled={oForm.type !== "school"}
                  title={oForm.type !== "school" ? "Parent applies to School only" : ""}
                >
                  <option value="">—</option>
                  {eduGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end">
                <Button type="submit">Add Organization</Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Partnerships */}
      <Card title="Partnerships" subtitle="Link a school to a bus company (per tenant).">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* create */}
          <div className="border rounded-lg p-3">
            <h3 className="font-medium mb-2">Add Partnership</h3>
            <form onSubmit={onCreatePartnership} className="space-y-2">
              <div>
                <label className="text-xs text-gray-500">School</label>
                <Select
                  value={pForm.school_org_id}
                  onChange={(e) => setPForm({ ...pForm, school_org_id: e.target.value })}
                >
                  <option value="">Select School</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Bus Company</label>
                <Select
                  value={pForm.bus_company_org_id}
                  onChange={(e) => setPForm({ ...pForm, bus_company_org_id: e.target.value })}
                >
                  <option value="">Select Bus Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="text-xs text-gray-500">
                one school ↔ one bus company (repeat to add more)
              </div>

              <div className="flex justify-end">
                <Button type="submit">Add Partnership</Button>
              </div>
            </form>
          </div>

          {/* list */}
          <div className="lg:col-span-2">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
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
                      <td className="p-2 text-gray-500">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="p-2">
                        <Button variant="danger" onClick={() => onDeletePartnership(p.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {parts.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={4}>
                        No partnerships yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
