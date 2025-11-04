// ================================
// File: /routes/documentAdminRoutes.js (Optimized)
// ================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

const documentAdminController = require('../controller/documentAdminController');
const { upload } = require('../middleware/upload');

// ======================= ROUTES DÀNH CHO QUẢN TRỊ VIÊN VÀ THỦ THƯ (roleId = 1, 2) =======================
// NEW: Lấy 1 bản sao + tiền cọc
/**
 * @route   GET /api/documents/admin/copies/:copyId
 * @desc    Lấy thông tin 1 bản sao kèm tiền cọc; có thể lấy kèm thông tin cơ bản của tài liệu
 * @param   copyId (path)  - ID bản sao
 * @query   withDoc=0|1     (mặc định 1)  — trả kèm thông tin document
 * @query   withAuthors=0|1 (mặc định 1)  — kèm danh sách tác giả (khi withDoc=1)
 * @query   withSubtype=0|1 (mặc định 1)  — kèm thông tin subtype: book/magazine/newspaper (khi withDoc=1)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.get(
  '/copies/:copyId',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getCopyWithDepositSingleCtrl
);


/**
 * @route   GET /api/documents/admin/books/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Sách (Book) - Dành cho Admin và Librarian
 * @query   page        - Số trang (mặc định: 1)
 * @query   limit       - Số mục mỗi trang (mặc định: 20, tối đa: 100)
 * @query   search      - Tìm theo tiêu đề
 * @query   searchMode  - auto | fulltext | like (mặc định: auto)
 * @query   withAuthors - 0|1 (mặc định: 1)
 * @query   withSubtype - 0|1 (mặc định: 1)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/books/basic?page=1&limit=20&search=data&searchMode=fulltext&withAuthors=0
 */
router.get(
  '/books/basic',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getBooks
);

/**
 * @route   GET /api/documents/admin/magazines/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Tạp chí (Magazine) - Dành cho Admin và Librarian
 * @query   page/limit/search/searchMode/withAuthors/withSubtype
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.get(
  '/magazines/basic',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getMagazines
);

/**
 * @route   GET /api/documents/admin/newspapers/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Báo (Newspaper) - Dành cho Admin và Librarian
 * @query   page/limit/search/searchMode/withAuthors/withSubtype
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.get(
  '/newspapers/basic',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getNewspapers
);

/**
 * @route   GET /api/documents/admin/basic
 * @desc    Lấy danh sách tài liệu cơ bản theo loại (Book, Magazine, Newspaper, All) - Dành cho Admin và Librarian
 * @query   documentType - 'book' | 'magazine' | 'newspaper' | 'all' (mặc định: 'all')
 * @query   page/limit/search/searchMode/withAuthors/withSubtype
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.get(
  '/basic',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getBasicList
);

/**
 * @route   GET /api/documents/admin/:id/copies
 * @desc    Lấy danh sách các bản sao của tài liệu theo ID tài liệu - Dành cho Admin và Librarian
 * @param   id - ID của tài liệu
 * @query   status - optional (lọc theo trạng thái copy)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.get(
  '/:id/copies',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.getCopiesWithDeposit
);

/* ======================= ROUTES TẠO MỚI (BOOK/MAGAZINE/NEWSPAPER) ======================= */

/**
 * @route   POST /api/documents/admin/books
 * @desc    Tạo mới tài liệu loại Sách + subtype Book + copies (1 lần)
 * @body    (multipart: files: cover[bắt buộc], ebook[tuỳ] + fields JSON) hoặc (application/json: coverUrl bắt buộc)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example POST /api/documents/admin/books
 */
router.post(
  '/books',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.createBookCtrl
);

/**
 * @route   POST /api/documents/admin/magazines
 * @desc    Tạo mới tài liệu loại Tạp chí + subtype Magazine + copies (1 lần)
 * @body    (multipart hoặc json — giống route /books)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.post(
  '/magazines',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.createMagazineCtrl
);

/**
 * @route   POST /api/documents/admin/newspapers
 * @desc    Tạo mới tài liệu loại Báo + subtype Newspaper + copies (1 lần)
 * @body    (multipart hoặc json — giống route /books)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.post(
  '/newspapers',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.createNewspaperCtrl
);

/**
 * @route   POST /api/documents/admin/:id/copies
 * @desc    Thêm bản sao cho tài liệu đã có
 * @body    JSON Array: [{ barCode?, status?, conditionNote?, entryDate? }, ...]
 * @access  Admin (roleId=1), Librarian (roleId=2)
 */
router.post(
  '/:id/copies',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.addCopiesCtrl
);

/**
 * @route   PUT /api/documents/admin/books/:id
 * @desc    Sửa tài liệu loại Sách (Book). Hỗ trợ multipart (cover/ebook) hoặc JSON.
 * @body    Trường nào gửi mới thì cập nhật; không gửi thì giữ nguyên.
 * @access  Admin (1), Librarian (2)
 */
router.put(
  '/books/:id',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.updateBookCtrl
);

/**
 * @route   PUT /api/documents/admin/magazines/:id
 * @desc    Sửa tài liệu loại Tạp chí (Magazine)
 * @access  Admin (1), Librarian (2)
 */
router.put(
  '/magazines/:id',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.updateMagazineCtrl
);

/**
 * @route   PUT /api/documents/admin/newspapers/:id
 * @desc    Sửa tài liệu loại Báo (Newspaper)
 * @access  Admin (1), Librarian (2)
 */
router.put(
  '/newspapers/:id',
  requireAuth,
  requireRole([1, 2]),
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'ebook', maxCount: 1 }]),
  documentAdminController.updateNewspaperCtrl
);

/**
 * @route   PUT /api/documents/admin/copies/:copyId
 * @desc    Cập nhật 1 bản sao (barCode/status/conditionNote/entryDate)
 * @body    { barCode?, status?, conditionNote?, entryDate? }
 * @access  Admin (1), Librarian (2)
 */
router.put(
  '/copies/:copyId',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.updateCopyCtrl
);

/**
 * @route   DELETE /api/documents/admin/:id
 * @desc    Xóa mềm 1 tài liệu. Tuỳ chọn cascade:
 *          ?cascadeSubtype=0|1 (default=1)
 *          ?cascadeCopies=0|1   (default=0)
 *          ?cascadeMaps=0|1     (default=0)
 * @access  Admin (1), Librarian (2)
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.deleteDocumentCtrl
);

/**
 * @route   DELETE /api/documents/admin/copies/:copyId
 * @desc    Xóa mềm 1 bản sao; tự động cập nhật lại numberOfCopy của tài liệu
 * @access  Admin (1), Librarian (2)
 */
router.delete(
  '/copies/:copyId',
  requireAuth,
  requireRole([1, 2]),
  documentAdminController.deleteCopyCtrl
);

module.exports = router;
