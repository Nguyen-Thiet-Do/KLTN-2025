// ==========================================
// 📁 src/services/fineStatisticApi.js (SỬA LẠI)
// ==========================================
import api from "./api";  // ← QUAN TRỌNG: Dùng api instance có sẵn

export const fineStatisticApi = {
  // 🔹 1. Thống kê tổng quan tiền phạt
  async getOverview() {
    try {
      const res = await api.get('/fine-statistics/overview');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được thống kê tổng quan");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getOverview:', error);
      throw error;
    }
  },

  // 🔹 2. Thống kê theo trạng thái thanh toán
  async getByStatus() {
    try {
      const res = await api.get('/fine-statistics/by-status');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được thống kê theo trạng thái");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getByStatus:', error);
      throw error;
    }
  },

  // 🔹 3. Thống kê tiền phạt theo 12 tháng
  async getMonthly() {
    try {
      const res = await api.get('/fine-statistics/monthly');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được thống kê theo tháng");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getMonthly:', error);
      throw error;
    }
  },

  // 🔹 4. Top 10 độc giả vi phạm nhiều nhất
  async getTopViolators() {
    try {
      const res = await api.get('/fine-statistics/top-violators');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được top độc giả vi phạm");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getTopViolators:', error);
      throw error;
    }
  },

  // 🔹 5. Thống kê theo loại vi phạm
  async getByType() {
    try {
      const res = await api.get('/fine-statistics/by-type');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được thống kê theo loại vi phạm");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getByType:', error);
      throw error;
    }
  },

  // 🔹 BONUS: Danh sách độc giả còn nợ tiền phạt
  async getUnpaid() {
    try {
      const res = await api.get('/fine-statistics/unpaid');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được danh sách nợ");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getUnpaid:', error);
      throw error;
    }
  },

  // 🔹 BONUS: Thống kê theo phương thức thanh toán
  async getByPaymentMethod() {
    try {
      const res = await api.get('/fine-statistics/by-payment-method');
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Không lấy được thống kê phương thức thanh toán");
      }
      return res.data.data;
    } catch (error) {
      console.error('❌ Lỗi getByPaymentMethod:', error);
      throw error;
    }
  }
};