import React, { useMemo, useState } from "react";
import { FiPlus, FiSave, FiTrash2, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  tenant_admin: "Tenant Admin",
  group_staff: "Group Staff",
  school_staff: "School Staff",
  bus_operator: "Bus Operator",
  service_partner: "Service Partner",
  finance: "Finance",
};

const STATUS_OPTIONS = ["approved", "pending", "blocked"];

function ActionButton({ children, danger = false, disabled = false, onClick, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function UserAccessEditor({ user, memberships, scopes, organizations, onChanged }) {
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [showScopeForm, setShowScopeForm] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [membershipDraft, setMembershipDraft] = useState({ organization_id: "", role: "school_staff", status: "approved", is_primary: false });
  const [scopeDraft, setScopeDraft] = useState({ membership_id: "", school_organization_id: "" });

  const schools = useMemo(() => organizations.filter((org) => org.type === "SCHOOL"), [organizations]);
  const organizationsById = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);

  const refresh = async () => {
    if (onChanged) await onChanged();
  };

  const addMembership = async (event) => {
    event.preventDefault();
    if (!membershipDraft.organization_id) return toast.error("Choose an organization");
    setBusyKey("add-membership");
    try {
      await api.post("/access-admin/memberships", {
        user_id: user.id,
        organization_id: membershipDraft.organization_id,
        role: membershipDraft.role,
        status: membershipDraft.status,
        is_primary: membershipDraft.is_primary,
      });
      toast.success("Membership added");
      setShowMembershipForm(false);
      setMembershipDraft({ organization_id: "", role: "school_staff", status: "approved", is_primary: false });
      await refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add membership");
    } finally {
      setBusyKey(null);
    }
  };

  const patchMembership = async (membership, patch) => {
    setBusyKey(`membership-${membership.id}`);
    try {
      await api.patch(`/access-admin/memberships/${membership.id}`, patch);
      toast.success("Membership updated");
      await refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update membership");
    } finally {
      setBusyKey(null);
    }
  };

  const removeMembership = async (membership) => {
    const organizationName = membership.organization?.display_name || "this organization";
    if (!window.confirm(`Remove ${user.display_name} from ${organizationName}?`)) return;
    setBusyKey(`membership-${membership.id}`);
    try {
      await api.delete(`/access-admin/memberships/${membership.id}`);
      toast.success("Membership removed");
      await refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not remove membership");
    } finally {
      setBusyKey(null);
    }
  };

  const addScope = async (event) => {
    event.preventDefault();
    const membership = memberships.find((item) => String(item.id) === String(scopeDraft.membership_id));
    if (!membership || !scopeDraft.school_organization_id) return toast.error("Choose a membership and a school");
    setBusyKey("add-scope");
    try {
      await api.post("/access-admin/scopes", {
        user_id: user.id,
        organization_id: membership.organization_id,
        role: membership.role,
        school_organization_id: scopeDraft.school_organization_id,
      });
      toast.success("School scope added");
      setShowScopeForm(false);
      setScopeDraft({ membership_id: "", school_organization_id: "" });
      await refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add school scope");
    } finally {
      setBusyKey(null);
    }
  };

  const removeScope = async (scope) => {
    setBusyKey(`scope-${scope.organization_id}-${scope.school_organization_id}-${scope.role}`);
    try {
      await api.delete("/access-admin/scopes", {
        data: {
          user_id: user.id,
          organization_id: scope.organization_id,
          role: scope.role,
          school_organization_id: scope.school_organization_id,
        },
      });
      toast.success("School scope removed");
      await refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not remove school scope");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <section className="rounded-xl bg-slate-50 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Memberships & roles</div>
            <div className="mt-1 text-xs text-slate-500">Where this user belongs and what they may do there.</div>
          </div>
          <ActionButton onClick={() => setShowMembershipForm((value) => !value)}>
            {showMembershipForm ? <FiX /> : <FiPlus />} {showMembershipForm ? "Cancel" : "Add"}
          </ActionButton>
        </div>

        {showMembershipForm && (
          <form onSubmit={addMembership} className="mb-3 grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2">
            <select value={membershipDraft.organization_id} onChange={(e) => setMembershipDraft((d) => ({ ...d, organization_id: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
              <option value="">Choose organization</option>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.display_name} · {org.type.replaceAll("_", " ")}</option>)}
            </select>
            <select value={membershipDraft.role} onChange={(e) => setMembershipDraft((d) => ({ ...d, role: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
              {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select value={membershipDraft.status} onChange={(e) => setMembershipDraft((d) => ({ ...d, status: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm text-slate-600">
              <input type="checkbox" checked={membershipDraft.is_primary} onChange={(e) => setMembershipDraft((d) => ({ ...d, is_primary: e.target.checked }))} /> Primary membership
            </label>
            <div className="sm:col-span-2 flex justify-end"><ActionButton type="submit" disabled={busyKey === "add-membership"}><FiSave /> {busyKey === "add-membership" ? "Saving…" : "Save membership"}</ActionButton></div>
          </form>
        )}

        <div className="space-y-2">
          {memberships.map((membership) => (
            <div key={membership.id} className="rounded-lg border bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium text-slate-900">{membership.organization?.display_name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{membership.is_primary ? "Primary · " : ""}{membership.status}</div>
                </div>
                <ActionButton danger onClick={() => removeMembership(membership)} disabled={busyKey === `membership-${membership.id}`}><FiTrash2 /> Remove</ActionButton>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={membership.role} disabled={busyKey === `membership-${membership.id}`} onChange={(e) => patchMembership(membership, { role: e.target.value })} className="rounded-lg border px-2.5 py-2 text-sm">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select value={membership.status === "active" ? "approved" : membership.status} disabled={busyKey === `membership-${membership.id}`} onChange={(e) => patchMembership(membership, { status: e.target.value })} className="rounded-lg border px-2.5 py-2 text-sm">
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
                </select>
              </div>
            </div>
          ))}
          {!memberships.length && <div className="text-sm text-slate-400">No organization memberships</div>}
        </div>
      </section>

      <section className="rounded-xl bg-slate-50 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Restricted school access</div>
            <div className="mt-1 text-xs text-slate-500">Optional scopes narrow inherited organization access to selected schools.</div>
          </div>
          <ActionButton onClick={() => setShowScopeForm((value) => !value)} disabled={!memberships.length || !schools.length}>
            {showScopeForm ? <FiX /> : <FiPlus />} {showScopeForm ? "Cancel" : "Add"}
          </ActionButton>
        </div>

        {showScopeForm && (
          <form onSubmit={addScope} className="mb-3 grid gap-2 rounded-lg border bg-white p-3">
            <select value={scopeDraft.membership_id} onChange={(e) => setScopeDraft((d) => ({ ...d, membership_id: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
              <option value="">Membership to restrict</option>
              {memberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.organization?.display_name} · {ROLE_LABELS[membership.role] || membership.role}</option>)}
            </select>
            <select value={scopeDraft.school_organization_id} onChange={(e) => setScopeDraft((d) => ({ ...d, school_organization_id: e.target.value }))} className="rounded-lg border px-2.5 py-2 text-sm">
              <option value="">Choose school</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.display_name}</option>)}
            </select>
            <div className="flex justify-end"><ActionButton type="submit" disabled={busyKey === "add-scope"}><FiSave /> {busyKey === "add-scope" ? "Saving…" : "Save scope"}</ActionButton></div>
          </form>
        )}

        <div className="space-y-2">
          {scopes.map((scope) => {
            const parentOrg = organizationsById.get(scope.organization_id);
            const busy = busyKey === `scope-${scope.organization_id}-${scope.school_organization_id}-${scope.role}`;
            return (
              <div key={`${scope.organization_id}-${scope.school_organization_id}-${scope.role}`} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3">
                <div>
                  <div className="font-medium text-slate-900">{scope.school?.display_name || scope.school?.abbreviation}</div>
                  <div className="mt-0.5 text-xs text-slate-500">Via {parentOrg?.display_name || scope.organization?.display_name} · {ROLE_LABELS[scope.role] || scope.role}</div>
                </div>
                <ActionButton danger onClick={() => removeScope(scope)} disabled={busy}><FiTrash2 /> Remove</ActionButton>
              </div>
            );
          })}
          {!scopes.length && <div className="text-sm text-slate-400">No additional school restriction</div>}
        </div>
      </section>
    </div>
  );
}

export default UserAccessEditor;
