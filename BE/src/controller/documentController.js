// src/controller/documentController.js
const documentService = require('../service/documentService');

const getAllBooksReader = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const type = (req.query.type || 'all').toLowerCase(); // book|magazine|newspaper|all

    const validTypes = ['book', 'magazine', 'newspaper', 'all'];
    const documentType = validTypes.includes(type) ? type : 'all';

    const result = await documentService.getAllDocumentsWithDepositInfo(page, limit, search, documentType);

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tài liệu thành công',
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      filter: { type: documentType, search }
    });
  } catch (error) {
    console.error('Error in getAllBooksReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tài liệu',
      error: error.message
    });
  }
};

const getDocumentDetailReader = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'documentId không hợp lệ' });
    }

    const detail = await documentService.getDocumentDetailWithDeposit(id);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết tài liệu thành công',
      data: detail
    });
  } catch (error) {
    console.error('Error in getDocumentDetailReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết tài liệu',
      error: error.message
    });
  }
};

const getEbookUrlReader = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'documentId không hợp lệ' });
    }
    const ebookUrl = await documentService.getEbookUrlByDocumentId(id);
    if (!ebookUrl) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ebook cho tài liệu này' });
    }
    return res.status(200).json({
      success: true,
      message: 'Lấy URL ebook thành công',
      data: { ebookUrl }
    });
  } catch (error) {
    console.error('Error in getEbookUrlReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy URL ebook',
      error: error.message
    });
  }
};

const getAllGenres = async (req, res) => {
  try {
    const genres = await documentService.getGenre();
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thể loại thành công',
      data: genres
    });
  }
  catch (error) {
    console.error('Error in getAllGenre:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thể loại',
      error: error.message
    });
  }
};

// Lọc tài liệu theo thể loại (genre) — match any|all
const getDocumentsByGenreReader = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const search = (req.query.search || '').toString().trim();

    const type = (req.query.type || 'all').toLowerCase();
    const validTypes = ['book', 'magazine', 'newspaper', 'all'];
    const documentType = validTypes.includes(type) ? type : 'all';

    const matchRaw = (req.query.match || 'any').toLowerCase();
    const match = (matchRaw === 'all') ? 'all' : 'any';

    const genreIdsRaw = (req.query.genreIds || '').toString();
    const genreIds = genreIdsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(n => parseInt(n, 10))
      .filter(n => Number.isInteger(n) && n > 0);

    if (!genreIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu danh sách thể loại (genreIds). Ví dụ: ?genreIds=2,5,9'
      });
    }

    const result = await documentService.getDocumentsByGenre({
      page,
      limit,
      search,
      documentType,
      genreIds,
      match
    });

    return res.status(200).json({
      success: true,
      message: 'Lọc tài liệu theo thể loại thành công',
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      filter: { type: documentType, search, genreIds, match }
    });
  } catch (error) {
    console.error('Error in getDocumentsByGenreReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lọc tài liệu theo thể loại',
      error: error.message
    });
  }
};

const searchDocumentsUniversalReader = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const q = (req.query.q || req.query.search || '').toString().trim(); // hỗ trợ q hoặc search
    const type = (req.query.type || 'all').toLowerCase();
    const validTypes = ['book', 'magazine', 'newspaper', 'all'];
    const documentType = validTypes.includes(type) ? type : 'all';

    const result = await documentService.searchDocumentsUniversal({
      page,
      limit,
      q,
      documentType
    });

    return res.status(200).json({
      success: true,
      message: 'Tìm kiếm thành công',
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      filter: { q, type: documentType }
    });
  } catch (error) {
    console.error('Error in searchDocumentsUniversalReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tìm kiếm',
      error: error.message
    });
  }
};

// Gợi ý tài liệu tương tự cho Reader
const getSimilarDocumentsReader = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'documentId không hợp lệ' });
    }

    const limit = Math.max(parseInt(req.query.limit) || 10, 1);

    // Tuỳ chọn: cho phép FE truyền weights để tinh chỉnh
    const weights = {
      genre: req.query.wGenre ? Number(req.query.wGenre) : 2,
      author: req.query.wAuthor ? Number(req.query.wAuthor) : 3,
      publisher: req.query.wPublisher ? Number(req.query.wPublisher) : 1,
      category: req.query.wCategory ? Number(req.query.wCategory) : 1
    };

    const result = await documentService.getSimilarDocumentsForReader(id, { limit, weights });

    return res.status(200).json({
      success: true,
      message: 'Gợi ý tài liệu tương tự',
      data: result.items,
      pagination: { limit },
      filter: { weights }
    });
  } catch (error) {
    console.error('Error in getSimilarDocumentsReader:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy gợi ý tài liệu tương tự',
      error: error.message
    });
  }
};
const getLatestDocumentsReader = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const type = (req.query.type || 'all').toLowerCase(); // book|magazine|newspaper|all
    const validTypes = ['book', 'magazine', 'newspaper', 'all'];
    const documentType = validTypes.includes(type) ? type : 'all';

    const result = await documentService.getLatestDocuments({ page, limit, documentType });
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tài liệu mới nhất thành công',
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      filter: { type: documentType }
    });
  } catch (error) {
    console.error('Error in getLatestDocumentsReader:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy tài liệu mới nhất', error: error.message });
  }
};

const getPopularDocumentsReader = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const type = (req.query.type || 'all').toLowerCase();
    const validTypes = ['book', 'magazine', 'newspaper', 'all'];
    const documentType = validTypes.includes(type) ? type : 'all';

    const result = await documentService.getPopularDocuments({ page, limit, documentType });
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tài liệu ưa chuộng thành công',
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      filter: { type: documentType }
    });
  } catch (error) {
    console.error('Error in getPopularDocumentsReader:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy tài liệu ưa chuộng', error: error.message });
  }
};

module.exports = {
  getAllBooksReader,
  getDocumentDetailReader,
  getEbookUrlReader,
  getAllGenres,
  getDocumentsByGenreReader,
  searchDocumentsUniversalReader,
  getSimilarDocumentsReader,
  getLatestDocumentsReader,
  getPopularDocumentsReader,
};
