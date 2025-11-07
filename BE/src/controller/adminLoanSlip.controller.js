// src/controller/adminLoanSlip.controller.js
const {
  getAllLoanSlipsService,
  createLoanSlipService,
  createLoanSlipPaymentQRService,
  confirmLoanSlipPaymentService,
  approveReservationService,
  getBorrowableCopiesService,
} = require('../service/adminLoanSlip.service');

exports.getAllLoanSlips = async (req, res) => {
  try {
    const payload = await getAllLoanSlipsService(req.query);
    return res.json({ success: true, ...payload });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi lấy danh sách phiếu mượn',
      error: err.message,
    });
  }
};

exports.createLoanSlip = async (req, res) => {
  try {
    const result = await createLoanSlipService(req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tạo phiếu mượn',
      error: err.message,
    });
  }
};

exports.createLoanSlipPaymentQR = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const { amount, description } = req.body || {};
    const result = await createLoanSlipPaymentQRService({
      loanSlipId: Number(loanSlipId),
      amount,
      description,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tạo QR thanh toán cho phiếu mượn',
      error: err.message,
    });
  }
};

exports.confirmLoanSlipPayment = async (req, res) => {
  try {
    const { loanSlipId, paymentId } = req.params;
    const { transactionCode } = req.body || {};
    const result = await confirmLoanSlipPaymentService({
      loanSlipId: loanSlipId ? Number(loanSlipId) : undefined,
      paymentId: paymentId ? Number(paymentId) : undefined,
      transactionCode,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi xác nhận thanh toán',
      error: err.message,
    });
  }
};

exports.approveReservation = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const {
      librarianId,
      dueDate,
      pricingMode,    // 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL'
      deposits,       // [{ loanDetailId, depositAmount }]
      assignments,    // [{ loanDetailId, documentCopyId }]
      createPayment,  // boolean
    } = req.body || {};

    const result = await approveReservationService({
      loanSlipId: Number(loanSlipId),
      librarianId: Number(librarianId),
      dueDate,
      pricingMode,
      deposits,
      assignments,
      createPayment,
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || err.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi duyệt phiếu đặt trước',
      error: err.message,
    });
  }
};

/**
 * NEW: Lấy danh sách bản sao có thể mượn (AVAILABLE) của 1 document
 * Query hỗ trợ: ?page=1&limit=20&q=barcode&exclude=10,11
 */
exports.getBorrowableCopies = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { page, limit, q, exclude } = req.query;

    const excludeCopyIds = typeof exclude === 'string' && exclude.trim()
      ? exclude.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n))
      : [];

    const data = await getBorrowableCopiesService(documentId, {
      page,
      limit,
      q,
      excludeCopyIds,
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi lấy danh sách bản sao AVAILABLE',
      error: err.message,
    });
  }
};
