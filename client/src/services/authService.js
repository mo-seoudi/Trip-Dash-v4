// 📄 File path: src/services/authService.js

import api from "./apiClient";

// 🔐 Login
export const login = async (email, password) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data; // includes token or session
};

// 🚪 Logout
export const logout = async () => {
  await api.post("/auth/logout");
};

// 👤 Get current user (session)
export const getSession = async () => {
  const res = await api.get("/auth/session");
  return res.data; // user object or null
};

// 👤 Get user profile by ID
export const getUserProfile = async (uid) => {
  const res = await api.get(`/users/${uid}`);
  return res.data;
};
