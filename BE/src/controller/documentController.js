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


module.exports = { getAllBooksReader, getDocumentDetailReader, getEbookUrlReader };