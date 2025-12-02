// src/controller/reviewController.js
const reviewService = require("../service/reviewService");
const { Reader } = require("../model");

// =======================================================
// LẤY DANH SÁCH REVIEW THEO DOCUMENT
// =======================================================
const getReviewsByDocument = async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: "ID tài liệu không hợp lệ",
      });
    }

    const reviews = await reviewService.getReviewsByDocumentId(documentId);
    const stats = await reviewService.getAverageRating(documentId);

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        stats: {
          averageRating: parseFloat(stats.averageRating),
          totalReviews: stats.totalReviews,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách nhận xét",
      error: error.message,
    });
  }
};

// =======================================================
// LẤY THỐNG KÊ REVIEW
// =======================================================
const getReviewStats = async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);

    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: "ID tài liệu không hợp lệ",
      });
    }

    const stats = await reviewService.getAverageRating(documentId);

    return res.status(200).json({
      success: true,
      data: {
        averageRating: parseFloat(stats.averageRating),
        totalReviews: stats.totalReviews,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê nhận xét",
      error: error.message,
    });
  }
};

// =======================================================
// TẠO REVIEW MỚI
// =======================================================
const createReview = async (req, res) => {
  try {
    const accountId = req.user.accountId;  // user login
    const { documentId, rating, comment } = req.body;

    if (!documentId || !rating) {
      return res.status(400).json({
        success: false,
        message: "documentId và rating là bắt buộc",
      });
    }

    const review = await reviewService.createReview({
      accountId,
      documentId: parseInt(documentId),
      rating,
      comment: comment ? comment.trim() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo nhận xét thành công",
      data: review,
    });
  } catch (error) {
    if (error.message === "Bạn đã nhận xét tài liệu này rồi") {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message === "Không tìm thấy tài liệu") {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo nhận xét",
      error: error.message,
    });
  }
};

// =======================================================
// CẬP NHẬT REVIEW — CHECK QUYỀN BẰNG accountId → readerId
// =======================================================
const updateReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId);
    const { rating, comment } = req.body;
    const accountId = req.user.accountId;

    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, message: "ID nhận xét không hợp lệ" });
    }

    const review = await reviewService.getReviewById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhận xét" });
    }

    // Lấy readerId từ accountId
    const myReader = await Reader.findOne({ where: { accountId } });
    if (!myReader) {
      return res.status(403).json({ success: false, message: "Không tìm thấy độc giả" });
    }

    if (review.readerId !== myReader.readerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa nhận xét này",
      });
    }

    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment.trim();

    await reviewService.updateReview(reviewId, updateData);

    return res.status(200).json({ success: true, message: "Cập nhật nhận xét thành công" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật nhận xét",
      error: error.message,
    });
  }
};

// =======================================================
// XÓA REVIEW — CHECK QUYỀN BẰNG accountId → readerId
// =======================================================
const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId);
    const accountId = req.user.accountId;

    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, message: "ID nhận xét không hợp lệ" });
    }

    const review = await reviewService.getReviewById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhận xét" });
    }

    const myReader = await Reader.findOne({ where: { accountId } });
    if (!myReader) {
      return res.status(403).json({ success: false, message: "Không tìm thấy độc giả" });
    }

    if (review.readerId !== myReader.readerId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa nhận xét này",
      });
    }

    await reviewService.deleteReview(reviewId);

    return res.status(200).json({
      success: true,
      message: "Xóa nhận xét thành công",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhận xét",
      error: error.message,
    });
  }
};

module.exports = {
  getReviewsByDocument,
  getReviewStats,
  createReview,
  updateReview,
  deleteReview,
};
