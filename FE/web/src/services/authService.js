// src/services/authService.js
import api from "./api";

/**
 * 🔐 Login
 */
export const login = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

/**
 * 📝 Bước 1: Khởi tạo đăng ký – gửi OTP
 */
export const registerInit = async (email) => {
  const response = await api.post("/auth/register/init", { email });
  return response.data;
};

/**
 * 📝 Bước 2: Xác thực OTP + tạo Account + Reader
 */
export const registerVerify = async (payload) => {
  // payload: { email, otp, password, fullName, phoneNumber, dateOfBirth, gender, cccd, address }
  const response = await api.post("/auth/register/verify", payload);
  return response.data;
};

/**
 * Bước 2.5: Upload ảnh avatar
 * formData: FormData với key 'avatar' => file
 * Ví dụ:
 *   const fd = new FormData();
 *   fd.append('avatar', file);
 *   await uploadAvatar(fd);
 */
export const uploadAvatar = async (formData) => {
  const config = {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  };
  const response = await api.post("/files/upload/avatar", formData, config);
  return response.data;
};

/**
 * 💳 Bước 3: Hoàn tất đăng ký (chọn thẻ FREE/PREMIUM)
 */
export const registerComplete = async (payload) => {
  // payload: { readerId, cardTypeId, action, avatarUrl?, extraInfo? }
  // - action: 'SKIP' (free) or 'PAY'
  // - if backend requires avatar for card issuance, include avatarUrl (string)
  const response = await api.post("/auth/register/complete", payload);
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
 * 💳 Complete Registration (Tạo thẻ) - alias có thể dùng token tùy trường hợp
 */
export const completeRegistration = async (payload, token = null) => {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  const response = await api.post("/auth/register/complete", payload, config);
  return response.data;
};

export const topupMemberCard = async (payload, token = null) => {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  const response = await api.post("/member-cards/topup", payload, config);
  return response.data;
};

/**
 * ⭐ EXPORT GIỐNG CŨ – Cho phép dùng:
 *    import { authService } from "../services/authService"
 */
export const authService = {
  login,
  registerInit,
  registerVerify,
  uploadAvatar,        // <-- mới thêm
  registerComplete,
  logout,
  getCurrentUser,
  completeRegistration,
  topupMemberCard,
};

/**
 * ⭐ Export default nếu muốn import dạng:
 *    import authService from "../services/authService"
 */
export default authService;
