import axios from "axios";
import { toast } from "sonner";

const TOKEN_KEY = "om_token";

/**
 * Central axios instance used by all API calls.
 * Automatically attaches the Bearer token and handles auth errors.
 */
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 and 403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear and redirect to login
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else if (error.response?.status === 403) {
      toast.error("You don't have permission to do that");
    }
    return Promise.reject(error);
  }
);

export default api;
