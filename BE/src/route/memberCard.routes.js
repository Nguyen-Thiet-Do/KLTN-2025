// routes/memberCard.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controller/memberCardController');
const { requireAuth } = require('../middleware/auth');

router.post('/topup', requireAuth, ctrl.topupToDefault);

module.exports = router;
