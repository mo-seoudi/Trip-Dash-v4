// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/apiClient";
import { useMsal } from "@azure/msal-react";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("school_staff");
  const [error, setError] = useState("");
  const [msBusy, setMsBusy] = useState(false);
  const [msError, setMsError] = useState("");

  const navigate = useNavigate();
  const { instance } = useMsal();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", { email, password, name, role });
      alert("Registration successful! Wait for admin approval before logging in.");
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Registration failed.");
    }
  };

  async function onMsSignIn() {
    setMsBusy(true);
    setMsError("");
    try {
      // Ask for minimal scope now; you can add "User.Read" if you want a Graph token later
      await instance.loginPopup({ scopes: ["User.Read"] });
      const acct = instance.getAllAccounts()[0];
      if (acct) {
        // Prefill from Microsoft account
        if (!name) setName(acct.name || "");
        if (!email) setEmail(acct.username || "");
      }
    } catch (e) {
      setMsError(e?.message || "Microsoft sign-in failed");
    } finally {
      setMsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Register</h2>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          type="button"
          onClick={onMsSignIn}
          disabled={msBusy}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {msBusy ? "Connecting to Microsoft..." : "Sign in with Microsoft 365 (prefill)"}
        </button>
        {msError && <div className="text-red-600 text-xs">{msError}</div>}

        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-2 border rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

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

        <select
          className="w-full p-2 border rounded"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="school_staff">School Staff</option>
          <option value="bus_company">Bus Company</option>
          <option value="finance">Finance</option>
        </select>

        <button type="submit" className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600">
          Register
        </button>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <a href="/login" className="text-blue-500 underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
};

export default Register;


