// client/src/pages/AdminApprovals.jsx

import React, { useEffect, useState } from "react";
import { getPendingUsers, approveUser } from "../services/userService";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminApprovals() {
  const { session } = useAuth(); // assume this holds current user
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!session) return;
    if (session.role !== "admin") {
      navigate("/"); // not admin
      return;
    }
    load();
  }, [session]);

  async function load() {
    try {
      setErr("");
      const data = await getPendingUsers();
      setRows(data);
    } catch {
      setErr("Failed to load pending users.");
    }
  }

  async function onApprove(id) {
    try {
      await approveUser(id);
      setRows(rows.filter(r => r.id !== id));
    } catch {
      alert("Approve failed");
    }
  }

  if (!session) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Pending Users</h1>
      {err && <div className="text-red-600 mb-3">{err}</div>}
      <div className="space-y-2">
        {rows.length === 0 && <div>No pending users 🎉</div>}
        {rows.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded shadow">
            <div>
              <div className="font-medium">{u.name} ({u.email})</div>
              <div className="text-sm text-gray-600">{u.role} • {u.status}</div>
            </div>
            <button
              onClick={() => onApprove(u.id)}
              className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Approve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
