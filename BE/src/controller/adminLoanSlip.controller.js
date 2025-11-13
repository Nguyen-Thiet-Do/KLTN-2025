// src/controller/adminLoanSlip.controller.js
const {
  getAllLoanSlipsService,
  createLoanSlipService,
  // createLoanSlipPaymentQRService, // removed
  // confirmLoanSlipPaymentService,  // removed
  approveReservationService,
  getBorrowableCopiesService,
  returnSingleItemService,
  returnBulkItemsService,
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

// note: payment-related controllers removed because service no longer exports them

exports.approveReservation = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const {
      librarianId,
      dueDate,
      pricingMode,    // 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL'
      assignments,    // [{ loanDetailId, documentCopyId }]
      // deposits and createPayment removed
    } = req.body || {};

    const result = await approveReservationService({
      loanSlipId: Number(loanSlipId),
      librarianId: Number(librarianId),
      dueDate,
      pricingMode,
      assignments,
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

/**
 * TRẢ TỪNG QUYỂN
 * POST /api/loans/admin/items/return
 * Body: {
 *   loanDetailId: number,
 *   returnDate: 'YYYY-MM-DD',
 *   conditionReturn: number (0-100),
 *   isLost?: boolean,
 *   note?: string,
 *   librarianId: number  ← FE truyền lên
 * }
 */
exports.returnSingleItem = async (req, res) => {
  try {
    // Lấy librarianId từ body (FE truyền lên)
    const librarianId = req.body.librarianId;

    // Validate
    if (!librarianId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu librarianId trong request body'
      });
    }

    const result = await returnSingleItemService(req.body, librarianId);
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi trả tài liệu',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * TRẢ TOÀN BỘ PHIẾU
 * POST /api/loans/admin/slips/:loanSlipId/return
 * Body: {
 *   librarianId: number,  ← FE truyền lên
 *   returnDate: 'YYYY-MM-DD',
 *   items: [ { loanDetailId, conditionReturn, isLost?, note? } ]
 * }
 */
exports.returnBulkItems = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = req.body.librarianId;

    // Validate
    if (!librarianId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu librarianId trong request body'
      });
    }

    const result = await returnBulkItemsService(
      { loanSlipId: Number(loanSlipId), ...req.body },
      librarianId
    );

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi trả phiếu mượn',
      error: err.message,
      details: err.details
    });
  }
};
