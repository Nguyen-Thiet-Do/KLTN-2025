// src/services/readerService.js
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL;

// 📋 Lấy danh sách độc giả
export const getReaders = async (token) => {
  const res = await axios.get(`${API_URL}/reader`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ➕ Thêm mới độc giả
export const createReader = async (token, data) => {
  const res = await axios.post(`${API_URL}/reader`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// 🗑️ Xóa độc giả
export const deleteReader = async (id, token) => {
  const res = await axios.delete(`${API_URL}/reader/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ✏️ Cập nhật thông tin độc giả
export const updateReader = async (id, data, token) => {
  const res = await axios.put(`${API_URL}/reader/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
