// src/service/documentService.js
const { Document, Book, Magazine, Newspaper, Category, DocumentCopy, Author, DocumentAuthorMap, Publisher } = require('../model');
const { Sequelize, Op } = require('sequelize');

const getAllDocumentsWithDepositInfo = async (page = 1, limit = 10, search = '', documentType = 'all') => {
  try {
    const offset = (page - 1) * limit;

    const whereCondition = { deleted: false };
    if (search) {
      whereCondition.title = { [Op.like]: `%${search}%` };
    }

    // Build include theo loại
    const commonIncludes = [
      {
        model: Category,
        attributes: ['categoryId', 'name', 'deposit_rate'],
        where: { deleted: false },
        required: true
      },
      {
        model: DocumentCopy,
        as: 'copies',
        attributes: ['documentCopyId', 'conditionNote', 'status'],
        where: { deleted: false },
        required: false
      }
    ];

    const typeIncludes = {
      book: { model: Book, as: 'book', where: { deleted: false }, required: true },
      magazine: { model: Magazine, as: 'magazine', where: { deleted: false }, required: true },
      newspaper: { model: Newspaper, as: 'newspaper', where: { deleted: false }, required: true },
      all: [
        { model: Book, as: 'book', where: { deleted: false }, required: false },
        { model: Magazine, as: 'magazine', where: { deleted: false }, required: false },
        { model: Newspaper, as: 'newspaper', where: { deleted: false }, required: false },
      ]
    };

    const includeForCount =
      documentType === 'all'
        ? [
          ...commonIncludes,
          ...typeIncludes.all
        ]
        : [
          ...commonIncludes,
          typeIncludes[documentType] // required: true để lọc chính xác
        ];

    // Đếm tổng số bản ghi theo lọc
    const totalItems = await Document.count({
      where: whereCondition,
      include: includeForCount
    });

    // Lấy dữ liệu phân trang
    const includeForList = includeForCount;
    const docs = await Document.findAll({
      where: whereCondition,
      include: includeForList,
      attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
      limit,
      offset,
      order: [['documentId', 'DESC']]
    });

    // Map kết quả + tính cọc min/max + xác định documentType theo bản ghi con tồn tại
    const result = docs.map(d => {
      const o = d.toJSON();
      const coverPrice = o.coverPrice || 0;
      const depositRate = o.Category?.deposit_rate || 0;
      const copies = o.copies || [];

      // SUY RA LOẠI: ưu tiên theo include nào có dữ liệu
      let inferredType = 'unknown';
      if (o.book) inferredType = 'book';
      else if (o.magazine) inferredType = 'magazine';
      else if (o.newspaper) inferredType = 'newspaper';

      // Số bản sao sẵn sàng
      const availableCopies = copies.filter(c => c.status === 'AVAILABLE').length;

      // conditionNote trong model là STRING, nên ép số an toàn
      const deposits = (coverPrice > 0 && depositRate > 0)
        ? copies
          .map(c => parseFloat(c.conditionNote))
          .filter(v => !Number.isNaN(v) && v > 0)
          .map(percent => coverPrice * depositRate * (percent / 100))
        : [];

      const minDeposit = deposits.length ? Math.round(Math.min(...deposits)) : null;
      const maxDeposit = deposits.length ? Math.round(Math.max(...deposits)) : null;

      return {
        documentId: o.documentId,
        title: o.title,
        coverPhoto: o.coverPhoto,
        minDeposit,
        maxDeposit,
        coverPrice,
        categoryName: o.Category?.name,
        depositRate,
        totalCopies: copies.length,
        availableCopies,
        documentType: inferredType
      };
    });

    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      items: result,
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage,
      hasPrevPage
    };
  } catch (error) {
    console.error('Error in getAllDocumentsWithDepositInfo:', error);
    throw error;
  }
};


