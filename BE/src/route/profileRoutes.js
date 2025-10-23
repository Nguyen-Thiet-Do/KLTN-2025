const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const profileController = require("../controller/profileController");

// ✅ Độc giả xem thông tin cá nhân
router.get("/me", requireAuth, requireRole([3]), profileController.getCurrentReader);

// ✅ Độc giả cập nhật thông tin cá nhân
router.put("/me", requireAuth, requireRole([3]), profileController.updateCurrentReader);

module.exports = router;
