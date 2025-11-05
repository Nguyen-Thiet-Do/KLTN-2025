const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const librarianController = require("../controller/librarianController");

// ✅ Lấy danh sách tất cả thủ thư (chỉ admin được phép)
router.get("/", requireAuth, requireRole([1]), librarianController.getAllLibrarians);

// ✅ Lấy thông tin thủ thư hiện tại (dành cho thủ thư)
router.get("/me", requireAuth, requireRole([2]), librarianController.getCurrentLibrarian);

// ✅ Thêm thủ thư mới (Admin only)
router.post("/", requireAuth, requireRole([1]), librarianController.createLibrarian);

// ✅ Cập nhật thủ thư (Admin)
router.put("/:id", requireAuth, requireRole([1]), librarianController.updateLibrarian);
// ✅ Đặt lại mật khẩu thủ thư (Admin + Thủ thư)
router.put("/:id/reset-password", requireAuth, requireRole([1, 2]), librarianController.resetLibrarianPassword);
// ✅ Xóa thủ thư theo ID (Admin)
router.delete("/:id", requireAuth, requireRole([1]), librarianController.deleteLibrarian);

module.exports = router;
