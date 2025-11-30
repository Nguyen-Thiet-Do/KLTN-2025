// src/services/statisticApi.js
import api from "./api";

export const statisticApi = {
  // 🔹 Lấy thống kê tổng hợp
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
    return res.data.data; // ⭐ SỬA: Thêm .data
  },

  // 🔹 Thống kê theo danh mục
  async getCategory() {
    const res = await api.get("/statistics/category");
    if (!res.data?.success) throw new Error("Không lấy được thống kê danh mục");
    return res.data.data;
  },

  // 🔹 Top 5 sách được mượn nhiều nhất
  async getTopBooks() {
    const res = await api.get("/statistics/top-books");
    if (!res.data?.success) throw new Error("Không lấy được top 5 sách");
    return res.data.data;
  },

  // 🔹 Top 5 độc giả mượn nhiều nhất
  async getTopReaders() {
    const res = await api.get("/statistics/top-readers");
    if (!res.data?.success) throw new Error("Không lấy được top độc giả");
    return res.data.data;
  },

  // Tổng hợp báo cáo
  async getReportSummary() {
    const res = await api.get("/statistics/report-summary");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được báo cáo tổng hợp");
    }
    return res.data.data;
  },

  // Lượt mượn theo ngày trong tuần
  async getBorrowByDay() {
    const res = await api.get("/statistics/borrow-by-day");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được dữ liệu");
    }
    return res.data.data;
  },

  // Sách chưa từng được mượn
  async getNeverBorrowed() {
    const res = await api.get("/statistics/never-borrowed");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được danh sách");
    }
    return res.data.data;
  },

  // Độc giả không hoạt động
  async getInactiveReaders() {
    const res = await api.get("/statistics/inactive-readers");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được danh sách");
    }
    return res.data.data;
  }
};