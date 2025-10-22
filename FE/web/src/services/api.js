// services/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Gắn access token cho mọi request (nếu có)
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper lấy message từ lỗi BE
const pickMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.response?.data?.detail ||
  (Array.isArray(err?.response?.data?.errors) && err.response.data.errors[0]?.message) ||
  err?.message ||
  "Có lỗi xảy ra.";

// Refresh token nếu 401 (trừ request auth/skip)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error?.response?.status;

    const url = original?.url || "";
    const skipRefresh =
      original.__skipRefresh ||
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password");

    if (!skipRefresh && status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = sessionStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        // BE của bạn trả kiểu:
        // { success, message, data: { accessToken, refreshToken? } }
        const newAccess = res?.data?.data?.accessToken;
        const newRefresh = res?.data?.data?.refreshToken;

        if (!newAccess) throw new Error("No new access token");

        sessionStorage.setItem("accessToken", newAccess);
        if (newRefresh) sessionStorage.setItem("refreshToken", newRefresh);

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        sessionStorage.clear();
        if (!skipRefresh) window.location.href = "/login";
        return Promise.reject(new Error(pickMessage(e)));
      }
    }

    return Promise.reject(new Error(pickMessage(error)));
  }
);

export default api;
