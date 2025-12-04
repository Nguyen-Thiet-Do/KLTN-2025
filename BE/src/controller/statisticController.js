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

const getReportByDateRange = async (req, res) => {
  try {
    const { from, to } = req.query;

    // ✅ Validate input
    if (!from || !to) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng cung cấp đầy đủ thông tin từ ngày và đến ngày" 
      });
    }

    // ✅ Validate date format
    const fromDate = new Date(from);  
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: "Định dạng ngày không hợp lệ" 
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Ngày bắt đầu phải trước ngày kết thúc" 
      });
    }

    console.log('📅 Query params:', { from, to });

    // ✅ Gọi service
    const data = await statisticService.getReportByDateRange(from, to);

    console.log('✅ Result:', data);

    return res.json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error("❌ Lỗi getReportByDateRange controller:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi server: " + error.message 
    });
  }
};

const getFineReportByDateRange = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số from hoặc to"
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Ngày không hợp lệ"
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "from phải nhỏ hơn hoặc bằng to"
      });
    }

    const data = await statisticService.getFineReportByDateRange(from, to);

    return res.json({
      success: true,
      data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
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
  getReportSummary,
  getReportByDateRange,
  getFineReportByDateRange
};