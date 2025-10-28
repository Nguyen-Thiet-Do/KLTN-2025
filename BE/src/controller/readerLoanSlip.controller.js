// src/controller/readerLoanSlip.controller.js
const { getMyLoanHistoryService } = require('../service/readerLoanSlip.service');

exports.getMyLoanHistory = async (req, res) => {
  try {
    // Chỉ dành cho roleId = 3 (đã kiểm tra ở routes)
    const payload = await getMyLoanHistoryService(req.user, req.query);
    return res.json({ success: true, ...payload });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 404 ? err.message : 'Lỗi lấy lịch sử mượn trả',
      error: status === 500 ? err.message : undefined,
    });
  }
};
