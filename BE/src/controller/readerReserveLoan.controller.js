// src/controller/readerReserveLoan.controller.js
const { reserveLoanForReaderService, readerRequestCancelLoanSlipService } = require('../service/readerReserveLoan.service');

exports.reserveLoanForReader = async (req, res) => {
  try {
    const result = await reserveLoanForReaderService(req.user, req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    const status = err.status || err.statusCode || 500;

    return res.status(status).json({
      success: false,
      message: err.message || 'Lỗi đặt mượn trước',
    });
  }
};


/**
 * Độc giả yêu cầu huỷ phiếu
 * - PENDING -> huỷ thẳng
 * - WAITING_FOR_PICKUP -> chỉ gửi request, không huỷ ngay
 */
exports.requestCancelLoanSlip = async (req, res) => {
  try {
    const result = await readerRequestCancelLoanSlipService(req.user, {
      loanSlipId: req.params.loanSlipId,
      reason: req.body?.reason,
      loanDetailId: req.body?.loanDetailId, // ✅ thêm dòng này
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Lỗi yêu cầu huỷ phiếu',
    });
  }
};
