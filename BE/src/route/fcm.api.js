// src/route/fcm.api.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const fcmController = require("../controller/fcm.controller");

// register token (call after login or when token changes)
router.post("/register", requireAuth, fcmController.registerFcmToken);

// unregister token (call on logout)
router.post("/unregister", requireAuth, fcmController.unregisterFcmToken);

// test send (only if caller is latest owner of token)
router.post("/test", requireAuth, fcmController.sendTestNotification);

module.exports = router;
