// src/route/adminLoanSlip.routes.js
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controller/adminLoanSlip.controller');

// Admin/Thủ thư (roleId 1,2): xem tất cả phiếu mượn
router.get('/loans', requireAuth, requireRole([1, 2]), controller.getAllLoanSlips);

// Admin/Thủ thư (roleId 1,2): tạo phiếu mượn -> trực tiếp thành 'BORROWING'
router.post('/loans', requireAuth, requireRole([1, 2]), controller.createLoanSlip);

// Duyệt phiếu đặt trước -> WAITING_FOR_PICKUP
router.post('/reservations/:loanSlipId/approve', requireAuth, requireRole([1, 2]), controller.approveReservation);

// HỦY phiếu đặt trước
router.delete('/reservations/:loanSlipId', requireAuth, requireRole([1, 2]), controller.cancelReservation);

// Lấy bản sao AVAILABLE cho document
router.get('/documents/:documentId/copies', requireAuth, requireRole([1, 2]), controller.getBorrowableCopies);

// TRẢ TỪNG QUYỂN
router.post('/items/return', requireAuth, requireRole([1, 2]), controller.returnSingleItem);

// TRẢ TOÀN BỘ PHIẾU
router.post('/slips/:loanSlipId/return', requireAuth, requireRole([1, 2]), controller.returnBulkItems);

// ---------------------------
// NEW: PICKUP - xác nhận độc giả đến lấy
// POST /api/loans/admin/slips/:loanSlipId/pickup
// Body: { librarianId, pickupDate?, dueDate?, items?, preserveLoanDate? }
router.post('/slips/:loanSlipId/pickup', requireAuth, requireRole([1, 2]), controller.pickupLoanSlip);

// ---------------------------
// NEW: XÓA 1 LOAN DETAIL
// DELETE /api/loans/admin/slips/:loanSlipId/details/:loanDetailId
// Body: { librarianId, reason? }
router.delete('/slips/:loanSlipId/details/:loanDetailId', requireAuth, requireRole([1, 2]), controller.removeLoanDetail);

// ---------------------------
// NEW: HỦY TOÀN BỘ PHIẾU
// DELETE /api/loans/admin/slips/:loanSlipId
// Body: { librarianId, reason? }
router.delete('/slips/:loanSlipId', requireAuth, requireRole([1, 2]), controller.cancelLoanSlip);

module.exports = router;
