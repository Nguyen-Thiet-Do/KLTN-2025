// src/route/readerLoanSlip.routes.js
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controller/readerLoanSlip.controller');
const reserveCtrl = require('../controller/readerReserveLoan.controller');

// Độc giả (roleId 3): xem lịch sử mượn trả của chính mình
router.get('/loans/my', requireAuth, requireRole([3]), controller.getMyLoanHistory);

// Độc giả (roleId 3): đặt mượn trước tài liệu
router.post('/loans/reserve', requireAuth, requireRole([3]), reserveCtrl.reserveLoanForReader);

module.exports = router;
