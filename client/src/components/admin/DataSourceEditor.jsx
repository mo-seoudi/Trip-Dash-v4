import React, { useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiDatabase, FiEdit2, FiPlus, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

const PROVIDERS = [
  ["supabase", "Supabase PostgreSQL"],
  ["neon", "Neon PostgreSQL"],
  ["postgresql", "Other PostgreSQL"],
];

const MODES = [
  ["HOSTED", "Hosted"],
  ["CUSTOMER_POSTGRES", "Customer PostgreSQL"],
];

function Pill({ children }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>;
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function providerLabel(value) {
  return PROVIDERS.find(([key]) => key === value)?.[1] || "PostgreSQL";
}

function DataSourceEditor({ organizations = [], dataSources = [], loading = false, onChanged }) {
  const schools = useMemo(() => organizations.filter((org) => org.type === "SCHOOL"), [organizations]);
  const organizationsById = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);

  const [schoolId, setSchoolId] = useState("");
  const [provider, setProvider] = useState("supabase");
  const [mode, setMode] = useState("HOSTED");
  const [secretRef, setSecretRef] = useState("");
  const [hostHint, setHostHint] = useState("");
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [statusId, setStatusId] = useState(null);

  const reset = () => {
    setSchoolId("");
    setProvider("supabase");
    setMode("HOSTED");
    setSecretRef("");
    setHostHint("");
    setActive(true);
    setEditingId(null);
  };

  const edit = (source) => {
    setEditingId(source.id);
    setSchoolId(source.organizationId);
    setProvider(source.provider || "postgresql");
    setMode(source.mode || "HOSTED");
    setSecretRef("");
    setHostHint("");
    setActive(Boolean(source.isActive));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!schoolId || (!editingId && !secretRef.trim())) return;
    setSaving(true);
    try {
      const payload = {
        provider,
        mode,
        is_active: active,
        ...(secretRef.trim() ? { secret_ref: secretRef.trim() } : {}),
        ...(hostHint.trim() ? { host_hint: hostHint.trim() } : {}),
      };
      await api.put(`/data-sources/${schoolId}`, payload);
      toast.success(editingId ? "Operational data source updated" : "Operational data source added");
      reset();
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save the operational data source");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (source, isActive) => {
    setStatusId(source.id);
    try {
      await api.patch(`/data-sources/${source.id}/status`, { is_active: isActive });
      toast.success(isActive ? "Data source activated" : "Data source deactivated");
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not change data-source status");
    } finally {
      setStatusId(null);
    }
  };

  const verify = async (source) => {
    setVerifyingId(source.id);
    try {
      await api.post(`/data-sources/${source.id}/verify`);
      toast.success("Operational database connection verified");
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not verify the operational database connection");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Each school resolves to one active operational PostgreSQL database. The browser stores only a secret reference; the actual database credential remains server-side and is never shown here.
      </div>

      <form onSubmit={save} className="rounded-xl border p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <FiDatabase className="mt-0.5 text-violet-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{editingId ? "Edit operational data source" : "Add operational data source"}</div>
              <div className="text-xs text-slate-500">Configure which PostgreSQL database a school uses for operational TripDash data.</div>
            </div>
          </div>
          {editingId ? <button type="button" onClick={reset} className="text-xs font-medium text-slate-500 hover:text-slate-800">Cancel edit</button> : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">School</span>
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={Boolean(editingId)} className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100">
              <option value="">Select school</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.display_name}{school.abbreviation ? ` (${school.abbreviation})` : ""}</option>)}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={Boolean(editingId)} className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100">
              {MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">PostgreSQL provider</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500">
              {PROVIDERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Secret reference</span>
            <input value={secretRef} onChange={(e) => setSecretRef(e.target.value)} maxLength={500} placeholder={editingId ? "Leave blank to keep current credential" : "infisical://prod/databases/school-db"} className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
            <span className="mt-1 block text-xs text-slate-400">Use a vault/environment reference only. Never paste a database password here.</span>
          </label>

          <label className="text-sm text-slate-700 lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Host hint (optional)</span>
            <input value={hostHint} onChange={(e) => setHostHint(e.target.value)} maxLength={250} placeholder="Example: db.example.neon.tech" className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
            <span className="mt-1 block text-xs text-slate-400">This is metadata for provider identification, not the database credential or connection string.</span>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Make this the active operational database for the school
          </label>
          <button type="submit" disabled={saving || !schoolId || (!editingId && !secretRef.trim())} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
            <FiPlus /> {saving ? "Saving…" : editingId ? "Save changes" : "Add data source"}
          </button>
        </div>
      </form>

      {loading && !dataSources.length ? <div className="py-10 text-center text-sm text-slate-500">Loading operational data sources…</div> : null}

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
                <div className="flex flex-wrap gap-2"><Pill>{providerLabel(source.provider)}</Pill><Pill>{source.isActive ? "Active" : "Inactive"}</Pill></div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Mode</dt><dd className="mt-1 text-slate-700">{source.mode === "CUSTOMER_POSTGRES" ? "Customer PostgreSQL" : "Hosted"}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Credential</dt><dd className="mt-1 text-slate-700">{source.secretConfigured ? "Configured" : "Missing"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Last verified</dt><dd className="mt-1 flex items-center gap-2 text-slate-700">{verified ? <FiCheckCircle className="text-emerald-600" /> : <FiAlertCircle className="text-amber-600" />} {formatDate(source.lastVerifiedAt)}</dd></div>
              </dl>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => edit(source)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FiEdit2 /> Edit</button>
                <button type="button" onClick={() => setStatus(source, !source.isActive)} disabled={statusId === source.id} className="rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{statusId === source.id ? "Saving…" : source.isActive ? "Deactivate" : "Activate"}</button>
                <button type="button" onClick={() => verify(source)} disabled={verifyingId === source.id || !source.secretConfigured || !source.isActive} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <FiRefreshCw className={verifyingId === source.id ? "animate-spin" : ""} /> {verifyingId === source.id ? "Verifying…" : "Verify connection"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && !dataSources.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No operational data sources have been configured for this tenant yet.</div> : null}
      {!schools.length ? <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Create a School organization before configuring an operational database.</div> : null}
    </div>
  );
}

export default DataSourceEditor;
