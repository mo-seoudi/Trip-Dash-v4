// src/pages/AdminUsers.jsx 
import React, { useEffect, useState } from "react";
import api from "../services/apiClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const roles = ["admin", "school_staff", "finance", "bus_company"];
const statuses = ["approved", "pending"];

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingUserIds, setSavingUserIds] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  const handleStatusChange = (userId, newStatus) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
    );
  };

  const handleSave = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setSavingUserIds((prev) => [...prev, userId]);

    try {
      await api.put(`/users/${userId}`, {
        role: user.role,
        status: user.status,
      });
      toast.success(`User "${user.name}" updated successfully!`);
    } catch (err) {
      console.error("Failed to update user", err);
      toast.error(`Failed to update user "${user?.name}"`);
    } finally {
      setSavingUserIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table className="min-w-full bg-white border rounded-lg shadow-md">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="border rounded p-1"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={u.status || "pending"}
                    onChange={(e) => handleStatusChange(u.id, e.target.value)}
                    className="border rounded p-1"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleSave(u.id)}
                    className={`px-3 py-1 rounded text-white ${
                      savingUserIds.includes(u.id)
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    disabled={savingUserIds.includes(u.id)}
                  >
                    {savingUserIds.includes(u.id) ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminUsers;
