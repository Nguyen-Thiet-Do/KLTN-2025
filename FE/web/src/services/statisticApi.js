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
    return res.data.data;
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

  // 🔹 Tổng hợp báo cáo
  async getReportSummary() {
    const res = await api.get("/statistics/report-summary");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được báo cáo tổng hợp");
    }
    return res.data.data;
  },

  // 🔹 Lượt mượn theo ngày trong tuần
  async getBorrowByDay() {
    const res = await api.get("/statistics/borrow-by-day");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được dữ liệu");
    }
    return res.data.data;
  },

  // 🔹 Sách chưa từng được mượn
  async getNeverBorrowed() {
    const res = await api.get("/statistics/never-borrowed");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được danh sách");
    }
    return res.data.data;
  },

  // 🔹 Độc giả không hoạt động
  async getInactiveReaders() {
    const res = await api.get("/statistics/inactive-readers");
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được danh sách");
    }
    return res.data.data;
  },

  // ⭐ Báo cáo theo khoảng thời gian (GỘP 2 HÀM TRÙNG)
  async getReportLoans(from, to) {
    try {
      console.log('📡 Calling API with params:', { from, to });
      
      const response = await api.get("/statistics/report-loans", {
        params: { from, to }
      });

      console.log('📡 API Response:', response.data);

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Lỗi không xác định");
      }

      return response.data.data;

    } catch (error) {
      console.error('❌ API Error:', error);
      
      if (error.response) {
        // Server trả về lỗi
        throw new Error(error.response.data?.message || "Lỗi từ server");
      } else if (error.request) {
        // Không nhận được response
        throw new Error("Không thể kết nối đến server");
      } else {
        // Lỗi khác
        throw new Error(error.message || "Đã có lỗi xảy ra");
      }
    }
  },
  // 🔹 Thống kê tiền phạt theo khoảng thời gian
async getFineReport(from, to) {
  try {
    const res = await api.get("/statistics/fine-report", {
      params: { from, to }
    });

    if (!res.data?.success) {
      throw new Error(res.data?.message || "Không lấy được báo cáo tiền phạt");
    }

    return res.data.data;

  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data?.message || "Lỗi server");
    }
    if (error.request) {
      throw new Error("Không kết nối được server");
    }
    throw new Error(error.message);
  }
}

};