// client/src/services/apiClient.js
import axios from "axios";

// Normalize origin and avoid trailing slashes
const origin = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const baseURL = `${origin}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // send cookies (your "token" cookie)
});

// --- REQUEST INTERCEPTOR ---
// Prevent accidental "/api/api/*" and attach Authorization from localStorage
api.interceptors.request.use((config) => {
  if (typeof config.url === "string" && config.url.startsWith("/api/")) {
    config.url = config.url.slice(5); // drop leading "/api/"
  }
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- RESPONSE INTERCEPTOR ---
// Do NOT hard-redirect on 401/403; just surface the error so components / AuthContext can handle it.
// Also add some helpful logging to diagnose tab-switch reload triggers.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "(unknown URL)";
    // Gentle, informative logs — no navigation here
    if (status === 401) {
      console.debug(`[api] 401 Unauthorized from ${url} — leaving navigation to router/AuthContext.`);
    } else if (status === 403) {
      console.debug(`[api] 403 Forbidden from ${url} — likely pending/insufficient role.`);
    } else if (!status) {
      console.debug(`[api] Network/client error on ${url}:`, err?.message);
    }
    return Promise.reject(err);
  }
);

export default api;
