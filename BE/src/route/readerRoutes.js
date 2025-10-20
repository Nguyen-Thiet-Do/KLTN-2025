const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const readerController = require("../controller/readerController");

// ✅ Lấy danh sách tất cả độc giả (Admin + Thủ thư)
router.get("/", requireAuth, requireRole([1, 2]), readerController.getAllReaders);

// // ✅ Lấy thông tin độc giả hiện tại (chính người đọc giả đó)
// router.get("/me", requireAuth, requireRole([3]), readerController.getCurrentReader);

// ✅ Thêm độc giả mới (Admin)
router.post("/", requireAuth, requireRole([1]), readerController.createReader);

// ✅ Cập nhật độc giả (Admin hoặc Thủ thư)
router.put("/:id", requireAuth, requireRole([1, 2]), readerController.updateReader);

// ✅ Xóa độc giả theo ID (Admin)
router.delete("/:id", requireAuth, requireRole([1]), readerController.deleteReader);

module.exports = router;
