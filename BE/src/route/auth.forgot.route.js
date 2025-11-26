// src/route/auth.forgot.route.js
const express = require("express");
const router = express.Router();

const controller = require("../controller/auth.forgot.controller"); 

router.post("/send-otp", controller.sendOTP);
router.post("/verify-otp", controller.verifyOTP);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
