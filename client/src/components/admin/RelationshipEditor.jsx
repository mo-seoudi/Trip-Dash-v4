import React, { useMemo, useState } from "react";
import { FiLink2, FiPlus, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import api from "@/services/apiClient";

function RelationshipEditor({ organizations = [], relationships = [], onChanged }) {
  const schools = useMemo(
    () => organizations.filter((org) => org.type === "SCHOOL"),
    [organizations],
  );
  const operators = useMemo(
    () => organizations.filter((org) => org.type === "BUS_OPERATOR"),
    [organizations],
  );

  const [schoolId, setSchoolId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const createRelationship = async (event) => {
    event.preventDefault();
    if (!schoolId || !operatorId) return;
    setSaving(true);
    try {
      await api.post("/access-admin/relationships", {
        type: "TRANSPORT_PROVIDER",
        from_organization_id: schoolId,
        to_organization_id: operatorId,
        notes: notes.trim() || undefined,
      });
      setSchoolId("");
      setOperatorId("");
      setNotes("");
      toast.success("Transport provider relationship added");
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not add organization relationship");
    } finally {
      setSaving(false);
    }
  };

  const removeRelationship = async (relationship) => {
    const school = relationship.from_organization?.display_name || "this school";
    const operator = relationship.to_organization?.display_name || "this bus operator";
    if (!window.confirm(`Remove ${operator} as transport provider for ${school}?`)) return;

    setRemovingId(relationship.id);
    try {
      await api.delete(`/access-admin/relationships/${relationship.id}`);
      toast.success("Transport provider relationship removed");
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not remove organization relationship");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={createRelationship} className="rounded-xl border bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FiLink2 className="text-violet-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Add transport provider</div>
            <div className="text-xs text-slate-500">Link a school to the Bus Operator that provides its transport service.</div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">School</span>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select school</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.display_name}{school.abbreviation ? ` (${school.abbreviation})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Bus Operator</span>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select Bus Operator</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.display_name}{operator.abbreviation ? ` (${operator.abbreviation})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-sm text-slate-700">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Operational notes about this relationship"
            className="w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={saving || !schoolId || !operatorId}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus /> {saving ? "Adding…" : "Add relationship"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {relationships.map((relationship) => (
          <article key={relationship.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900">{relationship.from_organization?.display_name}</div>
              <div className="text-xs text-slate-500">School</div>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
              <FiLink2 /> Transport Provider
            </div>
            <div className="min-w-0 flex-1 md:text-right">
              <div className="font-semibold text-slate-900">{relationship.to_organization?.display_name}</div>
              <div className="text-xs text-slate-500">Bus Operator</div>
            </div>
            <button
              type="button"
              onClick={() => removeRelationship(relationship)}
              disabled={removingId === relationship.id}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <FiTrash2 /> {removingId === relationship.id ? "Removing…" : "Remove"}
            </button>
            {relationship.notes ? <div className="w-full text-xs text-slate-500 md:basis-full">{relationship.notes}</div> : null}
          </article>
        ))}
      </div>

      {!relationships.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No transport-provider relationships have been configured.
        </div>
      ) : null}

      {!schools.length || !operators.length ? (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Add at least one School and one Bus Operator organization before creating a transport-provider relationship.
        </div>
      ) : null}
    </div>
  );
}

export default RelationshipEditor;
