import React, { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const roles = ["admin", "school_staff", "bus_company", "finance"];

const UserTable = ({ users }) => {
  const [editedUsers, setEditedUsers] = useState([...users]);
  const [savingUserIds, setSavingUserIds] = useState([]); // IDs currently saving

  const handleRoleChange = (id, newRole) => {
    setEditedUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, role: newRole } : user
      )
    );
  };

  const handleSave = async (id) => {
    const userToUpdate = editedUsers.find((u) => u.id === id);
    if (!userToUpdate) return;

    setSavingUserIds((prev) => [...prev, id]);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userToUpdate),
      });

      if (!res.ok) {
        throw new Error("Failed to update user");
      }

      toast.success(`User "${userToUpdate.name}" updated successfully!`);
    } catch (err) {
      console.error("Update failed", err);
      toast.error(`Failed to update user "${userToUpdate.name}".`);
    } finally {
      setSavingUserIds((prev) => prev.filter((userId) => userId !== id));
    }
  };

  return (
    <table className="w-full bg-white shadow rounded-lg">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-2">Name</th>
          <th className="text-left p-2">Email</th>
          <th className="text-left p-2">Role</th>
          <th className="text-left p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {editedUsers.map((user) => (
          <tr key={user.id} className="border-t">
            <td className="p-2">{user.name}</td>
            <td className="p-2">{user.email}</td>
            <td className="p-2">
              <select
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
                className={`px-3 py-1 rounded ${
                  savingUserIds.includes(user.id)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                } text-white`}
                disabled={savingUserIds.includes(user.id)}
              >
                {savingUserIds.includes(user.id) ? "Saving..." : "Save"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default UserTable;
