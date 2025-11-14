const express = require('express');
const router = express.Router();
const ctrl = require('../controller/payosController');

// create payment (internal API)
router.post('/create', ctrl.createPayment);

// webhook - PayOS will POST here (must be public & HTTPS)
router.post('/webhook', ctrl.webhookHandler);

// optional web pages
router.get('/return', ctrl.returnPage);
router.get('/cancel', ctrl.cancelPage);

module.exports = router;
