// src/services/readerService.js
import api from "./api";

// 📋 Lấy danh sách độc giả
export const getReaders = async () => {
  const res = await api.get("/reader");
  return res.data;
};

// ➕ Thêm mới độc giả
export const createReader = async (data) => {
  const res = await api.post("/reader", data);
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

// 🔍 Lấy độc giả theo ID (API trả { success, reader })
export const getReaderById = async (id) => {
  const res = await api.get(`/reader/${id}`);
  // Trả ra đúng object reader để FE dùng trực tiếp
  return res?.data?.reader ?? null;
};
