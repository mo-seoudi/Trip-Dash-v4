// src/pages/Login.jsx
import React, { useState } from "react";
import { FiArrowRight, FiEye, FiEyeOff, FiTruck, FiCheck, FiCalendar } from "react-icons/fi";
import "./Login.css";
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
  const [signingIn, setSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();

  async function handleLogin(e) {
    e.preventDefault();
    if (signingIn || msBusy) return;
    setSigningIn(true);
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
      setError(err?.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setSigningIn(false);
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

  if (loading) return <div className="td-login-loading" role="status">Opening Trip Dash…</div>;

  const busy = signingIn || msBusy;
  return <main className="td-login">
    <section className="td-login-intro" aria-label="About Trip Dash">
      <a className="td-login-brand" href="/login"><span><FiTruck /></span>Trip Dash</a>
      <div className="td-login-story">
        <p className="td-login-eyebrow">SCHOOL TRANSPORT, CONNECTED</p>
        <h1>A clear journey.<br/>For every trip.</h1>
        <p className="td-login-description">One workspace for schools and transport teams to request trips, coordinate transport and keep every booking moving.</p>
        <div className="td-login-illustration" aria-hidden="true">
          <div className="td-login-illustration-head"><span><FiCalendar/> The journey at a glance</span><span className="td-login-live">Connected workflow</span></div>
          <div className="td-login-route"><span className="td-login-dot"/><div><small>FROM</small><strong>School</strong></div><div className="td-login-route-line"/><FiArrowRight/><div><small>TO</small><strong>Your next destination</strong></div></div>
          <div className="td-login-phases"><span><FiCheck/> Request</span><FiArrowRight/><span className="td-login-phase-active">Coordinate</span><FiArrowRight/><span>Ready to travel</span></div>
          <p>Clear stages. Shared responsibility. One next step.</p>
        </div>
      </div>
      <p className="td-login-intro-footer">Single trips · Multiple dates · Recurring transport</p>
    </section>
    <section className="td-login-access" aria-labelledby="signin-title">
      <div className="td-login-form-wrap">
        <p className="td-login-eyebrow">YOUR TRANSPORT WORKSPACE</p>
        <h2 id="signin-title">Welcome back</h2>
        <p className="td-login-subtitle">Sign in to manage your bookings and trips.</p>
        {error&&<div className="td-login-message is-error" role="alert">{error}</div>}
        {info&&<div className="td-login-message" role="status">{info}</div>}
        <form onSubmit={handleLogin} aria-label="Email and password sign in">
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" type="email" placeholder="you@organisation.com" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" disabled={busy}/>
          <label htmlFor="login-password">Password</label>
          <div className="td-login-password"><input id="login-password" type={showPassword?"text":"password"} placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" disabled={busy}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword}>{showPassword?<FiEyeOff/>:<FiEye/>}</button></div>
          <button className="td-login-submit" type="submit" disabled={busy} aria-busy={signingIn}>{signingIn?"Signing in…":<>Sign in <FiArrowRight/></>}</button>
        </form>
        <div className="td-login-divider"><span>or use your work account</span></div>
        <button className="td-login-microsoft" type="button" onClick={onMsSignIn} disabled={busy||inProgress!=="none"} aria-busy={msBusy}><svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path fill="#f25022" d="M0 0h9v9H0z"/><path fill="#7fba00" d="M11 0h9v9h-9z"/><path fill="#00a4ef" d="M0 11h9v9H0z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>{msBusy?"Connecting…":"Continue with Microsoft"}</button>
        <p className="td-login-account">New to Trip Dash? <a href="/register">Create an account</a></p>
        <p className="td-login-help">Your administrator manages access to your organisation’s workspace.</p>
      </div>
      <footer className="td-login-access-footer">Trip Dash · School transport operations</footer>
    </section>
  </main>;
};
export default Login;
