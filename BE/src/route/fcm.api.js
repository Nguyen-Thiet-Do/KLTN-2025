// src/route/fcm.api.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require('../middleware/auth');
const fcmController = require("../controller/fcm.controller");

router.post("/fcm/register", requireAuth, fcmController.registerFcmToken);
router.post("/fcm/test", requireAuth, fcmController.sendTestNotification); // api test gửi notification

module.exports = router;
