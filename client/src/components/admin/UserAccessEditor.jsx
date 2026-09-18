import React, { useMemo, useState } from "react";
import { FiPlus, FiSave, FiTrash2, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

const MEMBERSHIP_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "REVOKED"];

function ActionButton({ children, danger = false, disabled = false, onClick, type = "button" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{children}</button>;
}

function UserAccessEditor({ user, memberships, roleAssignments = [], organizations, roles = [], tenantId, onChanged }) {
  const [showMembershipForm, setShowMembershipForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [membershipDraft, setMembershipDraft] = useState({ organization_id: "", status: "ACTIVE", is_primary: false });
  const [roleDraft, setRoleDraft] = useState({ role: "", scope_type: "ORGANIZATION", organization_id: "" });
  const organizationsById = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);
  const roleLabels = useMemo(() => new Map(roles.map((role) => [role.key, role.name])), [roles]);
  const refresh = async () => { if (onChanged) await onChanged(); };

  const addMembership = async (event) => {
    event.preventDefault();
    if (!membershipDraft.organization_id) return toast.error("Choose an organization");
    setBusyKey("add-membership");
    try {
      await api.post("/access-admin/memberships", { user_id: user.id, ...membershipDraft });
      toast.success("Membership added");
      setShowMembershipForm(false);
      setMembershipDraft({ organization_id: "", status: "ACTIVE", is_primary: false });
      await refresh();
    } catch (error) { toast.error(error?.response?.data?.message || "Could not add membership"); }
    finally { setBusyKey(null); }
  };

  const patchMembership = async (membership, patch) => {
    setBusyKey(`membership-${membership.id}`);
    try { await api.patch(`/access-admin/memberships/${membership.id}`, patch); toast.success("Membership updated"); await refresh(); }
    catch (error) { toast.error(error?.response?.data?.message || "Could not update membership"); }
    finally { setBusyKey(null); }
  };

  const removeMembership = async (membership) => {
    const organizationName = membership.organization?.display_name || "this organization";
    if (!window.confirm(`Remove ${user.display_name} from ${organizationName}? Organization-scoped roles for this membership will also be removed.`)) return;
    setBusyKey(`membership-${membership.id}`);
    try { await api.delete(`/access-admin/memberships/${membership.id}`); toast.success("Membership removed"); await refresh(); }
    catch (error) { toast.error(error?.response?.data?.message || "Could not remove membership"); }
    finally { setBusyKey(null); }
  };

  const addRoleAssignment = async (event) => {
    event.preventDefault();
    if (!roleDraft.role) return toast.error("Choose a role");
    const payload = { user_id: user.id, role: roleDraft.role, scope_type: roleDraft.scope_type };
    if (roleDraft.scope_type === "TENANT") payload.tenant_id = tenantId;
    if (roleDraft.scope_type === "ORGANIZATION") {
      if (!roleDraft.organization_id) return toast.error("Choose an organization");
      payload.organization_id = roleDraft.organization_id;
    }
    setBusyKey("add-role");
    try {
      await api.post("/access-admin/role-assignments", payload);
      toast.success("Role assigned");
      setShowRoleForm(false);
      setRoleDraft({ role: "", scope_type: "ORGANIZATION", organization_id: "" });
      await refresh();
    } catch (error) { toast.error(error?.response?.data?.message || "Could not assign role"); }
    finally { setBusyKey(null); }
  };

  const removeRoleAssignment = async (assignment) => {
    if (!window.confirm(`Remove the ${roleLabels.get(assignment.role) || assignment.role} role?`)) return;
    setBusyKey(`role-${assignment.id}`);
    try { await api.delete(`/access-admin/role-assignments/${assignment.id}`); toast.success("Role removed"); await refresh(); }
    catch (error) { toast.error(error?.response?.data?.message || "Could not remove role"); }
    finally { setBusyKey(null); }
  };

  return <div className="mt-4 grid gap-4 xl:grid-cols-2">
    <section className="rounded-xl bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Organization memberships</div><div className="mt-1 text-xs text-slate-500">Where this user belongs. Roles are assigned separately.</div></div><ActionButton onClick={() => setShowMembershipForm(v => !v)}>{showMembershipForm ? <FiX /> : <FiPlus />} {showMembershipForm ? "Cancel" : "Add"}</ActionButton></div>
      {showMembershipForm && <form onSubmit={addMembership} className="mb-3 grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2">
        <select value={membershipDraft.organization_id} onChange={e => setMembershipDraft(d => ({...d, organization_id:e.target.value}))} className="rounded-lg border px-2.5 py-2 text-sm"><option value="">Choose organization</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.display_name} · {String(org.type).replaceAll("_", " ")}</option>)}</select>
        <select value={membershipDraft.status} onChange={e => setMembershipDraft(d => ({...d, status:e.target.value}))} className="rounded-lg border px-2.5 py-2 text-sm">{MEMBERSHIP_STATUSES.map(status => <option key={status}>{status}</option>)}</select>
        <label className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm text-slate-600"><input type="checkbox" checked={membershipDraft.is_primary} onChange={e => setMembershipDraft(d => ({...d,is_primary:e.target.checked}))}/> Primary membership</label>
        <div className="flex justify-end"><ActionButton type="submit" disabled={busyKey === "add-membership"}><FiSave /> Save membership</ActionButton></div>
      </form>}
      <div className="space-y-2">{memberships.map(membership => <div key={membership.id} className="rounded-lg border bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-medium text-slate-900">{membership.organization?.display_name}</div><div className="mt-0.5 text-xs text-slate-500">{membership.is_primary ? "Primary · " : ""}{membership.status}</div></div><ActionButton danger onClick={() => removeMembership(membership)} disabled={busyKey === `membership-${membership.id}`}><FiTrash2 /> Remove</ActionButton></div><select value={membership.status} disabled={busyKey === `membership-${membership.id}`} onChange={e => patchMembership(membership,{status:e.target.value})} className="mt-3 w-full rounded-lg border px-2.5 py-2 text-sm">{MEMBERSHIP_STATUSES.map(status => <option key={status}>{status}</option>)}</select></div>)}{!memberships.length && <div className="text-sm text-slate-400">No organization memberships</div>}</div>
    </section>

    <section className="rounded-xl bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role assignments</div><div className="mt-1 text-xs text-slate-500">Canonical permissions at platform, tenant, or organization scope.</div></div><ActionButton onClick={() => setShowRoleForm(v => !v)}>{showRoleForm ? <FiX /> : <FiPlus />} {showRoleForm ? "Cancel" : "Assign"}</ActionButton></div>
      {showRoleForm && <form onSubmit={addRoleAssignment} className="mb-3 grid gap-2 rounded-lg border bg-white p-3">
        <select value={roleDraft.role} onChange={e => setRoleDraft(d => ({...d,role:e.target.value}))} className="rounded-lg border px-2.5 py-2 text-sm"><option value="">Choose role</option>{roles.map(role => <option key={role.key} value={role.key}>{role.name}</option>)}</select>
        <select value={roleDraft.scope_type} onChange={e => setRoleDraft(d => ({...d,scope_type:e.target.value,organization_id:""}))} className="rounded-lg border px-2.5 py-2 text-sm"><option value="ORGANIZATION">Organization</option><option value="TENANT">Tenant</option><option value="PLATFORM">Platform</option></select>
        {roleDraft.scope_type === "ORGANIZATION" && <select value={roleDraft.organization_id} onChange={e => setRoleDraft(d => ({...d,organization_id:e.target.value}))} className="rounded-lg border px-2.5 py-2 text-sm"><option value="">Choose organization</option>{memberships.filter(m => m.status === "ACTIVE").map(m => <option key={m.organization_id} value={m.organization_id}>{m.organization?.display_name}</option>)}</select>}
        <div className="flex justify-end"><ActionButton type="submit" disabled={busyKey === "add-role"}><FiSave /> Assign role</ActionButton></div>
      </form>}
      <div className="space-y-2">{roleAssignments.map(assignment => { const org=organizationsById.get(assignment.organization_id); const scope=assignment.scope_type === "PLATFORM" ? "Platform" : assignment.scope_type === "TENANT" ? "Tenant" : org?.display_name || "Organization"; return <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3"><div><div className="font-medium text-slate-900">{roleLabels.get(assignment.role) || assignment.role}</div><div className="mt-0.5 text-xs text-slate-500">{scope} · {assignment.is_active ? "Active" : "Inactive"}</div></div><ActionButton danger onClick={() => removeRoleAssignment(assignment)} disabled={busyKey === `role-${assignment.id}`}><FiTrash2 /> Remove</ActionButton></div>; })}{!roleAssignments.length && <div className="text-sm text-slate-400">No role assignments</div>}</div>
    </section>
  </div>;
}

export default UserAccessEditor;
