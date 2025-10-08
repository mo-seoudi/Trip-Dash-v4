// src/pages/Settings.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const Settings = () => {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!profile) return <div className="p-6">Loading user...</div>;

  const handleUpdate = (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      return setError("Name is required.");
    }

    if (password && password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    // You can later implement actual DB update logic here if needed
    setMessage("Profile update simulated (not saved to database yet).");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white shadow rounded mt-6">
      <h2 className="text-2xl font-bold mb-4">Account Settings</h2>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Email</label>
          <input
            type="email"
            value={profile.email}
            readOnly
            className="w-full p-2 border rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Role</label>
          <input
            type="text"
            value={profile.role}
            readOnly
            className="w-full p-2 border rounded bg-gray-100 text-gray-700"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep current"
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-600">{message}</p>}

        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
};

export default Settings;
