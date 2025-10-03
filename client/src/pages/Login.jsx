// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as apiLogin } from "../services/authService";
import { useMsal } from "@azure/msal-react";

const API_SCOPE = "api://YOUR_API_APP_ID/access_as_user";

const Login = () => {
  const { loading, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [msBusy, setMsBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);

  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      // ⬇️ Keep your existing service call
      const resp = await apiLogin(email, password);

      // ⬇️ NEW: if server returns a token, keep it for header auth
      if (resp?.data?.token) {
        localStorage.setItem("token", resp.data.token);
      }

      await refreshSession();
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Login failed. Please try again.");
    }
  }

  async function onMsSignIn() {
    setError("");
    setInfo("");
    if (inProgress !== "none") {
      setInfo("Another Microsoft sign-in is in progress. Please try again in a moment.");
      return;
    }
    setMsBusy(true);
    try {
      await instance.loginPopup({ scopes: ["openid", "profile", "email", "User.Read", API_SCOPE] });
      const account = instance.getAllAccounts()[0];
      if (!account) {
        setInfo("Microsoft sign-in canceled or no account found.");
        return;
      }
      const { accessToken } = await instance.acquireTokenSilent({
        account,
        scopes: [API_SCOPE],
      });
      const resp = await fetch("/api/auth/login-microsoft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        await refreshSession();
        navigate("/");
        return;
      }
      setEmail(account.username || "");
      const text = await resp.text();
      setInfo(
        `Microsoft account detected. Email prefilled${
          text ? ` — server says: ${text}` : ""
        }. You may need admin approval or to finish registration.`
      );
    } catch (e) {
      console.error(e);
      setError(e?.message || "Microsoft sign-in failed.");
    } finally {
      setMsBusy(false);
    }
  }

  function onGoogleSignIn() {
    setError("");
    setInfo("Google sign-in isn’t configured yet. This button is a placeholder.");
    setGBusy(false);
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white w-full max-w-[1100px] rounded-xl shadow-lg p-6 md:p-10">
        <h1 className="text-3xl font-semibold text-center mb-8">Log in to TripDash</h1>

        {(error || info) && (
          <div className="mb-6">
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {info && <div className="text-gray-600 text-sm mt-1">{info}</div>}
          </div>
        )}

        {/* Side-by-side layout with fixed, slimmer columns on desktop */}
        <div
          className="
            grid gap-8 justify-center
            grid-cols-1
            md:grid-cols-[420px_72px_360px]
          "
        >
          {/* Left: compact email/password form */}
          <form onSubmit={handleLogin} className="space-y-4" aria-label="Email password login form">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                placeholder="you@school.com"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60"
            >
              Log in
            </button>

            <p className="text-sm">
              Don’t have an account?{" "}
              <a href="/register" className="text-blue-600 underline">
                Register here
              </a>
            </p>
          </form>

          {/* Center: vertical OR divider (becomes horizontal on mobile) */}
          <div className="flex md:flex-col items-center justify-center">
            <div className="h-px w-full bg-gray-200 md:w-px md:h-40" />
            <span className="mx-4 md:my-3 text-sm text-gray-500 font-medium">OR</span>
            <div className="h-px w-full bg-gray-200 md:w-px md:h-40" />
          </div>

          {/* Right: SSO buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onMsSignIn}
              disabled={msBusy || inProgress !== "none"}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#2F2F2F] text-white py-3 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="2" width="9" height="9" />
                <rect x="13" y="2" width="9" height="9" />
                <rect x="2" y="13" width="9" height="9" />
                <rect x="13" y="13" width="9" height="9" />
              </svg>
              {msBusy ? "Connecting to Microsoft…" : "Continue with Microsoft"}
            </button>

            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={gBusy}
              className="w-full inline-flex items-center justify-center gap-2 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 transition disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
              </svg>
              {gBusy ? "Opening Google…" : "Continue with Google"}
            </button>

            <p className="text-xs text-gray-500">
              Single sign-on options may require your school admin to enable access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
