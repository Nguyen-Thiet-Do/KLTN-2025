// route/reviewRoutes.js
const express = require("express");
const router = express.Router();
const reviewController = require("../controller/reviewController");
const { requireAuth, requireRole } = require("../middleware/auth");

// ==================== PUBLIC ROUTES ====================
// Lấy tất cả reviews của document (kèm stats)
router.get("/:documentId", reviewController.getReviewsByDocument);

// Chỉ lấy stats (rating trung bình, tổng số review)
router.get("/:documentId/stats", reviewController.getReviewStats);

// ==================== PROTECTED ROUTES ====================
// Tạo review mới
router.post(
  "/",
  requireAuth,
  requireRole([3]),
  reviewController.createReview
);

// Cập nhật review của chính mình
router.patch(
  "/:reviewId",
  requireAuth,
  requireRole([3]),
  reviewController.updateReview
);

// Xóa review của chính mình
router.delete(
  "/:reviewId",
  requireAuth,
  requireRole([3]),
  reviewController.deleteReview
);

module.exports = router;