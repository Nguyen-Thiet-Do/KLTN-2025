// src/route/adminLoanSlip.routes.js
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controller/adminLoanSlip.controller');

// Admin/Thủ thư (roleId 1,2): xem tất cả phiếu mượn
router.get('/loans', requireAuth, requireRole([1, 2]), controller.getAllLoanSlips);

// Admin/Thủ thư (roleId 1,2): tạo phiếu mượn -> trực tiếp thành 'BORROWING'
router.post('/loans', requireAuth, requireRole([1, 2]), controller.createLoanSlip);

// Payment/QR endpoints removed because payment-for-deposit flow was removed

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

// TRẢ TỪNG QUYỂN
router.post(
    '/items/return',
    requireAuth,
    requireRole([1, 2]),
    controller.returnSingleItem
);

// TRẢ TOÀN BỘ PHIẾU
router.post(
    '/slips/:loanSlipId/return',
    requireAuth,
    requireRole([1, 2]),
    controller.returnBulkItems
);

module.exports = router;
