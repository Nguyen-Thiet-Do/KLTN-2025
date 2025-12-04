// ==========================================
// 📁 routes/fineStatisticRoutes.js
// ==========================================
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const fineStatisticController = require("../controller/fineStatisticController");

// ✅ Áp dụng middleware cho toàn bộ router
// Chỉ Admin (1) và Thủ thư (2) được truy cập
router.use(requireAuth);
router.use(requireRole([1, 2]));

// ========== 5 ROUTES CHÍNH ==========

// 🔹 1. Thống kê tổng quan tiền phạt
router.get("/overview", fineStatisticController.getFineOverview);

// 🔹 2. Thống kê theo trạng thái thanh toán
router.get("/by-status", fineStatisticController.getFineByPaymentStatus);

// 🔹 3. Thống kê theo tháng (12 tháng)
router.get("/monthly", fineStatisticController.getMonthlyFines);

// 🔹 4. Top 10 độc giả vi phạm nhiều nhất
router.get("/top-violators", fineStatisticController.getTopViolators);

// 🔹 5. Thống kê theo loại vi phạm
router.get("/by-type", fineStatisticController.getFineByViolationType);

// ========== ROUTES BONUS ==========

// 🔹 Danh sách độc giả còn nợ
router.get("/unpaid", fineStatisticController.getUnpaidFines);

// 🔹 Thống kê theo phương thức thanh toán
router.get("/by-payment-method", fineStatisticController.getFineByPaymentMethod);

module.exports = router;