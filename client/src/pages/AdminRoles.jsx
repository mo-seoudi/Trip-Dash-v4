// src/pages/AdminRoles.jsx
import React, { useState, useEffect } from "react";

const defaultRoles = {
  school_staff: {
    canRequestTrips: true,
    canEditTrips: false,
    canChangeStatus: false,
    canMarkPaid: false,
    accessFinance: false,
  },
  bus_company: {
    canRequestTrips: false,
    canEditTrips: true,
    canChangeStatus: true,
    canMarkPaid: false,
    accessFinance: false,
  },
  finance: {
    canRequestTrips: false,
    canEditTrips: true,
    canChangeStatus: false,
    canMarkPaid: true,
    accessFinance: true,
  },
};

const permissionLabels = {
  canRequestTrips: "Request Trips",
  canEditTrips: "Edit Trips",
  canChangeStatus: "Change Status",
  canMarkPaid: "Mark Paid",
  accessFinance: "Finance Access",
};

function AdminRoles() {
  const [roles, setRoles] = useState({});
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    const savedRoles = localStorage.getItem("roles");
    if (savedRoles) {
      setRoles(JSON.parse(savedRoles));
    } else {
      setRoles(defaultRoles);
    }
  }, []);

  const handleToggle = (role, perm) => {
    setRoles((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role][perm],
      },
    }));
  };

  const handleSave = () => {
    localStorage.setItem("roles", JSON.stringify(roles));
    alert("Roles saved locally.");
  };

  const handleAddRole = () => {
    const key = newRole.trim().toLowerCase().replace(/ /g, "_");
    if (!key || roles[key]) {
      alert("Invalid or duplicate role name.");
      return;
    }

    const emptyPerms = Object.keys(permissionLabels).reduce((acc, perm) => {
      acc[perm] = false;
      return acc;
    }, {});

    setRoles((prev) => ({
      ...prev,
      [key]: emptyPerms,
    }));

    setNewRole("");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Role Permissions</h1>
      <p className="text-gray-600">Manage what each role can access and do in the system.</p>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="Add new role (e.g., Trip Coordinator)"
          className="border px-3 py-2 rounded w-64"
        />
        <button
          onClick={handleAddRole}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Role
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white shadow rounded-xl">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Role</th>
              {Object.entries(permissionLabels).map(([key, label]) => (
                <th key={key} className="p-3 text-center">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(roles).map(([role, perms]) => (
              <tr key={role} className="border-t">
                <td className="p-3 font-semibold capitalize">
                  {role.replace(/_/g, " ")}
                </td>
                {Object.keys(permissionLabels).map((permKey) => (
                  <td key={permKey} className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={perms[permKey]}
                      onChange={() => handleToggle(role, permKey)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Save Changes
      </button>
    </div>
  );
}

export default AdminRoles;
