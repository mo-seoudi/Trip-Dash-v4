// client/src/components/UserTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../services/apiClient"; // <-- use the shared axios client

const roles = ["admin", "school_staff", "bus_company", "finance"];
const keyOf = (id) => String(id);

const UserTable = ({ users = [] }) => {
  const [editedUsers, setEditedUsers] = useState(users);
  const [originalUsers, setOriginalUsers] = useState(users);
  const [savingUserIds, setSavingUserIds] = useState([]); // array of string IDs

  // keep local state in sync when parent prop changes
  useEffect(() => {
    setEditedUsers(users);
    setOriginalUsers(users);
    // NOTE: DO NOT reset savingUserIds here; let any in-flight request finish naturally
  }, [users]);

  // which rows are dirty?
  const dirtyMap = useMemo(() => {
    const map = new Map();
    for (const u of editedUsers) {
      const orig = originalUsers.find((o) => keyOf(o.id) === keyOf(u.id));
      map.set(keyOf(u.id), !!orig && orig.role !== u.role);
    }
    return map;
  }, [editedUsers, originalUsers]);

  const handleRoleChange = (id, newRole) => {
    setEditedUsers((prev) =>
      prev.map((u) => (keyOf(u.id) === keyOf(id) ? { ...u, role: newRole } : u))
    );
  };

  const handleSave = async (id) => {
    const rowKey = keyOf(id);
    const userToUpdate = editedUsers.find((u) => keyOf(u.id) === rowKey);
    const orig = originalUsers.find((u) => keyOf(u.id) === rowKey);
    if (!userToUpdate || !orig) return;

    if (!dirtyMap.get(rowKey)) return; // nothing to save

    setSavingUserIds((prev) => [...prev, rowKey]);

    try {
      // use axios client (sends cookies + optional bearer automatically)
      await api.put(`/users/${id}`, { role: userToUpdate.role });

      // mark row as clean so Save disables again
      setOriginalUsers((prev) =>
        prev.map((u) =>
          keyOf(u.id) === rowKey ? { ...u, role: userToUpdate.role } : u
        )
      );

      toast.success(`User "${userToUpdate.name}" updated successfully!`);
    } catch (err) {
      // revert role in UI
      setEditedUsers((prev) =>
        prev.map((u) => (keyOf(u.id) === rowKey ? { ...u, role: orig.role } : u))
      );
      console.error("Update failed", err);
      const msg =
        err?.response?.status === 401
          ? "Not authorized — please log in again."
          : err?.response?.status === 403
          ? "Forbidden — you don't have permission to update users."
          : "Failed to update user.";
      toast.error(`${msg}`);
    } finally {
      setSavingUserIds((prev) => prev.filter((k) => k !== rowKey));
    }
  };

  if (!editedUsers.length) {
    return (
      <div className="w-full bg-white shadow rounded-lg p-6 text-center text-gray-500">
        No users found.
      </div>
    );
  }

  return (
    <table className="w-full bg-white shadow rounded-lg overflow-hidden">
      <thead className="bg-gray-100">
        <tr>
          <th scope="col" className="text-left p-2">Name</th>
          <th scope="col" className="text-left p-2">Email</th>
          <th scope="col" className="text-left p-2">Role</th>
          <th scope="col" className="text-left p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {editedUsers.map((user) => {
          const rowKey = keyOf(user.id);
          const isSaving = savingUserIds.includes(rowKey);
          const isDirty = !!dirtyMap.get(rowKey);
          return (
            <tr key={rowKey} className="border-t">
              <td className="p-2">{user.name}</td>
              <td className="p-2">{user.email}</td>
              <td className="p-2">
                <label className="sr-only" htmlFor={`role-${rowKey}`}>
                  Role for {user.name}
                </label>
                <select
                  id={`role-${rowKey}`}
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="border p-1 rounded"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                {/* prevents parent form submit */}
                <button
                  type="button"
                  onClick={() => handleSave(user.id)}
                  className={`px-3 py-1 rounded text-white ${
                    isSaving
                      ? "bg-gray-400 cursor-not-allowed"
                      : isDirty
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                  disabled={isSaving || !isDirty}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default UserTable;
