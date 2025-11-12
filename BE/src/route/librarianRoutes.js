const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const librarianController = require("../controller/librarianController");

// ✅ Lấy danh sách tất cả thủ thư (Admin)
router.get("/", requireAuth, requireRole([1]), librarianController.getAllLibrarians);

// ✅ Lấy thông tin thủ thư hiện tại
router.get("/me", requireAuth, requireRole([2]), librarianController.getCurrentLibrarian);

// ✅ Thêm thủ thư mới (Admin)
router.post("/", requireAuth, requireRole([1]), librarianController.createLibrarian);

// ✅ Cập nhật thủ thư (Admin)
router.put("/:id", requireAuth, requireRole([1]), librarianController.updateLibrarian);

// ✅ Đặt lại mật khẩu (Admin + Thủ thư)
router.put("/:id/reset-password", requireAuth, requireRole([1, 2]), librarianController.resetLibrarianPassword);

// ✅ Xóa mềm thủ thư (Admin)
router.delete("/:id", requireAuth, requireRole([1]), librarianController.deleteLibrarian);

// ✅ Khôi phục thủ thư (Admin)
router.put("/:id/restore", requireAuth, requireRole([1]), librarianController.restoreLibrarian);

module.exports = router;
