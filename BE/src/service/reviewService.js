// service/reviewService.js
const Review = require("../model/Review");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

const reviewService = {
  // Lấy tất cả reviews của document
  async getReviewsByDocumentId(documentId) {
    try {
      console.log(`🔍 Fetching reviews for documentId: ${documentId}`);
      
      const reviews = await sequelize.query(`
        SELECT 
          r.reviewId,
          r.readerId,
          r.documentId,
          r.rating,
          r.comment,
          r.created_at,
          r.updated_at,
          COALESCE(readers.fullName, 'Người dùng ẩn danh') as readerFullName,
          readers.accountId as readerAccountId
        FROM Reviews r
        LEFT JOIN Readers readers ON r.readerId = readers.readerId
        WHERE r.documentId = :documentId
        ORDER BY r.created_at DESC
      `, {
        replacements: { documentId },
        type: sequelize.QueryTypes.SELECT,
      });
      
      console.log(`✅ Found ${reviews.length} reviews`);
      
      if (reviews.length > 0) {
        console.log('📝 Sample review data:', {
          reviewId: reviews[0].reviewId,
          readerId: reviews[0].readerId,
          readerFullName: reviews[0].readerFullName,
          readerAccountId: reviews[0].readerAccountId
        });
      }
      
      const result = reviews.map(review => ({
        reviewId: review.reviewId,
        readerId: review.readerId,
        documentId: review.documentId,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        updated_at: review.updated_at,
        Reader: {
          readerId: review.readerId,
          fullName: review.readerFullName,
          accountId: review.readerAccountId,
        },
      }));
      
      console.log(`✅ Formatted ${result.length} reviews successfully`);
      return result;
    } catch (error) {
      console.error("❌ Lỗi getReviewsByDocumentId:", error);
      throw error;
    }
  },

  // ✅ Tạo review mới - BẮT BUỘC CONVERT accountId → readerId
  async createReview(data) {
    try {
      let actualReaderId;
      let inputId = data.readerId || data.accountId;

      if (!inputId) {
        throw new Error("Thiếu thông tin người dùng (readerId hoặc accountId)");
      }

      console.log(`🔍 Input ID nhận được: ${inputId}`);

      // ✅ BƯỚC 1: Thử tìm reader với accountId = inputId
      const readerByAccountId = await sequelize.query(
        'SELECT readerId, fullName, accountId FROM Readers WHERE accountId = :accountId AND deleted = false',
        {
          replacements: { accountId: inputId },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      if (readerByAccountId && readerByAccountId.length > 0) {
        actualReaderId = readerByAccountId[0].readerId;
        console.log(`✅ Tìm thấy reader qua accountId: ${inputId} → readerId: ${actualReaderId} (${readerByAccountId[0].fullName})`);
      } else {
        // ✅ BƯỚC 2: Nếu không tìm thấy, thử tìm với readerId = inputId
        console.log(`⚠️ Không tìm thấy accountId ${inputId}, thử tìm readerId...`);
        
        const readerByReaderId = await sequelize.query(
          'SELECT readerId, fullName, accountId FROM Readers WHERE readerId = :readerId AND deleted = false',
          {
            replacements: { readerId: inputId },
            type: sequelize.QueryTypes.SELECT,
          }
        );

        if (readerByReaderId && readerByReaderId.length > 0) {
          actualReaderId = readerByReaderId[0].readerId;
          console.log(`✅ Tìm thấy reader qua readerId: ${actualReaderId} (${readerByReaderId[0].fullName})`);
        } else {
          throw new Error("Không tìm thấy thông tin độc giả");
        }
      }

      console.log(`📝 Creating review for documentId: ${data.documentId}, readerId: ${actualReaderId}`);
      
      // Kiểm tra document có tồn tại không
      const documents = await sequelize.query(
        'SELECT documentId FROM Documents WHERE documentId = :documentId',
        {
          replacements: { documentId: data.documentId },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      if (!documents || documents.length === 0) {
        throw new Error("Không tìm thấy tài liệu");
      }

      // Kiểm tra user đã review chưa
      const existing = await sequelize.query(
        'SELECT reviewId FROM Reviews WHERE readerId = :readerId AND documentId = :documentId',
        {
          replacements: { 
            readerId: actualReaderId,
            documentId: data.documentId 
          },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      if (existing && existing.length > 0) {
        throw new Error("Bạn đã nhận xét tài liệu này rồi");
      }

      // ✅ Tạo review mới với readerId ĐÚNG
      const review = await Review.create({
        readerId: actualReaderId,
        documentId: data.documentId,
        rating: data.rating,
        comment: data.comment || null,
      });

      console.log(`✅ Review created successfully: ${review.reviewId}`);

      // Lấy thông tin reader
      const readers = await sequelize.query(
        `SELECT 
          readerId, 
          COALESCE(fullName, 'Người dùng ẩn danh') as fullName, 
          accountId 
        FROM Readers 
        WHERE readerId = :readerId`,
        {
          replacements: { readerId: actualReaderId },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      const readerInfo = readers && readers.length > 0 ? readers[0] : null;
      
      console.log('📝 Reader info:', readerInfo);

      return {
        reviewId: review.reviewId,
        readerId: review.readerId,
        documentId: review.documentId,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        updated_at: review.updated_at,
        Reader: readerInfo ? {
          readerId: readerInfo.readerId,
          fullName: readerInfo.fullName,
          accountId: readerInfo.accountId,
        } : {
          readerId: actualReaderId,
          fullName: 'Người dùng ẩn danh',
          accountId: null,
        },
      };
    } catch (error) {
      console.error("❌ Lỗi createReview:", error);
      throw error;
    }
  },

  async updateReview(reviewId, updateData) {
    try {
      const [updatedCount] = await Review.update(updateData, {
        where: { reviewId },
      });

      if (updatedCount === 0) {
        throw new Error("Không thể cập nhật nhận xét");
      }

      console.log(`✅ Cập nhật review ${reviewId} thành công`);
      return updatedCount;
    } catch (error) {
      console.error("❌ Lỗi updateReview:", error);
      throw error;
    }
  },

  async deleteReview(reviewId) {
    try {
      const deletedCount = await Review.destroy({
        where: { reviewId },
      });

      if (deletedCount === 0) {
        throw new Error("Không thể xóa nhận xét");
      }

      console.log(`✅ Xóa review ${reviewId} thành công`);
      return deletedCount;
    } catch (error) {
      console.error("❌ Lỗi deleteReview:", error);
      throw error;
    }
  },

  async getReviewById(reviewId) {
    try {
      return await Review.findOne({
        where: { reviewId },
        raw: true,
      });
    } catch (error) {
      console.error("❌ Lỗi getReviewById:", error);
      throw error;
    }
  },

  async getAverageRating(documentId) {
    try {
      const result = await sequelize.query(`
        SELECT 
          AVG(rating) as averageRating,
          COUNT(reviewId) as totalReviews
        FROM Reviews
        WHERE documentId = :documentId
      `, {
        replacements: { documentId },
        type: sequelize.QueryTypes.SELECT,
      });

      const stats = {
        averageRating: result && result[0] && result[0].averageRating 
          ? parseFloat(result[0].averageRating).toFixed(1) 
          : "0.0",
        totalReviews: result && result[0] && result[0].totalReviews 
          ? parseInt(result[0].totalReviews) 
          : 0,
      };

      console.log(`✅ Stats cho document ${documentId}:`, stats);
      return stats;
    } catch (error) {
      console.error("❌ Lỗi getAverageRating:", error);
      throw error;
    }
  },
};

module.exports = reviewService;