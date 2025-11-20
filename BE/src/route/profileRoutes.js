const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const profileController = require("../controller/profileController");

// ✅ Độc giả xem thông tin cá nhân
router.get("/me", requireAuth, requireRole([3]), profileController.getCurrentReader);

// ✅ Độc giả cập nhật thông tin cá nhân (chỉ Reader fields)
router.put("/me", requireAuth, requireRole([3]), profileController.updateCurrentReader);

// ✅ Độc giả cập nhật thông tin tài khoản (email, phoneNumber, password)
router.put("/account", requireAuth, requireRole([3]), profileController.updateCurrentAccount);

// ✅ Độc giả cập nhật toàn bộ thông tin cùng lúc (Account + Reader)
router.put("/full", requireAuth, requireRole([3]), profileController.updateFullProfile);

module.exports = router;