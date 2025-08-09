// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/apiClient";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const { loading, setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await api.post("/api/auth/login", { email, password });
      const { token, user } = response.data;

      if (user.status !== "approved") {
        setError("Your account is pending approval by admin.");
        return;
      }

      // Save token and set session
      localStorage.setItem("token", token);
      setSession(user);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Login</h2>

        {error && <div className="text-red-600 text-sm">{error}</div>}

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

