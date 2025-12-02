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
  cancelReservationService,
  calculateDamageOnly,
  computeReturnFines,
  handleLostBookAndCharge,
  previewBulkReturnFinesService,
  initBulkReturnPaymentService,
  confirmBulkReturnAfterPaymentService,
  createViolationPaymentForSlipService,
  createOnsiteLoanSlipService,
  finishOnsiteLoanSlipService
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

/**
 * POST /api/loans/admin/violations/damage/calc
 * Body: { conditionBorrow, conditionReturn, coverPrice }
 * Trả về: { damageFine }
 */
exports.calculateDamageOnly = async (req, res) => {
  try {
    const payload = req.body || {};
    const out = await calculateDamageOnly(payload);
    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tính tiền hư hỏng',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * POST /api/loans/admin/violations/return/calc
 * Body: {
 *   loanDetailId?, dueDate?, returnDate, conditionBorrow?, conditionReturn?, coverPrice?, isLost?
 * }
 * Trả về: { overdueFine, damageFine, lostFine, totalFine }
 */
exports.computeReturnFines = async (req, res) => {
  try {
    const payload = req.body || {};
    // nếu frontend không gửi returnDate thì lỗi
    if (!payload.returnDate && !payload.loanDetailId) {
      // loanDetailId có thể mang thông tin dueDate; nếu không có cả hai => thiếu dữ kiện
      return res.status(400).json({
        success: false,
        message: 'Thiếu returnDate hoặc loanDetailId để tính tiền trả trễ'
      });
    }

    const out = await computeReturnFines(payload);
    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tính tiền trả trễ / hư hỏng',
      error: err.message,
      details: err.details
    });
  }
};

/**
 * POST /api/loans/admin/violations/lost
 * Body: { loanDetailId, returnDate?, librarianId? }
 *
 * Ghi chú:
 * - Service xử lý chính nằm trong adminLoanSlip.service.js (vị trí bạn đã upload: /mnt/data/adminLoanSlip.service.js)
 * - Controller này cố gắng lấy librarianId từ: req.user.librarianId || req.user.accountId || req.body.librarianId
 */
exports.handleLostBookAndCharge = async (req, res) => {
  try {
    const payload = req.body || {};
    const loanDetailId = payload.loanDetailId || null;
    if (!loanDetailId) {
      return res.status(400).json({ success: false, message: 'Thiếu loanDetailId trong request body' });
    }

    // Lấy librarianId một cách robust từ nhiều nguồn
    const fromReqUser = req.user ?? {};
    const librarianIdCandidate =
      // explicit librarianId on req.user
      (fromReqUser.librarianId !== undefined && fromReqUser.librarianId !== null) ? fromReqUser.librarianId :
        // maybe stored as accountId for some auth middlewares
        (fromReqUser.accountId !== undefined && fromReqUser.accountId !== null) ? fromReqUser.accountId :
          // fallback to profile inside req.user
          (fromReqUser.profile && (fromReqUser.profile.librarianId ?? null)) ?
            fromReqUser.profile.librarianId :
            // fallback: body
            (payload.librarianId !== undefined && payload.librarianId !== null) ? payload.librarianId :
              null;

    const librarianId = (librarianIdCandidate !== null && librarianIdCandidate !== undefined)
      ? Number(librarianIdCandidate)
      : null;

    if (!librarianId) {
      // không tìm thấy -> trả lỗi rõ ràng để client biết
      return res.status(400).json({
        success: false,
        message: 'Thiếu librarianId (truyền qua body hoặc qua auth token). Vui lòng đăng nhập bằng tài khoản thủ thư.'
      });
    }

    // Debug log để kiểm tra server có nhận đúng giá trị không
    console.log('[controller.handleLostBookAndCharge] call with', {
      loanDetailId: Number(loanDetailId),
      librarianId,
      returnDate: payload.returnDate ?? null,
      calledBy: req.user ? (req.user.email || req.user.accountId || 'unknown') : 'anonymous'
    });

    // gọi service chính (đảm bảo service export tên handleLostBookAndCharge tồn tại)
    const out = await handleLostBookAndCharge({
      loanDetailId: Number(loanDetailId),
      librarianId: Number(librarianId),
      returnDate: payload.returnDate
    });

    return res.json({ success: true, data: out });
  } catch (err) {
    const code = err.status || 500;
    // in log chi tiết lỗi để dễ debug (nhưng không leak quá nhiều thông tin ra client)
    console.error('[controller.handleLostBookAndCharge] error:', err);
    return res.status(code).json({
      success: false,
      message: 'Lỗi xử lý mất sách',
      error: err.message,
      details: err.details ?? null
    });
  }
};
/**
 * PREVIEW: tính phí trả toàn bộ phiếu (trễ hạn + hư hỏng + mất)
 * POST /api/loans/admin/slips/:loanSlipId/return/preview
 * Body: {
 *   returnDate: 'YYYY-MM-DD',
 *   items: [
 *     { loanDetailId, conditionReturn, isLost? }
 *   ]
 * }
 */
