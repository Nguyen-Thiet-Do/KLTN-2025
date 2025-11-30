// ==========================================
// 📁 controller/statisticController.js
// ==========================================
const statisticService = require("../service/statisticService");

// ========== CÁC CONTROLLER CŨ (GIỮ NGUYÊN) ==========
const getAllStatistics = async (req, res) => {
  try {
    const data = await statisticService.getLibraryStatistics();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMonthlyStatistics = async (req, res) => {
  try {
    const data = await statisticService.getMonthlyLoans();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCategoryStatistics = async (req, res) => {
  try {
    const data = await statisticService.getCategoryStatistics();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTop5MostBorrowedBooks = async (req, res) => {
  try {
    const data = await statisticService.getTop5MostBorrowedBooks();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTop5Readers = async (req, res) => {
  try {
    const data = await statisticService.getTop5Readers();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========== ⭐ 4 CONTROLLER MỚI (THÊM VÀO) ==========

const getBorrowByDayOfWeek = async (req, res) => {
  try {
    const data = await statisticService.getBorrowByDayOfWeek();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getNeverBorrowedBooks = async (req, res) => {
  try {
    const data = await statisticService.getNeverBorrowedBooks();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getInactiveReaders = async (req, res) => {
  try {
    const data = await statisticService.getInactiveReaders();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getReportSummary = async (req, res) => {
  try {
    const data = await statisticService.getReportSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========== EXPORT TẤT CẢ ==========
module.exports = {
  // Controller cũ
  getAllStatistics,
  getMonthlyStatistics,
  getCategoryStatistics,
  getTop5MostBorrowedBooks,
  getTop5Readers,
  
  // ⭐ Controller mới
  getBorrowByDayOfWeek,
  getNeverBorrowedBooks,
  getInactiveReaders,
  getReportSummary
};