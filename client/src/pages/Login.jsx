// src/pages/Login.jsx
import React, { useState } from "react";
import { FiTruck, FiEye, FiEyeOff, FiArrowLeft } from "react-icons/fi";
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
  const [loginBusy, setLoginBusy] = useState(false);

  const [msBusy, setMsBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);

  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();

  async function handleLogin(e) {
    e.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setError("");
    setInfo("");
    try {
      // authService.login() already returns res.data, so the token is top-level.
      const resp = await apiLogin(email, password);

      // Keep the JWT as a bearer-token fallback for cross-origin deployments.
      if (resp?.token) {
        localStorage.setItem("token", resp.token);
      }

      await refreshSession();
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err?.response?.status === 401 ? "Incorrect email or password. Please try again." : "We couldn’t sign you in right now. Please try again.");
    } finally {
      setLoginBusy(false);
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
        // Closing the Microsoft sign-in window is not an error.
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
      setInfo(resp.status === 401 || resp.status === 403
        ? "Your Microsoft account does not have access to TripDash yet. Please contact your organization’s administrator."
        : "We couldn’t complete Microsoft sign-in. Please try again later.");
    } catch (e) {
      const code = String(e?.errorCode || e?.code || "").toLowerCase();
      const message = String(e?.message || "").toLowerCase();
      const cancelled = ["user_cancelled", "user_canceled", "popup_window_error"].some(value => code.includes(value) || message.includes(value)) && (code.includes("cancel") || message.includes("cancel") || message.includes("closed"));
      if (!cancelled) {
        console.error("Microsoft sign-in failed:", e);
        setError("We couldn’t sign you in with Microsoft. Please try again.");
      }
    } finally {
      setMsBusy(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-10 flex flex-col items-center justify-center">
      <div className="mb-7 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FiTruck size={26}/></span>
        <span className="text-3xl font-bold tracking-tight text-[#172B4D]">TripDash</span>
      </div>
      <section className="w-full max-w-[410px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#172B4D]">{forgotPassword ? "Forgot your password?" : "Welcome back"}</h1>
        <p className="mt-2 mb-6 text-sm text-slate-500">{forgotPassword ? "Password recovery is managed by your organization’s administrator." : "Sign in to access your transport workspace."}</p>
        {forgotPassword ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">Please contact your organization’s administrator to request a password reset. No reset email has been sent.</p>
            <button type="button" onClick={() => { setForgotPassword(false); setError(""); setInfo(""); }} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"><FiArrowLeft/> Back to sign in</button>
          </div>
        ) : (
          <>
            {(error || info) && <div role="alert" className={`mb-5 rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{error || info}</div>}
            <form onSubmit={handleLogin} className="space-y-4" aria-label="Email password login form">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                <input id="login-email" type="email" required autoComplete="email" placeholder="name@organization.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label>
                  <button type="button" onClick={() => setForgotPassword(true)} className="text-xs font-medium text-blue-600 hover:underline">Forgot password?</button>
                </div>
                <div className="relative">
                  <input id="login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">{showPassword ? <FiEyeOff size={18}/> : <FiEye size={18}/>}</button>
                </div>
              </div>
              <button type="submit" disabled={loginBusy || msBusy} aria-busy={loginBusy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                {loginBusy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>}
                {loginBusy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-xs font-medium text-slate-400">OR</span><div className="h-px flex-1 bg-slate-200"/></div>
            <button type="button" onClick={onMsSignIn} disabled={msBusy || loginBusy || inProgress !== "none"} className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
              </svg>
              {msBusy ? "Connecting to Microsoft…" : "Continue with Microsoft"}
            </button>
            <p className="mt-5 text-center text-xs text-slate-400">Access is managed by your organization's administrator.</p>
          </>
        )}
      </section>
      <p className="mt-7 text-xs text-slate-400">© 2026 TripDash</p>
    </main>
  );
};

export default Login;
