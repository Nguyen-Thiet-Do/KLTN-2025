import api from "./api";

// 📋 Lấy danh sách thủ thư
export const getLibrarians = async (token) => {
  const res = await api.get("/librarian", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ➕ Thêm mới thủ thư
export const createLibrarian = async (token, data) => {
  try {
    const res = await api.post("/librarian", data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return res.data;
  } catch (error) {
    console.error("❌ Error creating librarian:", error);
    
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
// ✏️ Cập nhật thông tin thủ thư

export const updateLibrarian = async (id, data, token) => {
  try {
    const res = await api.put(`/librarian/${id}`, data, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
    });
    return res.data;
  } catch (error) {
    console.error("❌ Error updating librarian:", error);
    
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
// 🔐 Đặt lại mật khẩu thủ công
export const resetLibrarianPassword = async (id, newPassword, token) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/librarian/${id}/reset-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });
  return await res.json();
};

// 🗑️ Xóa mềm thủ thư
export const deleteLibrarian = async (id, token) => {
  const res = await api.delete(`/librarian/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ♻️ Khôi phục thủ thư
export const restoreLibrarian = async (id, token) => {
  const res = await api.put(
    `/librarian/${id}/restore`,
    {}, 
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.data;
};
