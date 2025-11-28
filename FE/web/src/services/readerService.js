import api from "./api";

// 📋 Lấy danh sách độc giả
export const getReaders = async () => {
  const res = await api.get("/reader");
  return res.data;
};

// ➕ Thêm mới độc giả

export const createReader = async (token, data) => {
  try {
    const res = await api.post("/reader", data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return res.data;
  } catch (error) {
    console.error("❌ Error creating reader:", error);
    
    // ✅ Xử lý lỗi đúng cách
    if (error.response?.data) {
      // API trả về lỗi rõ ràng
      return error.response.data;
    }
    
    // Lỗi network hoặc khác
    return {
      success: false,
      message: error.message || "Không thể kết nối đến máy chủ"
    };
  }
};
// 🗑️ Xóa độc giả
export const deleteReader = async (id) => {
  const res = await api.delete(`/reader/${id}`);
  return res.data;
};

// ✏️ Cập nhật thông tin độc giả

export const updateReader = async (readerId, data, token) => {
  try {
    const response = await api.put(
      `/reader/${readerId}`,  // ← Sửa từ /readers thành /reader
      data,
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    // ✅ Trả về đúng data từ API
    return response.data;
    
  } catch (error) {
    console.error("❌ Error updating reader:", error);
    
    // ✅ XỬ LÝ LỖI ĐÚNG CÁCH
    if (error.response?.data) {
      // API trả về lỗi rõ ràng (bao gồm cả lỗi validation như số điện thoại trùng)
      return error.response.data;
    }
    
    // Lỗi network hoặc khác
    return {
      success: false,
      message: error.message || "Không thể kết nối đến máy chủ"
    };
  }
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
// 🔒 KHÓA tài khoản độc giả
export const lockReaderAccount = async (id, token) => {
  const res = await api.put(
    `/reader/${id}/lock`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

// 🔓 MỞ KHÓA tài khoản độc giả
export const unlockReaderAccount = async (id, token) => {
  const res = await api.put(
    `/reader/${id}/unlock`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};