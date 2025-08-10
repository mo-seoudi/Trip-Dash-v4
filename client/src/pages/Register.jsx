// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/apiClient";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("school_staff");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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


  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Register</h2>

        {error && <div className="text-red-600 text-sm">{error}</div>}

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

