// src/services/statisticApi.js
import api from "./api";

export const statisticApi = {
  // 🔹 Lấy thống kê tổng hợp (số sách, người đọc, lượt mượn, v.v.)
  async getAll() {
    const res = await api.get("/statistics");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được dữ liệu thống kê");
    }
    return res.data.data;
  },

  // 🔹 Lấy thống kê số lượt mượn theo 12 tháng
  async getMonthly() {
    const res = await api.get("/statistics/monthly");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được thống kê theo tháng");
    }
    return res.data;
  },
  async getCategory() {
    const res = await api.get("/statistics/category");
    if (!res.data?.success) throw new Error("Không lấy được thống kê danh mục");
    return res.data.data;
  },
  async getTopBooks() {
  const res = await api.get("/statistics/top-books");
  if (!res.data?.success) throw new Error("Không lấy được top 5 sách");
  return res.data.data;
}

};
