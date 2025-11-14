// src/route/payos.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controller/payosController');

// create payment (internal API) - you can restrict/auth this
router.post('/create', express.json(), ctrl.createPayment);

// webhook - PayOS will POST here (must be public & HTTPS)
router.post('/webhook', express.json(), ctrl.webhookHandler);

// optional web pages
router.get('/return', ctrl.returnPage);
router.get('/cancel', ctrl.cancelPage);

module.exports = router;
