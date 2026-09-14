import React, { useMemo, useState } from "react";
import { FiEdit2, FiGrid, FiPlus, FiSave, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

const TYPES = [
  ["SCHOOL_GROUP", "School Group", "edu_group"],
  ["SCHOOL", "School", "school"],
  ["BUS_OPERATOR", "Bus Operator", "bus_company"],
  ["SERVICE_PARTNER", "Service Partner", "service_partner"],
];

function typeLabel(type) {
  return TYPES.find(([key]) => key === type)?.[1] || type;
}

function legacyType(type) {
  return TYPES.find(([key]) => key === type)?.[2] || type.toLowerCase();
}

function OrganizationEditor({ tenantId, organizations = [], search = "", onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    display_name: "",
    abbreviation: "",
    type: "SCHOOL",
    parent_org_id: "",
  });

  const groups = useMemo(
    () => organizations.filter((org) => org.type === "SCHOOL_GROUP"),
    [organizations],
  );

  const q = search.trim().toLowerCase();
  const visible = organizations.filter((org) =>
    !q || `${org.display_name} ${org.full_name || ""} ${org.abbreviation || ""} ${org.type}`.toLowerCase().includes(q),
  );

  const reset = () => {
    setEditingId(null);
    setShowForm(false);
    setDraft({ display_name: "", abbreviation: "", type: "SCHOOL", parent_org_id: "" });
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft({ display_name: "", abbreviation: "", type: "SCHOOL", parent_org_id: "" });
    setShowForm(true);
  };

  const startEdit = (org) => {
    setEditingId(org.id);
    setDraft({
      display_name: org.display_name || "",
      abbreviation: org.abbreviation || "",
      type: org.type || "SCHOOL",
      parent_org_id: org.parent_org_id || "",
    });
    setShowForm(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!tenantId || !draft.display_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: draft.display_name.trim(),
        type: legacyType(draft.type),
        code: draft.abbreviation.trim() || null,
        parent_org_id: draft.type === "SCHOOL" ? (draft.parent_org_id || null) : null,
      };

      if (editingId) {
        await api.patch(`/global/orgs/${editingId}`, payload);
        toast.success("Organization updated");
      } else {
        await api.post("/global/orgs", { tenant_id: tenantId, ...payload });
        toast.success("Organization created");
      }
      reset();
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Organization directory</div>
          <div className="mt-1 text-xs text-slate-500">Manage School Groups, Schools, Bus Operators and Service Partners. The abbreviation is the short label used where space is limited.</div>
        </div>
        <button type="button" onClick={showForm ? reset : startCreate} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {showForm ? <FiX /> : <FiPlus />} {showForm ? "Close" : "Add organization"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded-xl border p-4">
          <div className="mb-4 flex items-start gap-2">
            <FiGrid className="mt-0.5 text-violet-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{editingId ? "Edit organization" : "New organization"}</div>
              <div className="text-xs text-slate-500">Display name is the main bold name shown throughout TripDash.</div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Display name</span>
              <input value={draft.display_name} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} maxLength={200} placeholder="Repton Dubai" className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Abbreviation</span>
              <input value={draft.abbreviation} onChange={(e) => setDraft((d) => ({ ...d, abbreviation: e.target.value.toUpperCase() }))} maxLength={50} placeholder="RDXB" className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
              <span className="mt-1 block text-xs text-slate-400">Used in compact tables, reports and calendar views.</span>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Organization type</span>
              <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, parent_org_id: e.target.value === "SCHOOL" ? d.parent_org_id : "" }))} className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500">
                {TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Parent School Group</span>
              <select value={draft.parent_org_id} onChange={(e) => setDraft((d) => ({ ...d, parent_org_id: e.target.value }))} disabled={draft.type !== "SCHOOL"} className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100">
                <option value="">No parent group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.display_name}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            The current legacy control-plane table stores one organization name field. The separate Full Name and hidden Legal Entity Name fields already exist in the canonical v2 schema and will become editable after the access-data migration, without changing this screen's main display-name behavior.
          </div>

          <div className="mt-4 flex justify-end border-t pt-4">
            <button type="submit" disabled={saving || !draft.display_name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
              <FiSave /> {saving ? "Saving…" : editingId ? "Save changes" : "Create organization"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((org) => {
          const parent = organizations.find((candidate) => candidate.id === org.parent_org_id);
          return (
            <article key={org.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    {org.abbreviation ? <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{org.abbreviation}</span> : null}
                    <div>
                      <div className="font-semibold text-slate-900">{org.display_name}</div>
                      {org.full_name && org.full_name !== org.display_name ? <div className="mt-0.5 text-xs text-slate-500">{org.full_name}</div> : null}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">{typeLabel(org.type)}{parent ? ` · ${parent.display_name}` : ""}</div>
                </div>
                <button type="button" onClick={() => startEdit(org)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><FiEdit2 /> Edit</button>
              </div>
            </article>
          );
        })}
      </div>

      {!visible.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No organizations match this search.</div> : null}
    </div>
  );
}

export default OrganizationEditor;
