import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiChevronRight,
  FiDatabase,
  FiEdit3,
  FiGitBranch,
  FiPlus,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

const label = (value) =>
  String(value || "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

function Empty({ children, action, onAction }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
      <p className="text-sm text-slate-400">{children}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-sm font-semibold text-violet-600 hover:text-violet-700"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <span className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
          <Icon />
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-violet-600">
        View section <FiChevronRight />
      </div>
    </button>
  );
}

function Section({ id, title, description, action, onAction, children, className = "" }) {
  return (
    <section id={id} className={`scroll-mt-5 rounded-2xl border bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiPlus />
            {action}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function OrganizationControlCenter() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ organizations: [], roles: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [detailsResponse, optionsResponse] = await Promise.all([
        api.get(`/platform-control/organizations/${encodeURIComponent(organizationId)}`),
        api.get(`/platform-onboarding/organizations/${encodeURIComponent(organizationId)}/options`),
      ]);
      setData(detailsResponse.data);
      setOptions(optionsResponse.data);
    } catch (error) {
      setData(null);
      toast.error(error?.response?.data?.message || "Could not load organization");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [organizationId]);

  const jump = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const beginEdit = () => {
    const org = data?.organization || {};
    setForm({
      displayName: org.display_name || "",
      fullName: org.full_name || "",
      abbreviation: org.abbreviation || "",
      status: org.status || "active",
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/platform-control/organizations/${organizationId}`, form);
      toast.success("Organization updated");
      setEditing(false);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const membershipStatus = async (membership, status) => {
    try {
      await api.patch(
        `/platform-control/organizations/${organizationId}/memberships/${membership.id}`,
        { status },
      );
      toast.success(`Membership ${status.toLowerCase()}`);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update membership");
    }
  };

  const relationshipUpdate = async (relationship, patch) => {
    try {
      await api.patch(
        `/platform-control/organizations/${organizationId}/relationships/${relationship.id}`,
        patch,
      );
      toast.success("Relationship updated");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update relationship");
    }
  };

  const createRelationship = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(
        `/platform-onboarding/organizations/${organizationId}/relationships`,
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      );
      toast.success("Relationship added");
      setPanel(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add relationship");
    } finally {
      setSaving(false);
    }
  };

  const addUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(
        `/platform-onboarding/organizations/${organizationId}/users`,
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      );
      toast.success("User access configured");
      setPanel(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not configure user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading organization…</div>;
  }

  if (!data?.organization) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <FiArrowLeft />
          Back
        </button>
        <div className="mt-4 rounded-2xl border bg-white p-8 text-sm text-slate-500">
          Organization details could not be loaded.
        </div>
      </div>
    );
  }

  const organization = data.organization;
  const metrics = data.metrics || {};
  const tenants = data.tenants || [];
  const memberships = data.memberships || [];
  const assignments = data.role_assignments || [];
  const relationships = data.relationships || [];
  const sources = data.data_sources || [];
  const buttonClass =
    "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-violet-600"
      >
        <FiArrowLeft />
        Back
      </button>

      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {organization.abbreviation && (
              <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                {organization.abbreviation}
              </span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {label(organization.type)}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{organization.display_name}</h1>
          {organization.full_name && organization.full_name !== organization.display_name && (
            <p className="mt-1 text-sm text-slate-500">{organization.full_name}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPanel("relationship")}
            className={buttonClass}
          >
            <FiGitBranch />
            Add relationship
          </button>
          <button type="button" onClick={() => setPanel("user")} className={buttonClass}>
            <FiPlus />
            Add user
          </button>
          <button
            type="button"
            onClick={beginEdit}
            className={`${buttonClass} border-violet-600 bg-violet-600 text-white hover:bg-violet-700`}
          >
            <FiEdit3 />
            Edit organization
          </button>
        </div>
      </header>

      {editing && (
        <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <h2 className="font-bold">Organization profile</h2>
              <p className="text-sm text-slate-500">Edit the human-facing identity and status.</p>
            </div>
            <button type="button" onClick={() => setEditing(false)}>
              <FiX />
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              Display name
              <input
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Full name
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Abbreviation
              <input
                value={form.abbreviation}
                onChange={(event) => setForm({ ...form, abbreviation: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save changes
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Metric title="People" value={metrics.active_memberships || 0} icon={FiUsers} onClick={() => jump("people")} />
        <Metric title="Roles & access" value={metrics.role_assignments || 0} icon={FiShield} onClick={() => jump("roles")} />
        <Metric title="Relationships" value={metrics.relationships || 0} icon={FiGitBranch} onClick={() => jump("relationships")} />
        <Metric title="Data sources" value={metrics.active_data_sources || 0} icon={FiDatabase} onClick={() => jump("infrastructure")} />
        <Metric title="Tenant coverage" value={tenants.length} icon={FiShield} onClick={() => jump("tenants")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="tenants" title="Tenant coverage" description="Customer environments that include this organization.">
          {tenants.length ? (
            tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                className="mb-2 flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-violet-200 hover:bg-violet-50/30"
              >
                <div>
                  <div className="font-semibold">{tenant.name}</div>
                  <div className="text-xs text-slate-400">
                    {tenant.plan_key || label(tenant.subscription_mode)}
                  </div>
                </div>
                <FiChevronRight className="text-slate-400" />
              </button>
            ))
          ) : (
            <Empty>No tenant is currently linked to this organization.</Empty>
          )}
        </Section>

        <Section id="infrastructure" title="Infrastructure" description="Operational data sources connected to this organization.">
          {sources.length ? (
            <div className="grid gap-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-xl border p-4">
                  <div className="flex justify-between gap-3">
                    <b>{source.name}</b>
                    <span className={`text-xs font-semibold ${source.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                      {source.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {label(source.mode)} · {source.provider_label || source.engine}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No operational data source is connected yet.</Empty>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          id="people"
          title="People"
          description="Users who belong to this organization."
          action="Add user"
          onAction={() => setPanel("user")}
        >
          {memberships.length ? (
            <div className="divide-y">
              {memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <b>{membership.user.display_name || membership.user.email}</b>
                    <div className="text-xs text-slate-400">
                      {membership.user.email}
                      {membership.job_title ? ` · ${membership.job_title}` : ""}
                    </div>
                  </div>
                  <select
                    value={membership.status}
                    onChange={(event) => membershipStatus(membership, event.target.value)}
                    className="rounded-lg border px-2 py-1 text-xs"
                  >
                    <option>PENDING</option>
                    <option>ACTIVE</option>
                    <option>SUSPENDED</option>
                    <option>REVOKED</option>
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <Empty action="Add the first user" onAction={() => setPanel("user")}>
              No people have been added yet.
            </Empty>
          )}
        </Section>

        <Section id="roles" title="Roles & access" description="Organization-scoped roles currently assigned.">
          {assignments.length ? (
            <div className="divide-y">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <b>{assignment.user.display_name || assignment.user.email}</b>
                    <div className="text-xs text-slate-400">{assignment.user.email}</div>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {assignment.role_name || label(assignment.role)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              There are no organization-scoped role assignments yet. Roles are assigned when user access is configured.
            </Empty>
          )}
        </Section>
      </div>

      <Section
        id="relationships"
        title="Organization relationships"
        description="How this organization is connected to groups, transport operators and service partners."
        action="Add relationship"
        onAction={() => setPanel("relationship")}
      >
        {relationships.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {relationships.map((relationship) => {
              const other =
                relationship.from.id === organization.id ? relationship.to : relationship.from;
              return (
                <div key={relationship.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-violet-600">
                        {label(relationship.type)}
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">{other.display_name}</div>
                      <div className="text-xs text-slate-400">{label(other.type)}</div>
                    </div>
                    <select
                      value={String(relationship.status).toLowerCase()}
                      onChange={(event) =>
                        relationshipUpdate(relationship, { status: event.target.value })
                      }
                      className="rounded-lg border px-2 py-1 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty action="Add relationship" onAction={() => setPanel("relationship")}>
            No organization relationships have been configured.
          </Empty>
        )}
      </Section>

      {panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={panel === "relationship" ? createRelationship : addUser}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {panel === "relationship" ? "Add organization relationship" : "Add user"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {panel === "relationship"
                    ? "Connect this organization to another organization in the platform."
                    : "Add a user and configure their organization access."}
                </p>
              </div>
              <button type="button" onClick={() => setPanel(null)}>
                <FiX />
              </button>
            </div>

            {panel === "relationship" ? (
              <div className="mt-5 space-y-4">
                <label className="block text-sm">
                  Organization
                  <select
                    name="toOrganizationId"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">Select organization…</option>
                    {options.organizations.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.display_name} — {label(option.type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Relationship
                  <select
                    name="type"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    <option value="BELONGS_TO_GROUP">Belongs to group</option>
                    <option value="TRANSPORT_PROVIDER">Transport provider</option>
                    <option value="TRIP_MANAGER">Trip manager / service partner</option>
                    <option value="WORKS_WITH_TRANSPORT_PROVIDER">
                      Works with transport provider
                    </option>
                  </select>
                </label>
                <label className="block text-sm">
                  Notes
                  <input name="notes" className="mt-1 w-full rounded-lg border px-3 py-2" />
                </label>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  Display name
                  <input
                    name="displayName"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Role
                  <select
                    name="roleKey"
                    required
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">Select role…</option>
                    {options.roles
                      .filter((role) => role.key !== "super_admin")
                      .map((role) => (
                        <option key={role.id} value={role.key}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Job title
                  <input
                    name="jobTitle"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Initial password{" "}
                  <span className="text-slate-400">(new users only, minimum 10 characters)</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
