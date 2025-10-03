// client/src/services/apiClient.js
import axios from "axios";

const origin = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const baseURL = `${origin}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true,       // so the `token` cookie rides along too
});

// prevent /api/api/*
api.interceptors.request.use((config) => {
  if (typeof config.url === "string" && config.url.startsWith("/api/")) {
    config.url = config.url.slice(5);
  }
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

