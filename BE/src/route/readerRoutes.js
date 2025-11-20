const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const readerController = require("../controller/readerController");

// ✅ Lấy độc giả theo ID (Admin + Thủ thư)

router.get("/:id", requireAuth, requireRole([1, 2]), readerController.getReaderById);
// ✅ Lấy danh sách tất cả độc giả (Admin + Thủ thư)
router.get("/", requireAuth, requireRole([1, 2]), readerController.getAllReaders);

// // ✅ Lấy thông tin độc giả hiện tại (chính người đọc giả đó)
// router.get("/me", requireAuth, requireRole([3]), readerController.getCurrentReader);

// ✅ Thêm độc giả mới (Admin)
router.post("/", requireAuth, requireRole([1,2]), readerController.createReader);

// ✅ Cập nhật độc giả (Admin hoặc Thủ thư)
router.put("/:id", requireAuth, requireRole([1, 2]), readerController.updateReader);
// ✅ Đặt lại mật khẩu độc giả (Admin + Thủ thư)
router.put("/:id/reset-password", requireAuth, requireRole([1, 2]), readerController.resetReaderPassword);
// ✅ Xóa độc giả theo ID (Admin)
router.delete("/:id", requireAuth, requireRole([1,2]), readerController.deleteReader);
// ✅ ♻️ Khôi phục độc giả (Admin + Thủ thư)
router.put("/:id/restore", requireAuth, requireRole([1, 2]), readerController.restoreReader);

module.exports = router;
