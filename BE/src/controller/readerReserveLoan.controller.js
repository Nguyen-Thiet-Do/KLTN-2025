// src/controller/readerReserveLoan.controller.js
const { reserveLoanForReaderService } = require('../service/readerReserveLoan.service');

exports.reserveLoanForReader = async (req, res) => {
  try {
    const result = await reserveLoanForReaderService(req.user, req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Lỗi đặt mượn trước',
    });
  }
};
