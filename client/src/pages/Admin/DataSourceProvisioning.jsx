import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiDatabase, FiRefreshCw } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

export default function DataSourceProvisioning() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(null);
  const [name, setName] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const [details, list] = await Promise.all([
        api.get(`/platform-control/organizations/${encodeURIComponent(organizationId)}`),
        api.get(`/data-sources?organization_id=${encodeURIComponent(organizationId)}`)
      ]);
      setOrg(details.data?.organization || null);
      setSources(list.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load school database assignment");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [organizationId]);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/data-sources/${encodeURIComponent(organizationId)}`, {
        mode: "HOSTED", name, is_active: true
      });
      toast.success("Platform database assigned");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not assign platform database");
    } finally { setSaving(false); }
  };
  const verify = async (source) => {
    if (source.mode !== "HOSTED" || !source.isActive) return;
    setVerifying(source.id);
    try {
      await api.post(`/data-sources/${source.id}/verify`);
      toast.success("Database connection verified");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Database verification failed");
    } finally { setVerifying(null); }
  };
  if (loading) return <div className="p-6 text-slate-500">Loading school database assignment…</div>;
  const hasHosted = sources.some(source => source.mode === "HOSTED");
  return <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
    <button onClick={() => navigate(`/admin/organizations/${organizationId}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-violet-600"><FiArrowLeft/>Back to organization</button>
    <header>
      <div className="text-xs font-bold uppercase tracking-wider text-violet-600">School operations</div>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Database assignment</h1>
      <p className="mt-1 text-sm text-slate-500">{org?.display_name || "School"} · Platform-managed trips and bookings.</p>
    </header>
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Current assignments</h2>
      {sources.length ? sources.map(source => <div key={source.id} className="mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold"><FiDatabase className="text-violet-600"/>{source.name}</div>
          <div className="mt-1 text-xs text-slate-500">{source.mode === "HOSTED" ? "Platform PostgreSQL" : "Legacy external database — read only"}</div>
          <div className="mt-1 text-xs text-slate-400">{source.lastVerifiedAt ? `Last verified ${new Date(source.lastVerifiedAt).toLocaleString()}` : "Not verified yet"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${source.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{source.isActive ? "Active" : "Inactive"}</span>
          <button disabled={verifying === source.id || !source.isActive || source.mode !== "HOSTED"} onClick={() => verify(source)} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{verifying === source.id ? <FiRefreshCw className="animate-spin"/> : <FiCheckCircle/>}Verify</button>
        </div>
      </div>) : <div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-5 text-sm text-slate-500">No database assignment configured.</div>}
    </div>
    <form onSubmit={save} className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">{hasHosted ? "Update platform assignment" : "Assign platform database"}</h2>
      <p className="mt-2 text-sm text-slate-500">All schools use the same platform-managed PostgreSQL database. No external credentials are required.</p>
      <label className="mt-4 block text-sm">Assignment name<input value={name} onChange={event => setName(event.target.value)} placeholder={`${org?.display_name || "School"} operational database`} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
      <div className="mt-5 flex justify-end"><button disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? "Saving…" : "Save assignment"}</button></div>
    </form>
  </div>;
}
