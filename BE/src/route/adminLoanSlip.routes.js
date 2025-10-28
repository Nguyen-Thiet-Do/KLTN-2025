// src/route/adminLoanSlip.routes.js
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controller/adminLoanSlip.controller');


// Admin/Thủ thư (roleId 1,2): xem tất cả phiếu mượn
router.get('/loans', requireAuth, requireRole([1, 2]), controller.getAllLoanSlips);



module.exports = router;
