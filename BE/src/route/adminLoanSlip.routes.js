// src/route/adminLoanSlip.routes.js
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controller/adminLoanSlip.controller');

// Admin/Thủ thư (roleId 1,2): xem tất cả phiếu mượn
router.get('/loans', requireAuth, requireRole([1, 2]), controller.getAllLoanSlips);

// Admin/Thủ thư (roleId 1,2): tạo phiếu mượn -> status 'PENDING_PAYMENT'
router.post('/loans', requireAuth, requireRole([1, 2]), controller.createLoanSlip);

// Admin/Thủ thư (roleId 1,2): tạo QR thanh toán cho 1 phiếu mượn
router.post(
    '/loans/:loanSlipId/payment/qr',
    requireAuth,
    requireRole([1, 2]),
    controller.createLoanSlipPaymentQR
);

// Xác nhận thanh toán (A): theo loanSlipId (dễ test)
router.patch(
    '/loans/:loanSlipId/payment/confirm',
    requireAuth,
    requireRole([1, 2]),
    controller.confirmLoanSlipPayment
);

// Xác nhận thanh toán (B): theo paymentId (đối soát Payment)
router.patch(
    '/payments/:paymentId/confirm',
    requireAuth,
    requireRole([1, 2]),
    controller.confirmLoanSlipPayment
);

// Duyệt phiếu đặt trước -> WAITING_FOR_PICKUP
router.post(
    '/reservations/:loanSlipId/approve',
    requireAuth,
    requireRole([1, 2]),
    controller.approveReservation
);

// NEW: Lấy danh sách bản sao AVAILABLE để mượn cho 1 tài liệu
// Ví dụ: GET /api/loans/admin/documents/12/copies?page=1&limit=20&q=BC00&exclude=101,103
router.get(
    '/documents/:documentId/copies',
    requireAuth,
    requireRole([1, 2]),
    controller.getBorrowableCopies
);

module.exports = router;