const getDocumentDetailWithDeposit = async (documentId) => {
  const doc = await Document.findOne({
    where: { documentId, deleted: false },
    include: [
      // Loại tài liệu (1-1)
      { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount', 'deleted'], where: { deleted: false }, required: false },
      { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate', 'deleted'], where: { deleted: false }, required: false },
      { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber', 'deleted'], where: { deleted: false }, required: false },

      // Danh mục (để lấy deposit_rate)
      {
        model: Category,
        attributes: ['categoryId', 'name', 'deposit_rate', 'deleted'],
        where: { deleted: false },
        required: true
      },

      // Nhà xuất bản (nullable)
      {
        model: Publisher,
        attributes: ['publisherId', 'name', 'note', 'deleted'],
        where: { deleted: false },
        required: false
      },

      // Các bản sao
      {
        model: DocumentCopy,
        as: 'copies',
        attributes: ['documentCopyId', 'barCode', 'shelfLocation', 'status', 'conditionNote', 'entryDate', 'deleted'],
        where: { deleted: false },
        required: false
      },

      // Tác giả (N-N, sắp theo ord bằng JS)
      {
        model: Author,
        as: 'authors',
        attributes: ['authorId', 'fullName', 'deleted'],
        through: {
          model: DocumentAuthorMap,
          attributes: ['role', 'ord', 'deleted'],
          where: { deleted: false }
        },
        where: { deleted: false },
        required: false
      }
    ],
    // Chỉ các cột có thật trong Documents
    attributes: [
      'documentId',
      'categoryId',
      'publisherId',
      'title',
      'language',
      'publicationYear',
      'coverPrice',
      'description',
      'coverPhoto',
      'ebookUrl',
      'numberOfCopy'
    ]
  });

  if (!doc) return null;

  const o = doc.toJSON();

  // Suy ra loại tài liệu
  let documentType = 'unknown';
  if (o.book) documentType = 'book';
  else if (o.magazine) documentType = 'magazine';
  else if (o.newspaper) documentType = 'newspaper';

  // Tính tiền cọc min/max
  const coverPrice = o.coverPrice || 0;
  const depositRate = o.Category?.deposit_rate || 0;
  const copies = Array.isArray(o.copies) ? o.copies : [];

  const availableCopies = copies.filter(c => c.status === 'AVAILABLE').length;

  const deposits = (coverPrice > 0 && depositRate > 0)
    ? copies
        .map(c => parseFloat(c.conditionNote))
        .filter(v => !Number.isNaN(v) && v > 0)
        .map(percent => coverPrice * depositRate * (percent / 100))
    : [];
  const minDeposit = deposits.length ? Math.round(Math.min(...deposits)) : null;
  const maxDeposit = deposits.length ? Math.round(Math.max(...deposits)) : null;

  // Chuẩn hoá copies
  const copyList = copies.map(c => ({
    documentCopyId: c.documentCopyId,
    barCode: c.barCode,
    shelfLocation: c.shelfLocation,
    status: c.status,
    conditionNote: c.conditionNote,
    entryDate: c.entryDate
  }));

  // Sort authors theo ord (trong bảng map)
  if (Array.isArray(o.authors)) {
    o.authors.sort((a, b) => (a.DocumentAuthorMap?.ord ?? 1) - (b.DocumentAuthorMap?.ord ?? 1));
  }
  const authors = Array.isArray(o.authors)
    ? o.authors.map(a => ({
        authorId: a.authorId,
        fullName: a.fullName,
        role: a.DocumentAuthorMap?.role ?? 'main',
        ord: a.DocumentAuthorMap?.ord ?? 1
      }))
    : [];

  // Thông tin đặc thù theo loại
  const bookInfo = o.book ? {
    isbn: o.book.isbn ?? null,
    edition: o.book.edition ?? null,
    pageCount: o.book.pageCount ?? null
  } : null;

  const magazineInfo = o.magazine ? {
    issn: o.magazine.issn ?? null,
    volume: o.magazine.volume ?? null,
    issue: o.magazine.issue ?? null,
    period: o.magazine.period ?? null,
    coverDate: o.magazine.coverDate ?? null
  } : null;

  const newspaperInfo = o.newspaper ? {
    issn: o.newspaper.issn ?? null,
    issueDate: o.newspaper.issueDate ?? null,
    issueNumber: o.newspaper.issueNumber ?? null
  } : null;

  // Publisher (nếu có)
  const publisher = o.Publisher ? {
    publisherId: o.Publisher.publisherId,
    name: o.Publisher.name,
    note: o.Publisher.note ?? null
  } : null;

  // Kết quả cuối
  return {
    documentId: o.documentId,
    documentType, // book | magazine | newspaper
    title: o.title,
    language: o.language,
    publicationYear: o.publicationYear,
    coverPrice: o.coverPrice,
    description: o.description,
    coverPhoto: o.coverPhoto,
    ebookUrl: o.ebookUrl,
    numberOfCopy: o.numberOfCopy,

    category: {
      categoryId: o.Category?.categoryId,
      name: o.Category?.name,
      depositRate
    },
    publisher,              // có thể là null

    // Thông tin đặc thù theo loại (chỉ một trong ba có dữ liệu)
    book: bookInfo,
    magazine: magazineInfo,
    newspaper: newspaperInfo,

    deposit: { minDeposit, maxDeposit },
    authors,                // mảng tác giả đã sort theo ord
    copies: copyList,
    totalCopies: copies.length,
    availableCopies
  };
};

const getEbookUrlByDocumentId = async (documentId) => {
  const doc = await Document.findOne({
    where: { documentId, deleted: false },
    attributes: ['ebookUrl']
  });
  if (!doc) return null;
  return doc.ebookUrl || null;
};



module.exports = {
  getAllDocumentsWithDepositInfo,
  getDocumentDetailWithDeposit,
  getEbookUrlByDocumentId
};
