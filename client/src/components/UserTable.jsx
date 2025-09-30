import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const roles = ["admin", "school_staff", "bus_company", "finance"];

const UserTable = ({ users = [] }) => {
  const [editedUsers, setEditedUsers] = useState(users);
  const [savingUserIds, setSavingUserIds] = useState([]); // IDs currently saving
  const [originalUsers, setOriginalUsers] = useState(users); // for revert on error

  // keep local state in sync when prop changes
  useEffect(() => {
    setEditedUsers(users);
    setOriginalUsers(users);
  }, [users]);

  // map of id -> whether row is dirty
  const dirtyMap = useMemo(() => {
    const map = new Map();
    for (const u of editedUsers) {
      const orig = originalUsers.find((o) => o.id === u.id);
      map.set(u.id, !!orig && JSON.stringify({ role: u.role }) !== JSON.stringify({ role: orig.role }));
    }
    return map;
  }, [editedUsers, originalUsers]);

  const handleRoleChange = (id, newRole) => {
    setEditedUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, role: newRole } : user))
    );
  };

  const handleSave = async (id) => {
    const userToUpdate = editedUsers.find((u) => u.id === id);
    const orig = originalUsers.find((u) => u.id === id);
    if (!userToUpdate || !orig) return;

    // no-op if not dirty
    if (!dirtyMap.get(id)) return;

    setSavingUserIds((prev) => [...prev, id]);

    try {
      const apiBase =
        process.env.REACT_APP_API_URL /* CRA */ ||
        import.meta?.env?.VITE_API_URL /* Vite */ ||
        "";

      const res = await fetch(`${apiBase}/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: userToUpdate.role }), // send minimal payload
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Optionally merge server response if it returns the updated user
      // const updated = await res.json();
      setOriginalUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: userToUpdate.role } : u))
      );

      toast.success(`User "${userToUpdate.name}" updated successfully!`);
    } catch (err) {
      // revert local change
      setEditedUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: orig.role } : u))
      );
      console.error("Update failed", err);
      toast.error(`Failed to update user "${userToUpdate.name}".`);
    } finally {
      setSavingUserIds((prev) => prev.filter((userId) => userId !== id));
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
          const isSaving = savingUserIds.includes(user.id);
          const isDirty = dirtyMap.get(user.id);
          return (
            <tr key={user.id} className="border-t">
              <td className="p-2">{user.name}</td>
              <td className="p-2">{user.email}</td>
              <td className="p-2">
                <label className="sr-only" htmlFor={`role-${user.id}`}>
                  Role for {user.name}
                </label>
                <select
                  id={`role-${user.id}`}
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
                <button
                  onClick={() => handleSave(user.id)}
                  className={`px-3 py-1 rounded text-white ${
                    isSaving
                      ? "bg-gray-400 cursor-not-allowed"
                      : isDirty
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                  disabled={isSaving || !isDirty}
                  aria-disabled={isSaving || !isDirty}
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
