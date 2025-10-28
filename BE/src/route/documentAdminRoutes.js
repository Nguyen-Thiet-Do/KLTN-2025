const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");

const documentAdminController = require("../controller/documentAdminController");
const { upload } = require("../middleware/upload");
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

/* ======================= ROUTES TẠO MỚI (BOOK/MAGAZINE/NEWSPAPER) ======================= */
/**
 * @route   POST /api/documents/admin/books
 * @desc    Tạo mới tài liệu loại Sách + subtype Book + copies (1 lần)
 * @body    (multipart: files: cover[bắt buộc], ebook[tuỳ] + fields JSON) hoặc (application/json: coverUrl bắt buộc)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example POST /api/documents/admin/books
 */
router.post(
    "/books",
    requireAuth,
    requireRole([1, 2]),
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "ebook", maxCount: 1 }]),
    documentAdminController.createBookCtrl
);

/**
 * @route   POST /api/documents/admin/magazines
 * @desc    Tạo mới tài liệu loại Tạp chí + subtype Magazine + copies (1 lần)
 * @body    (multipart hoặc json — giống route /books)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example POST /api/documents/admin/magazines
 */
router.post(
    "/magazines",
    requireAuth,
    requireRole([1, 2]),
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "ebook", maxCount: 1 }]),
    documentAdminController.createMagazineCtrl
);

/**
 * @route   POST /api/documents/admin/newspapers
 * @desc    Tạo mới tài liệu loại Báo + subtype Newspaper + copies (1 lần)
 * @body    (multipart hoặc json — giống route /books)
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example POST /api/documents/admin/newspapers
 */
router.post(
    "/newspapers",
    requireAuth,
    requireRole([1, 2]),
    upload.fields([{ name: "cover", maxCount: 1 }, { name: "ebook", maxCount: 1 }]),
    documentAdminController.createNewspaperCtrl
);

/* ======================= ROUTE NHẬP THÊM BẢN SAO ======================= */
/**
 * @route   POST /api/documents/admin/:id/copies
 * @desc    Nhập thêm bản sao cho 1 tài liệu đã tồn tại
 * @body    JSON array [{ barCode?, status?, conditionNote?, entryDate? }, ...]
 * @access  Admin (roleId=1), Librarian (roleId=2)
 * @example POST /api/documents/admin/15/copies
 */
router.post(
    "/:id/copies",
    requireAuth,
    requireRole([1, 2]),
    express.json(), // đảm bảo parse JSON body cho mảng copies
    documentAdminController.addCopiesCtrl
);

module.exports = router;