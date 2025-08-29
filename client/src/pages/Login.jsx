// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as apiLogin } from "../services/authService";
import { useMsal } from "@azure/msal-react";

// Replace with your API Application ID URI
const API_SCOPE = "api://YOUR_API_APP_ID/access_as_user";

const Login = () => {
  const { loading, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msBusy, setMsBusy] = useState(false);
  const [msInfo, setMsInfo] = useState("");
  const navigate = useNavigate();

  const { instance, inProgress } = useMsal();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiLogin(email, password);   // sets cookie on success
      await refreshSession();            // pull user into context
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Login failed. Please try again.");
    }
  };

  async function onMsSignIn() {
    setError("");
    setMsInfo("");

    if (inProgress !== "none") {
      setMsInfo("Another Microsoft sign-in is in progress. Please wait and try again.");
      return;
    }

    setMsBusy(true);
    try {
      // 1) Interactive sign-in (request both Graph basic scopes and your API scope)
      await instance.loginPopup({ scopes: ["openid", "profile", "email", "User.Read", API_SCOPE] });

      const account = instance.getAllAccounts()[0];
      if (!account) {
        setMsInfo("Microsoft sign-in canceled or no account found.");
        return;
      }

      // 2) Get an API token to call backend SSO endpoint
      const { accessToken } = await instance.acquireTokenSilent({
        account,
        scopes: [API_SCOPE],
      });

      // 3) Exchange for your app session
      const resp = await fetch("/api/auth/login-microsoft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({}), // identity comes from the verified token
      });

      if (resp.ok) {
        await refreshSession();
        navigate("/");
        return;
      }

      // Fallback: prefill email and show server message
      setEmail(account.username || "");
      const text = await resp.text();
      setMsInfo(
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

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Login</h2>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        {/* Microsoft 365 SSO */}
        <button
          type="button"
          onClick={onMsSignIn}
          disabled={msBusy || inProgress !== "none"}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {msBusy ? "Connecting to Microsoft..." : "Sign in with Microsoft 365"}
        </button>
        {msInfo && <div className="text-xs text-gray-600">{msInfo}</div>}

        {/* Email / Password login */}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
          Login
        </button>

        <p className="text-sm text-center">
          Don’t have an account?{" "}
          <a href="/register" className="text-blue-500 underline">
            Register here
          </a>
        </p>
      </form>
    </div>
  );
};

export default Login;
