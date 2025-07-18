// src/pages/AdminUsers.jsx
import React, { useEffect, useState } from "react";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch users");

      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId, newRole) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error("Failed to update role");
      await fetchUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Manage Users</h2>

      {loading ? (
        <p>Loading users...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Full Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.fullName || "-"}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                    className="border p-1"
                  >
                    <option value="admin">Admin</option>
                    <option value="school_staff">School Staff</option>
                    <option value="trip_manager">Trip Manager</option>
                    <option value="bus_company">Bus Company</option>
                    <option value="finance">Finance</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {refreshing && <p className="text-sm mt-2 text-blue-500">Updating user roles...</p>}
    </div>
  );
};

export default AdminUsers;
