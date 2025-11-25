const express = require('express');
const router = express.Router();
const paymentController = require('../controller/paymentController');
const { requireAuth } = require('../middleware/auth');

// ✅ Check payment status (cần authenticate)
router.get(
  '/payments/:paymentId/status', 
  requireAuth, 
  paymentController.getPaymentStatus
);

module.exports = router;