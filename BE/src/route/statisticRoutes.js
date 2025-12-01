// ==========================================
// 📁 routes/statisticRoutes.js
// ==========================================
const express = require("express");
const router = express.Router();
const statisticController = require("../controller/statisticController");

// ========== ROUTES CŨ (GIỮ NGUYÊN) ==========

// 🔹 Tổng hợp thống kê
router.get("/", statisticController.getAllStatistics);

// 🔹 Biểu đồ 12 tháng
router.get("/monthly", statisticController.getMonthlyStatistics);

// 🔹 Thống kê theo danh mục
router.get("/category", statisticController.getCategoryStatistics);

// 🔹 Top 5 sách
router.get("/top-books", statisticController.getTop5MostBorrowedBooks);

// 🔹 Top 5 độc giả
router.get("/top-readers", statisticController.getTop5Readers);

// ========== ⭐ 4 ROUTES MỚI (THÊM VÀO) ==========

// 🔹 Báo cáo tổng hợp
router.get("/report-summary", statisticController.getReportSummary);

// 🔹 Mượn theo ngày trong tuần
router.get("/borrow-by-day", statisticController.getBorrowByDayOfWeek);

// 🔹 Sách chưa được mượn
router.get("/never-borrowed", statisticController.getNeverBorrowedBooks);

// 🔹 Độc giả không hoạt động
router.get("/inactive-readers", statisticController.getInactiveReaders);

module.exports = router;