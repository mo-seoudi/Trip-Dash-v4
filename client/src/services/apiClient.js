// client/src/services/apiClient.js
import axios from "axios";

/**
 * Build a stable API origin:
 * - Use VITE_API_URL (no trailing slash)
 * - Strip a mistaken trailing "/api" if someone added it in the env
 *   (since we append "/api" below)
 */
const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const origin = raw
  .replace(/\/+$/, "")        // remove trailing slashes
  .replace(/\/api$/i, "");    // remove trailing "/api" if present

// Final base becomes ".../api"
const baseURL = `${origin}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // needed for auth cookies
});

/**
 * Request interceptor:
 * - Attach bearer token if present
 * - Normalize paths so callers can pass "/trips" (preferred)
 *   and accidental "/api/trips" won't produce "/api/api/trips"
 */
api.interceptors.request.use((config) => {
  // Auth header
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Normalize URL path
  if (typeof config.url === "string") {
    // If caller accidentally included "/api/...", strip the extra "api/"
    if (/^\/api\//i.test(config.url)) {
      // console.warn("apiClient: remove '/api' from request path:", config.url);
      config.url = config.url.replace(/^\/api\//i, "/");
    }
    // Ensure a single leading slash for relative paths
    if (!config.url.startsWith("http") && !config.url.startsWith("/")) {
      config.url = `/${config.url}`;
    }
  }

  return config;
});

export default api;
