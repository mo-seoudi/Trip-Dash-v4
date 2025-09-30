import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const roles = ["admin", "school_staff", "bus_company", "finance"];

// normalize to string so includes() never fails due to type differences
const keyOf = (id) => String(id);

const UserTable = ({ users = [] }) => {
  const [editedUsers, setEditedUsers] = useState(users);
  const [originalUsers, setOriginalUsers] = useState(users);
  const [savingUserIds, setSavingUserIds] = useState([]); // array of string keys

  // keep local state in sync if parent refetches
  useEffect(() => {
    setEditedUsers(users);
    setOriginalUsers(users);
  }, [users]);

  // which rows are dirty?
  const dirtyMap = useMemo(() => {
    const map = new Map();
    for (const u of editedUsers) {
      const orig = originalUsers.find((o) => keyOf(o.id) === keyOf(u.id));
      const dirty = !!orig && orig.role !== u.role;
      map.set(keyOf(u.id), dirty);
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

    // nothing to save
    if (!dirtyMap.get(rowKey)) return;

    setSavingUserIds((prev) => [...prev, rowKey]);

    try {
      const apiBase =
        process.env.REACT_APP_API_URL /* CRA */ ||
        import.meta?.env?.VITE_API_URL /* Vite */ ||
        "";

      const res = await fetch(`${apiBase}/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: userToUpdate.role }), // minimal payload
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // if your API returns the updated user, you could merge it here instead
      setOriginalUsers((prev) =>
        prev.map((u) =>
          keyOf(u.id) === rowKey ? { ...u, role: userToUpdate.role } : u
        )
      );

      toast.success(`User "${userToUpdate.name}" updated successfully!`);
    } catch (err) {
      // revert UI on failure
      setEditedUsers((prev) =>
        prev.map((u) =>
          keyOf(u.id) === rowKey ? { ...u, role: orig.role } : u
        )
      );
      console.error("Update failed", err);
      toast.error(`Failed to update user "${userToUpdate.name}".`);
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
