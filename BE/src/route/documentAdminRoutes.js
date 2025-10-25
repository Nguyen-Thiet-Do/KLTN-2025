const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");

const documentAdminController = require("../controller/documentAdminController");

// ======================= ROUTES DÀNH CHO QUẢN TRỊ VIÊN VÀ THỦ THƯ (roleId = 1, 2) =======================

/**
 * @route   GET /api/documents/admin/books/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Sách (Book) - Dành cho Admin và Librarian
 * @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 20, tối đa: 100)
 * @query   search - Tìm theo tiêu đề (LIKE)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/books/basic?page=1&limit=20&search=data
 * */
router.get('/books/basic',
    requireAuth,
    requireRole([1, 2]),
    documentAdminController.getBooks
);
/** 
 *  
 *  
 *  
 *  @route   GET /api/documents/admin/magazines/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Tạp chí (Magazine) - Dành cho Admin và Librarian
 * @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 20, tối đa: 100)
 * @query   search - Tìm theo tiêu đề (LIKE)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/magazines/basic?page=1&limit=20&search=data
 * */
router.get('/magazines/basic',
    requireAuth,
    requireRole([1, 2]),
    documentAdminController.getMagazines
);
/**
 * @route   GET /api/documents/admin/newspapers/basic
 * @desc    Lấy danh sách tài liệu cơ bản loại Báo (Newspaper) - Dành cho Admin và Librarian
 *  @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 20, tối đa: 100)
 * @query   search - Tìm theo tiêu đề (LIKE)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/newspapers/basic?page=1&limit=20&search=data
 * */
router.get('/newspapers/basic',
    requireAuth,
    requireRole([1, 2]),
    documentAdminController.getNewspapers
);
/**
 * @route   GET /api/documents/admin/basic
 * @desc    Lấy danh sách tài liệu cơ bản theo loại (Book, Magazine, Newspaper, All) - Dành cho Admin và Librarian
 *  @query   page   - Số trang (mặc định: 1)
 * @query   limit  - Số mục mỗi trang (mặc định: 20, tối đa: 100)
 * @query   search - Tìm theo tiêu đề (LIKE)
 * @query   documentType - 'book' | 'magazine' | 'newspaper' | 'all' (mặc định: 'all')
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/basic?documentType=book&page=1&limit=20&search=data
 * */
router.get('/basic',
    requireAuth,
    requireRole([1, 2]),
    documentAdminController.getBasicList
);

/**
 * @route   GET /api/documents/admin/:id/copies
 * @desc    Lấy danh sách các bản sao của tài liệu theo ID tài liệu - Dành cho Admin và Librarian
 * @param   id - ID của tài liệu
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example GET /api/documents/admin/15/copies
 * */
router.get('/:id/copies',
    requireAuth,
    requireRole([1, 2]),
    documentAdminController.getCopiesWithDeposit
);

module.exports = router;