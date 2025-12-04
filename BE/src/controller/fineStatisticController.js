// ==========================================
// 📁 controller/fineStatisticController.js
// ==========================================
const fineStatisticService = require("../service/fineStatisticService");

// 🔹 1. Thống kê tổng quan
const getFineOverview = async (req, res) => {
  try {
    const data = await fineStatisticService.getFineOverview();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getFineOverview:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 2. Thống kê theo trạng thái thanh toán
const getFineByPaymentStatus = async (req, res) => {
  try {
    const data = await fineStatisticService.getFineByPaymentStatus();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getFineByPaymentStatus:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 3. Thống kê theo tháng
const getMonthlyFines = async (req, res) => {
  try {
    const data = await fineStatisticService.getMonthlyFines();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getMonthlyFines:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 4. Top 10 độc giả vi phạm
const getTopViolators = async (req, res) => {
  try {
    const data = await fineStatisticService.getTopViolators();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getTopViolators:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 5. Thống kê theo loại vi phạm
const getFineByViolationType = async (req, res) => {
  try {
    const data = await fineStatisticService.getFineByViolationType();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getFineByViolationType:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 BONUS: Danh sách nợ
const getUnpaidFines = async (req, res) => {
  try {
    const data = await fineStatisticService.getUnpaidFines();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getUnpaidFines:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 BONUS: Theo phương thức thanh toán
const getFineByPaymentMethod = async (req, res) => {
  try {
    const data = await fineStatisticService.getFineByPaymentMethod();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Lỗi getFineByPaymentMethod:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getFineOverview,
  getFineByPaymentStatus,
  getMonthlyFines,
  getTopViolators,
  getFineByViolationType,
  getUnpaidFines,
  getFineByPaymentMethod
};