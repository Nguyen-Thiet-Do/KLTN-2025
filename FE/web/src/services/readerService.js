import api from "./api";

// 📋 Lấy danh sách độc giả
export const getReaders = async () => {
  const res = await api.get("/reader");
  return res.data;
};

// ➕ Thêm mới độc giả
export const createReader = async (token, data) => {
  const res = await api.post("/reader", data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
};

// 🗑️ Xóa độc giả
export const deleteReader = async (id) => {
  const res = await api.delete(`/reader/${id}`);
  return res.data;
};

// ✏️ Cập nhật thông tin độc giả
export const updateReader = async (id, data) => {
  const res = await api.put(`/reader/${id}`, data);
  return res.data;
};

// 🔍 Lấy độc giả theo ID
export const getReaderById = async (id) => {
  const res = await api.get(`/reader/${id}`);
  return res?.data?.reader ?? null;
};

// 🔐 Đặt lại mật khẩu thủ công
export const resetReaderPassword = async (id, newPassword, token) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/reader/${id}/reset-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });
  return await res.json();
};
//khoiphuc doc gia
export const restoreReader = async (id, token) => {
  const res = await api.put(
    `/reader/${id}/restore`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.data;
};
// // ✅ Lấy thông tin độc giả hiện tại (Reader tự xem)
// export const getCurrentReader = async (token) => {
//   const res = await api.get("/profile/me", {  // Đảm bảo đường dẫn là '/api/profile/me'
//     headers: { Authorization: `Bearer ${token}` },
//   });
//   return res.data;
// };


// ✅ Cập nhật thông tin PROFILE của chính mình (chỉ Reader fields)
export const updateCurrentReaderProfile = async (data, token) => {
  const res = await api.put("/profile/me", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ✅ Cập nhật thông tin ACCOUNT của chính mình (email, phoneNumber, password)
export const updateCurrentAccount = async (data, token) => {
  const res = await api.put("/profile/account", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ✅ Cập nhật TOÀN BỘ thông tin (Account + Reader) - DÙNG API NÀY
export const updateCurrentReader = async (data, token) => {
  const res = await api.put("/profile/full", data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};