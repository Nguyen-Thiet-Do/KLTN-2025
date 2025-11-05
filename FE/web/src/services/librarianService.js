// services/librarianApi.js (chuẩn hoá dùng chung api.js)
import api from "./api";

// 📋 Danh sách thủ thư
export const getLibrarians = async () => {
  const res = await api.get("/librarian");
  return res.data;
};

// ➕ Thêm mới thủ thư
// export const createLibrarian = async (data) => {
//   const res = await api.post("/librarian", data);
//   return res.data;
// };
export const createLibrarian = async (token, data) => {
  const res = await api.post("/librarian", data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
};

// 🗑️ Xóa thủ thư
export const deleteLibrarian = async (id) => {
  const res = await api.delete(`/librarian/${id}`);
  return res.data;
};

// ✏️ Cập nhật thông tin thủ thư
export const updateLibrarian = async (id, data) => {
  const res = await api.put(`/librarian/${id}`, data);
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
