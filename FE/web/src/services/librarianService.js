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
  const res = await api.post("/librarian", data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
};

// ✏️ Cập nhật thông tin thủ thư
export const updateLibrarian = async (id, data, token) => {
  const res = await api.put(`/librarian/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
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
  const res = await api.put(`/librarian/${id}/restore`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