exports.previewBulkReturnFines = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const { returnDate, items } = req.body || {};

    if (!loanSlipId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu loanSlipId trên URL'
      });
    }

    if (!returnDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu returnDate trong body'
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách items trống hoặc không hợp lệ'
      });
    }

    const result = await previewBulkReturnFinesService({
      loanSlipId: Number(loanSlipId),
      returnDate,
      items
    });

    // service trả về { loanSlipId, returnDate, totals, items, paymentPreview }
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || err.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi preview tiền phạt khi trả phiếu',
      error: err.message,
      details: err.details
    });
  }
};

// BƯỚC 1: init trả phiếu + tạo QR nếu cần
exports.initBulkReturnPayment = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = req.body.librarianId;
    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await initBulkReturnPaymentService(
      { loanSlipId: Number(loanSlipId), ...req.body },
      librarianId
    );

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || err.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi khởi tạo trả phiếu (tính phạt / tạo QR)',
      error: err.message,
      details: err.details
    });
  }
};

// BƯỚC 2: xác nhận sau khi thanh toán thành công
exports.confirmBulkReturnAfterPayment = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = req.body.librarianId;
    if (!librarianId) {
      return res.status(400).json({ success: false, message: 'Thiếu librarianId trong request body' });
    }

    const result = await confirmBulkReturnAfterPaymentService(
      { loanSlipId: Number(loanSlipId), ...req.body },
      librarianId
    );

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || err.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi xác nhận trả phiếu sau khi thanh toán',
      error: err.message,
      details: err.details
    });
  }
};
/**
 * Tạo PayOS payment cho các vi phạm chưa thanh toán của 1 phiếu
 * POST /api/loans/admin/violations/slips/:loanSlipId/pay
 * Body: { librarianId: number }
 */
exports.createViolationPaymentForSlip = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const librarianId = Number(req.body.librarianId);

    if (!loanSlipId) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu loanSlipId trên URL' });
    }
    if (!librarianId) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu librarianId trong body' });
    }

    const result = await createViolationPaymentForSlipService(
      Number(loanSlipId),
      librarianId
    );

    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || err.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tạo thanh toán vi phạm cho phiếu',
      error: err.message,
      details: err.details,
    });
  }
};
// POST /api/loans/admin/loans/onsite
exports.createOnsiteLoanSlip = async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await createOnsiteLoanSlipService(payload);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi tạo phiếu đọc tại chỗ',
      error: err.message,
      details: err.details || null
    });
  }
};

// POST /api/loans/admin/loans/onsite/:loanSlipId/finish
exports.finishOnsiteLoanSlip = async (req, res) => {
  try {
    const { loanSlipId } = req.params;
    const payload = {
      loanSlipId: Number(loanSlipId),
      returnDate: req.body.returnDate,
      items: req.body.items,
      librarianId: Number(req.body.librarianId)
    };
    const result = await finishOnsiteLoanSlipService(payload);
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({
      success: false,
      message: 'Lỗi kết thúc phiếu đọc tại chỗ',
      error: err.message,
      details: err.details || null
    });
  }
};

module.exports = exports;
