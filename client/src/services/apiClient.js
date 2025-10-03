// client/src/services/apiClient.js
import axios from "axios";

// If VITE_API_URL is "https://api.example.com" (or with trailing slash),
// this produces "https://api.example.com/api"
const origin = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const baseURL = `${origin}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // send/receive cookies
});

// Prevent accidental `/api/api/*` if any caller prefixes "/api"
api.interceptors.request.use((config) => {
  if (typeof config.url === "string" && config.url.startsWith("/api/")) {
    config.url = config.url.slice(5); // drop leading "/api/"
  }
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
