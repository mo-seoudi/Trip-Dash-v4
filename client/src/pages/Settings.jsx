// src/pages/Settings.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMsal } from "@azure/msal-react";

// ===== MS365 config =====
// Replace with your API App ID URI from Microsoft Entra (Azure AD)
const API_SCOPE = "api://YOUR_API_APP_ID/access_as_user";
// We’ll ask for this + User.Read during login
const LOGIN_SCOPES = ["User.Read", API_SCOPE];

const Settings = () => {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ---- MS365 state ----
  const { instance, accounts } = useMsal();
  const [msBusy, setMsBusy] = useState(false);
  const [msError, setMsError] = useState("");
  const [msProfile, setMsProfile] = useState(null);

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

  // ===== MS365 helpers =====
  async function ensureMsSignedIn() {
    // If no MS account in MSAL cache, pop the login
    if (!accounts || accounts.length === 0) {
      await instance.loginPopup({ scopes: LOGIN_SCOPES });
    }
  }

  async function getApiAccessToken() {
    const account = instance.getAllAccounts()[0];
    if (!account) {
      // try sign-in if missing
      await instance.loginPopup({ scopes: LOGIN_SCOPES });
    }
    const acct = instance.getAllAccounts()[0];
    const res = await instance.acquireTokenSilent({
      account: acct,
      scopes: [API_SCOPE],
    });
    return res.accessToken;
  }

  // ===== MS365 actions =====
  async function onMsSignIn() {
    setMsError("");
    setMsBusy(true);
    try {
      await ensureMsSignedIn();
      setMsBusy(false);
      alert("Signed in with Microsoft 365!");
    } catch (e) {
      setMsBusy(false);
      setMsError(e?.message || "Microsoft sign-in failed");
    }
  }

  async function onTestMe() {
    setMsError("");
    setMsBusy(true);
    try {
      const at = await getApiAccessToken();
      const r = await fetch("/api/ms/me", {
        headers: { Authorization: `Bearer ${at}` },
      });
      if (!r.ok) throw new Error(`API /api/ms/me failed (${r.status})`);
      const data = await r.json();
      setMsProfile(data);
    } catch (e) {
      setMsError(e?.message || "Failed to fetch /ms/me");
    } finally {
      setMsBusy(false);
    }
  }

  async function onCreateEvent() {
    setMsError("");
    setMsBusy(true);
    try {
      const at = await getApiAccessToken();
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      const payload = {
        subject: "Trip Dash demo",
        start: { dateTime: now.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        body: { contentType: "HTML", content: "Created from Trip Dash Settings" },
      };
      const r = await fetch("/api/ms/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${at}`,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API /api/ms/events failed (${r.status}) ${t}`);
      }
      alert("Outlook event created in your calendar.");
    } catch (e) {
      setMsError(e?.message || "Failed to create Outlook event");
    } finally {
      setMsBusy(false);
    }
  }

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

      {/* ===== Microsoft 365 Integration Panel ===== */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-xl font-semibold mb-3">Microsoft 365 Integration</h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onMsSignIn}
            disabled={msBusy}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          >
            {accounts?.length ? "Re-check Microsoft Sign-in" : "Sign in with Microsoft 365"}
          </button>

          <button
            onClick={onTestMe}
            disabled={msBusy}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-60"
          >
            Test /ms/me
          </button>

          <button
            onClick={onCreateEvent}
            disabled={msBusy}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-60"
          >
            Create Outlook event
          </button>
        </div>

        {msError && <p className="text-red-600 mt-3">{msError}</p>}

        {msProfile && (
          <pre className="mt-4 p-3 bg-gray-50 border rounded text-xs overflow-auto max-h-64">
            {JSON.stringify(msProfile, null, 2)}
          </pre>
        )}

        <p className="text-xs text-gray-500 mt-3">
          NOTE: Requires <code>VITE_MSAL_CLIENT_ID</code> (client SPA app) on the client and the server envs
          (<code>MS_API_CLIENT_ID</code>, <code>MS_API_CLIENT_SECRET</code>, <code>MS_TENANT_ID</code>,{" "}
          <code>MS_EXPECTED_AUDIENCE</code>) to be configured.
        </p>
      </div>
    </div>
  );
};

export default Settings;
