// src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const documentController = require('../controller/documentController');


// ======================= ROUTES DÀNH CHO ĐỘC GIẢ (roleId = 3) =======================

router.get('/reader/latest', documentController.getLatestDocumentsReader);
router.get('/reader/popular', documentController.getPopularDocumentsReader);
/**
 * @route   GET /api/books/reader
 * @desc    Lấy tài liệu theo loại (Book, Newspaper, Magazine) kèm cọc min/max, số bản sao sẵn sàng
 * @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 10)
 * @query   search - Tìm theo tiêu đề (LIKE)
 * @query   type   - 'book' | 'magazine' | 'newspaper' | 'all' (mặc định: 'all')
 * @access  Reader (roleId=3)
 * @example GET /api/books/reader?page=1&limit=10&type=magazine&search=data
 */
router.get('/reader', documentController.getAllBooksReader);

/**
 * @route   GET /api/books/reader/by-genre
 * @desc    Lọc tài liệu theo thể loại (genre) — hỗ trợ match 'any' | 'all'
 * @query   page      - Số trang (mặc định: 1)
 * @query   limit     - Số mục mỗi trang (mặc định: 10)
 * @query   search    - Tìm theo tiêu đề (LIKE)
 * @query   type      - 'book' | 'magazine' | 'newspaper' | 'all' (mặc định: 'all')
 * @query   genreIds  - Danh sách genreId, cách nhau bởi dấu phẩy. VD: "2,5,9"
 * @query   match     - 'any' (ít nhất 1) | 'all' (đầy đủ) — mặc định 'any'
 * @access  Reader (roleId=3)
 * @example GET /api/books/reader/by-genre?genreIds=3,7&match=any&page=1&limit=12
 * @example GET /api/books/reader/by-genre?genreIds=2,5,9&match=all&type=book
 *
 * Lưu ý: đặt route này TRƯỚC /reader/:id để tránh bị bắt nhầm vào param :id.
 */
router.get('/reader/by-genre', documentController.getDocumentsByGenreReader);

router.get('/reader/search',
    documentController.searchDocumentsUniversalReader
);

// Gợi ý tương tự theo id tài liệu đang xem
/**
 * @route   GET /api/books/reader/:id/similar
 * @query   limit      - số lượng gợi ý (mặc định 10)
 * @query   wGenre     - trọng số genre (mặc định 2)
 * @query   wAuthor    - trọng số author (mặc định 3)
 * @query   wPublisher - trọng số publisher (mặc định 1)
 * @query   wCategory  - trọng số category (mặc định 1)
 * @access  Reader (roleId=3)
 */
router.get('/reader/:id/similar',

    documentController.getSimilarDocumentsReader
);

/**
 * @route   GET /api/books/reader/:id
 * @desc    Chi tiết 1 tài liệu (tính cọc min/max, số bản sao)
 * @param   id - ID của tài liệu
 * @access  Reader (roleId=3)
 */
router.get('/reader/:id', documentController.getDocumentDetailReader);

/**
 * @route   GET /api/books/ebook/:id
 * @desc    Lấy URL ebook của tài liệu
 * @param   id - ID của tài liệu
 * @access  Reader (roleId=3)
 */
router.get('/ebook/:id', requireAuth, requireRole([3]), documentController.getEbookUrlReader);

/**
 * @route   GET /api/books/genres
 * @desc    Lấy danh sách thể loại (genre)
 * @access  Yêu cầu đăng nhập (mọi role)
 */
router.get('/genres', documentController.getAllGenres);





module.exports = router;
