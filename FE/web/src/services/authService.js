import api from "./api";

/**
 * 🔐 Login
 */
export const login = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

/**
 * 📝 Register Reader
 */
export const register = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

/**
 * 🚪 Logout
 */
export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

/**
 * 👤 Get Current User
 */
export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

/**
 * 💳 Complete Registration (Tạo thẻ)
 */
export const completeRegistration = async (payload, token = null) => {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  const response = await api.post("/auth/register/complete", payload, config);
  return response.data;
};

/**
 * ⭐ EXPORT GIỐNG CŨ – Cho phép dùng:
 *    import { authService } from "../services/authService"
 */
export const authService = {
  login,
  register,
  logout,
  getCurrentUser,
  completeRegistration,
};

/**
 * ⭐ Export default nếu muốn import dạng:
 *    import authService from "../services/authService"
 */
export default authService;
