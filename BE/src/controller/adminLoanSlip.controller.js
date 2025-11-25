// src/controller/adminLoanSlip.controller.js
const {
  getAllLoanSlipsService,
  createLoanSlipService,
  approveReservationService,
  getBorrowableCopiesService,
  returnSingleItemService,
  returnBulkItemsService,
  pickupLoanSlipService,
  cancelLoanSlipService,
  removeLoanDetailService,
  cancelReservationService
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
      message: err.message,
      error: "Lỗi tạo phiếu mượn",
    });
  }
};

exports.approveReservation = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const {
      librarianId,
      dueDate,
      pricingMode,
      assignments,
      conditions
    } = req.body || {};

    const result = await approveReservationService({
      loanSlipId: Number(loanSlipId),
      librarianId: Number(librarianId),
      dueDate,
      pricingMode,
      assignments,
      conditions
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

exports.returnSingleItem = async (req, res) => {
  try {
    const librarianId = req.body.librarianId;
    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
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

exports.returnBulkItems = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = req.body.librarianId;
    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
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

/**
 * PICKUP - Xác nhận độc giả đã đến nhận
 * POST /api/loans/admin/slips/:loanSlipId/pickup
 * Body: {
 *   librarianId: number,   // required
 *   pickupDate?: 'YYYY-MM-DD',
 *   dueDate?: 'YYYY-MM-DD',
 *   items?: [loanDetailId, ...],
 *   preserveLoanDate?: boolean
 * }
 */
exports.pickupLoanSlip = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const payload = {
      loanSlipId: Number(loanSlipId),
      librarianId: Number(req.body.librarianId),
      pickupDate: req.body.pickupDate,
      dueDate: req.body.dueDate,
      items: req.body.items,
      preserveLoanDate: Boolean(req.body.preserveLoanDate)
    };

    if (!payload.librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await pickupLoanSlipService(payload);
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi xác nhận pickup',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * XÓA 1 LOAN DETAIL (bỏ 1 quyển khỏi phiếu)
 * DELETE /api/loans/admin/slips/:loanSlipId/details/:loanDetailId
 * Body: { librarianId: number, reason?: string }
 */
exports.removeLoanDetail = async (req, res) => {
  try {
    const { loanSlipId, loanDetailId } = req.params;
    const librarianId = Number(req.body.librarianId);
    const reason = req.body.reason || null;

    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await removeLoanDetailService({
      slipId: Number(loanSlipId),
      loanDetailId: Number(loanDetailId),
      reason,
      librarianId
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi xóa tài liệu trong phiếu',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * HỦY TOÀN BỘ PHIẾU
 * DELETE /api/loans/admin/slips/:loanSlipId
 * Body: { librarianId: number, reason?: string }
 */
exports.cancelLoanSlip = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = Number(req.body.librarianId);
    const reason = req.body.reason || null;

    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await cancelLoanSlipService({
      slipId: Number(loanSlipId),
      reason,
      librarianId
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi hủy phiếu mượn',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * HỦY PHIẾU ĐẶT TRƯỚC (PENDING)
 * DELETE /api/loans/admin/reservations/:loanSlipId
 * Body: { librarianId: number, reason?: string }
 */
exports.cancelReservation = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = Number(req.body.librarianId);
    const reason = req.body.reason || null;

    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await cancelReservationService({
      loanSlipId: Number(loanSlipId),
      reason,
      librarianId
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi hủy phiếu đặt trước',
      error: err.message,
      details: err.details
    });
  }
};
module.exports = exports;
