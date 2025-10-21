// src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const documentController = require('../controller/documentController');


// route dành cho độc giả

/**
 * @route   GET /api/books/reader
 * @desc    Lấy tài liệu theo loại (Book, Newspaper, Magazine) kèm cọc min/max, số bản sao sẵn sàng
 * @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 10)
 * @query   search - Tìm theo tiêu đề (like)
 * @query   type   - 'book' | 'magazine' | 'newspaper' | 'all' (mặc định: 'all')
 * @access  Reader (roleId=3)
 * @example GET /api/books/reader?page=1&limit=10&type=magazine&search=data
 */
router.get('/reader', requireAuth, requireRole([3]), documentController.getAllBooksReader);

/**
 * Chi tiết 1 tài liệu (tính cọc min/max, số bản sao)
 * @route GET /api/books/reader/:id
 */
router.get('/reader/:id', requireAuth, requireRole([3]), documentController.getDocumentDetailReader);

/**
 * @route   GET /api/documents/ebook/:id
 * @desc    Lấy URL ebook của tài liệu
 * @param   id - ID của tài liệu
 */
router.get('/ebook/:id', requireAuth, requireRole([3]), documentController.getEbookUrlReader); 
// Các route khác dành cho thủ thư hoặc admin 

module.exports = router;