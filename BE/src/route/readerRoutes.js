/**
 * ROUTER: /api/readers
 * Quản lý độc giả trong hệ thống
 *
 * ⚠️ TẤT CẢ API TRONG FILE NÀY ĐỀU YÊU CẦU:
 * - requireAuth  → người dùng phải đăng nhập
 * - requireRole([1,2]) → chỉ Admin (1) & Thủ thư (2) được sử dụng
 *
 * Các API trả về dữ liệu JSON với cấu trúc:
 * { success: boolean, message?: string, ...data }
 */

const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const readerController = require("../controller/readerController");

/**
 * ============================================================
 * GET /:id
 * LẤY THÔNG TIN CHI TIẾT 1 ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Path param:
 *      :id → readerId (số nguyên)
 * - Controller: readerController.getReaderById
 * - Trả về:
 *      {
 *        readerId, fullName, email, phoneNumber, ...
 *        stats: {
 *          borrowedCount, pendingCount, waitingForPickupCount, overdueCount
 *        }
 *        memberCard: { card info ... }
 *      }
 * ============================================================
 */
router.get(
    "/:id",
    requireAuth,
    requireRole([1, 2]),
    readerController.getReaderById
);

/**
 * ============================================================
 * GET /
 * LẤY DANH SÁCH TẤT CẢ ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Không cần body
 * - Controller: readerController.getAllReaders
 * - Trả về danh sách JSON:
 *      [
 *        {
 *          readerId, fullName, email, ...
 *          stats: { ... },
 *          memberCard: { ... }
 *        },
 *        ...
 *      ]
 * ============================================================
 */
router.get(
    "/",
    requireAuth,
    requireRole([1, 2]),
    readerController.getAllReaders
);

// ============================================================
// ⚙️ API dành cho độc giả tự xem thông tin cá nhân (nếu dùng)
// Chưa bật, nhưng muốn kích hoạt chỉ cần mở comment:
// router.get("/me", requireAuth, requireRole([3]), readerController.getCurrentReader);
// ============================================================

/**
 * ============================================================
 * POST /
 * THÊM MỚI ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Body:
 *      {
 *        fullName: string (bắt buộc)
 *        email: string (bắt buộc, không trùng)
 *        password: string (bắt buộc)
 *        gender?, dateOfBirth?, phoneNumber?, address?, cccd?
 *      }
 *
 * - Tự động tạo:
 *      + Account mới (roleId = 3 — độc giả)
 *      + Reader mới liên kết với account
 * ============================================================
 */
router.post(
    "/",
    requireAuth,
    requireRole([1, 2]),
    readerController.createReader
);

/**
 * ============================================================
 * PUT /:id
 * CẬP NHẬT THÔNG TIN ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Body (tuỳ chọn):
 *      fullName, gender, dateOfBirth, address, cccd,
 *      email (check trùng), phoneNumber,
 *      password (nếu có → bcrypt hash)
 *
 * - Cập nhật cả bảng Account & Reader
 * ============================================================
 */
router.put(
    "/:id",
    requireAuth,
    requireRole([1, 2]),
    readerController.updateReader
);

/**
 * ============================================================
 * PUT /:id/reset-password
 * ĐẶT LẠI MẬT KHẨU ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Body:
 *      { newPassword: string }
 *
 * - Đặt lại passwordHash trên bảng Account
 * ============================================================
 */
router.put(
    "/:id/reset-password",
    requireAuth,
    requireRole([1, 2]),
    readerController.resetReaderPassword
);

/**
 * ============================================================
 * DELETE /:id
 * XÓA MỀM ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Soft delete:
 *      Reader.deleted = true
 *      Account.deleted = true
 * ============================================================
 */
router.delete(
    "/:id",
    requireAuth,
    requireRole([1, 2]),
    readerController.deleteReader
);

/**
 * ============================================================
 * PUT /:id/restore
 * KHÔI PHỤC ĐỘC GIẢ (Admin + Thủ thư)
 * ------------------------------------------------------------
 * - Gỡ soft delete:
 *      Reader.deleted = false
 *      Account.deleted = false
 * ============================================================
 */
router.put(
    "/:id/restore",
    requireAuth,
    requireRole([1, 2]),
    readerController.restoreReader
);
// Khoá tài khoản độc giả (Admin + Thủ thư)
router.put("/:id/lock", requireAuth, requireRole([1, 2]), readerController.lockReaderAccount);

// Mở khoá tài khoản độc giả (Admin + Thủ thư)
router.put("/:id/unlock", requireAuth, requireRole([1, 2]), readerController.unlockReaderAccount);

module.exports = router;
