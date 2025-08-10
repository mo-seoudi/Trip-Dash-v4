// client/src/services/apiClient.js
import axios from "axios";

// If VITE_API_URL is "http://localhost:5000" or "http://localhost:5000/",
// this will produce "http://localhost:5000/api"
const origin = (import.meta.env.VITE_API_URL || "http://localhost:5000")
  .replace(/\/+$/, "");
const baseURL = `${origin}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
