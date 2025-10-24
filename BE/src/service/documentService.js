// src/service/documentService.js
const {
  Document, Book, Magazine, Newspaper,
  Category, DocumentCopy, Author, DocumentAuthorMap,
  Publisher, Genre, DocumentGenreMap
} = require('../model');
const { Op } = require('sequelize');

// Map nhãn loại (theo Category.name)
const TYPE_LABELS = {
  book:     ['Sách', 'Sach', 'book'],
  magazine: ['Tạp chí', 'Tap chí', 'Tap chi', 'magazine'],
  newspaper:['Báo', 'Bao', 'newspaper']
};

function inferTypeFromCategoryName(name = '') {
  const n = (name || '').trim().toLowerCase();
  if (TYPE_LABELS.book.some(x => x.toLowerCase() === n)) return 'book';
  if (TYPE_LABELS.magazine.some(x => x.toLowerCase() === n)) return 'magazine';
  if (TYPE_LABELS.newspaper.some(x => x.toLowerCase() === n)) return 'newspaper';
  return 'unknown';
}

/**
 * Danh sách tài liệu + tiền cọc min/max
 * - Loại lọc theo Category.name (Sách/Báo/Tạp chí)
 * - Genre chỉ lấy kèm ở API chi tiết (hàm dưới), không lọc ở đây
 */
const getAllDocumentsWithDepositInfo = async (
  page = 1,
  limit = 10,
  search = '',
  documentType = 'all' // 'all' | 'book' | 'magazine' | 'newspaper'
) => {
  try {
    const offset = (page - 1) * limit;

    // Where chung cho Document
    const whereCondition = { deleted: false };
    if (search) whereCondition.title = { [Op.like]: `%${search}%` };

    // Where cho Category để lọc theo loại
    const categoryWhere = { deleted: false };
    if (documentType !== 'all') {
      categoryWhere.name = { [Op.in]: TYPE_LABELS[documentType] || [] };
    }

    // ==== COUNT: chỉ join Category để tránh đếm trùng ====
    const totalItems = await Document.count({
      where: whereCondition,
      include: [{
        model: Category,
        attributes: [],         // không cần cột gì khi count
        where: categoryWhere,
        required: true
      }],
      distinct: true,
      col: 'documentId'        // đếm theo khóa chính Document
    });

    // ==== LIST: include Category + copies (1-n) ====
    const docs = await Document.findAll({
      where: whereCondition,
      include: [
        {
          model: Category,
          attributes: ['categoryId', 'name', 'deposit_rate'],
          where: categoryWhere,
          required: true
        },
        {
          model: DocumentCopy,
          as: 'copies',
          attributes: ['documentCopyId', 'conditionNote', 'status'],
          where: { deleted: false },
          required: false
        }
      ],
      attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
      limit,
      offset,
      order: [['documentId', 'DESC']],
      distinct: true,          // tránh trả trùng dòng khi có 1-n
      subQuery: false
    });

    // ==== MAP kết quả ====
    const items = docs.map(d => {
      const o = d.toJSON();
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

      const inferredType = inferTypeFromCategoryName(o.Category?.name);

      return {
        documentId: o.documentId,
        title: o.title,
        coverPhoto: o.coverPhoto,
        coverPrice,
        categoryName: o.Category?.name,
        depositRate,
        minDeposit,
        maxDeposit,
        totalCopies: copies.length,
        availableCopies,
        documentType: inferredType
      };
    });

    const totalPages = Math.ceil(totalItems / limit);
    return {
      items,
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  } catch (error) {
    console.error('Error in getAllDocumentsWithDepositInfo:', error);
    throw error;
  }
};

/**
 * Chi tiết tài liệu (xác định loại từ Category.name)
 * - Genre chỉ lấy dữ liệu kèm theo (không lọc)
 * - Vẫn trả thông tin subtype book/magazine/newspaper nếu có
 */
const getDocumentDetailWithDeposit = async (documentId) => {
  try {
    const doc = await Document.findOne({
      where: { documentId, deleted: false },
      attributes: [
        'documentId',
        'categoryId',
        'publisherId',
        'title',
        'shelfLocation',
        'language',
        'publicationYear',
        'coverPrice',
        'description',
        'coverPhoto',
        'ebookUrl',
        'numberOfCopy'
      ],
      include: [
        // Category: nguồn xác định loại + deposit_rate
        {
          model: Category,
          attributes: ['categoryId', 'name', 'deposit_rate', 'deleted'],
          where: { deleted: false },
          required: true
        },

        // Subtype: chỉ lấy dữ liệu thêm; không dùng để xác định loại
        { model: Book,     as: 'book',     attributes: ['isbn', 'edition', 'pageCount', 'deleted'], where: { deleted: false }, required: false },
        { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate', 'deleted'], where: { deleted: false }, required: false },
        { model: Newspaper,as: 'newspaper',attributes: ['issn', 'issueDate', 'issueNumber', 'deleted'], where: { deleted: false }, required: false },

        // Publisher (nullable)
        { model: Publisher, attributes: ['publisherId', 'name', 'note', 'deleted'], where: { deleted: false }, required: false },

        // Copies
        {
          model: DocumentCopy,
          as: 'copies',
          attributes: ['documentCopyId', 'barCode', 'status', 'conditionNote', 'entryDate', 'deleted'],
          where: { deleted: false },
          required: false
        },

        // Authors (N-N)
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
        },

        // Genres (N-N) — chỉ lấy dữ liệu, không lọc
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name', 'deleted'],
          through: {
            model: DocumentGenreMap,
            attributes: [],
            where: { deleted: false }
          },
          where: { deleted: false },
          required: false
        }
      ]
    });

    if (!doc) return null;

    const o = doc.toJSON();

    // Loại từ Category.name
    const documentType = inferTypeFromCategoryName(o.Category?.name);

    // Tính cọc
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

    // Copies chuẩn hoá
    const copyList = copies.map(c => ({
      documentCopyId: c.documentCopyId,
      barCode: c.barCode,
      status: c.status,
      conditionNote: c.conditionNote,
      entryDate: c.entryDate
    }));

    // Authors sort theo ord
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

    // Genres
    const genres = Array.isArray(o.genres)
      ? o.genres.map(g => ({ genreId: g.genreId, name: g.name }))
      : [];

    // Subtype info
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

    const publisher = o.Publisher ? {
      publisherId: o.Publisher.publisherId,
      name: o.Publisher.name,
      note: o.Publisher.note ?? null
    } : null;

    return {
      documentId: o.documentId,
      documentType, // book | magazine | newspaper | unknown
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
      publisher,

      // subtype (chỉ 1 cái sẽ có dữ liệu)
      book: bookInfo,
      magazine: magazineInfo,
      newspaper: newspaperInfo,

      deposit: { minDeposit, maxDeposit },
      authors,
      genres,            // từ bảng Genre, không dùng để lọc
      copies: copyList,
      totalCopies: copies.length,
      availableCopies
    };
  } catch (error) {
    console.error('Error in getDocumentDetailWithDeposit:', error);
    throw error;
  }
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
