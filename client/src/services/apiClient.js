// 📄 client/src/services/apiClient.js
import axios from "axios";

const ROOT =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

const api = axios.create({
  baseURL: ROOT,          // e.g. http://localhost:5000
  withCredentials: true,  // needed for cookie auth
});

// Add token if you also support Bearer tokens (cookies still work without this)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
