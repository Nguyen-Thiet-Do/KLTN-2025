// src/service/documentService.js
const {
  Document, Book, Magazine, Newspaper,
  Category, DocumentCopy, Author, DocumentAuthorMap,
  Publisher, Genre, DocumentGenreMap
} = require('../model');
const { Op, col, fn, where } = require('sequelize');
/**
 * Bảng nhãn loại tài liệu theo Category.name (đa ngôn ngữ/biến thể viết)
 * Dùng để suy luận documentType từ tên Category.
 */
const TYPE_LABELS = {
  book: ['Sách', 'Sach', 'book'],
  magazine: ['Tạp chí', 'Tap chí', 'Tap chi', 'magazine'],
  newspaper: ['Báo', 'Bao', 'newspaper']
};

/**
 * Suy luận loại tài liệu từ tên Category (không phụ thuộc vào bảng subtype)
 * @param {string} [name=''] - Category.name
 * @returns {'book'|'magazine'|'newspaper'|'unknown'}
 */
function inferTypeFromCategoryName(name = '') {
  const n = (name || '').trim().toLowerCase();
  if (TYPE_LABELS.book.some(x => x.toLowerCase() === n)) return 'book';
  if (TYPE_LABELS.magazine.some(x => x.toLowerCase() === n)) return 'magazine';
  if (TYPE_LABELS.newspaper.some(x => x.toLowerCase() === n)) return 'newspaper';
  return 'unknown';
}

/* -----------------------------------------------------------------------------
 *                       CÁC BUILDER CHO WHERE / INCLUDE
 * ---------------------------------------------------------------------------*/

/**
 * Tạo where cho bảng Document theo text search.
 * @param {string} [search=''] - Tìm theo tiêu đề (LIKE %search%)
 * @returns {object} - Sequelize where cho Document
 */
function buildDocumentWhere(search = '') {
  const where = { deleted: false };
  if (search) where.title = { [Op.like]: `%${search}%` };
  return where;
}

/**
 * Tạo where cho bảng Category theo documentType.
 * - 'all': không lọc theo loại
 * - 'book' | 'magazine' | 'newspaper': lọc theo tập nhãn tương ứng
 * @param {'all'|'book'|'magazine'|'newspaper'} [documentType='all']
 * @returns {object} - Sequelize where cho Category
 */
function buildCategoryWhere(documentType = 'all') {
  const where = { deleted: false };
  if (documentType !== 'all') {
    where.name = { [Op.in]: TYPE_LABELS[documentType] || [] };
  }
  return where;
}

/**
 * Include cho danh sách tài liệu (LIST)
 * - Join Category (bắt buộc) để biết deposit_rate và xác thực loại hợp lệ
 * - Join DocumentCopy (tuỳ chọn) để tính tồn kho và tiền cọc
 * @param {object} categoryWhere - where cho Category
 * @returns {Array} - Mảng include cho Sequelize
 */
function listIncludeForDocuments(categoryWhere) {
  return [
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
  ];
}

/**
 * Include cho chi tiết tài liệu (DETAIL)
 * - Join Category (bắt buộc)
 * - Join các subtype (Book/Magazine/Newspaper), Publisher (nullable)
 * - Join Copies, Authors (N-N), Genres (N-N)
 * @param {object} categoryWhere - where cho Category
 * @returns {Array} - Mảng include cho Sequelize
 */
function detailInclude(categoryWhere) {
  return [
    {
      model: Category,
      attributes: ['categoryId', 'name', 'deposit_rate', 'deleted'],
      where: categoryWhere,
      required: true
    },
    { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount', 'deleted'], where: { deleted: false }, required: false },
    { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate', 'deleted'], where: { deleted: false }, required: false },
    { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber', 'deleted'], where: { deleted: false }, required: false },
    { model: Publisher, attributes: ['publisherId', 'name', 'note', 'deleted'], where: { deleted: false }, required: false },
    {
      model: DocumentCopy,
      as: 'copies',
      attributes: ['documentCopyId', 'barCode', 'status', 'conditionNote', 'entryDate', 'deleted'],
      where: { deleted: false },
      required: false
    },
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
  ];
}

/* -----------------------------------------------------------------------------
 *                   HELPERS NGHIỆP VỤ: TÍNH CỌC / CHUẨN HOÁ
 * ---------------------------------------------------------------------------*/

function safeToNumber(x) {
  const v = parseFloat(x);
  return Number.isNaN(v) ? null : v;
}

function computeDepositStats(coverPrice = 0, depositRate = 0, copies = []) {
  if (!(coverPrice > 0 && depositRate > 0)) return { minDeposit: null, maxDeposit: null };
  const values = copies
    .map(c => safeToNumber(c.conditionNote))
    .filter(v => v !== null && v > 0)
    .map(percent => coverPrice * depositRate * (percent / 100));

  if (!values.length) return { minDeposit: null, maxDeposit: null };
  return {
    minDeposit: Math.round(Math.min(...values)),
    maxDeposit: Math.round(Math.max(...values))
  };
}

function normalizeCopies(copies = []) {
  return copies.map(c => ({
    documentCopyId: c.documentCopyId,
    barCode: c.barCode,
    status: c.status,
    conditionNote: c.conditionNote,
    entryDate: c.entryDate
  }));
}

function normalizeAuthors(authors = []) {
  const arr = [...authors];
  arr.sort((a, b) => (a.DocumentAuthorMap?.ord ?? 1) - (b.DocumentAuthorMap?.ord ?? 1));
  return arr.map(a => ({
    authorId: a.authorId,
    fullName: a.fullName,
    role: a.DocumentAuthorMap?.role ?? 'main',
    ord: a.DocumentAuthorMap?.ord ?? 1
  }));
}

function normalizeGenres(genres = []) {
  return genres.map(g => ({ genreId: g.genreId, name: g.name }));
}

function extractSubtypeInfo(o) {
  const book = o.book ? {
    isbn: o.book.isbn ?? null,
    edition: o.book.edition ?? null,
    pageCount: o.book.pageCount ?? null
  } : null;

  const magazine = o.magazine ? {
    issn: o.magazine.issn ?? null,
    volume: o.magazine.volume ?? null,
    issue: o.magazine.issue ?? null,
    period: o.magazine.period ?? null,
    coverDate: o.magazine.coverDate ?? null
  } : null;

  const newspaper = o.newspaper ? {
    issn: o.newspaper.issn ?? null,
    issueDate: o.newspaper.issueDate ?? null,
    issueNumber: o.newspaper.issueNumber ?? null
  } : null;

  return { book, magazine, newspaper };
}

function mapListItem(d) {
  const o = d.toJSON();
  const coverPrice = o.coverPrice || 0;
  const depositRate = o.Category?.deposit_rate || 0;
  const copies = Array.isArray(o.copies) ? o.copies : [];
  const availableCopies = copies.filter(c => c.status === 'AVAILABLE').length;
  const { minDeposit, maxDeposit } = computeDepositStats(coverPrice, depositRate, copies);

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
    documentType: inferTypeFromCategoryName(o.Category?.name)
  };
}

/* -----------------------------------------------------------------------------
 *                        HÀM TRUY VẤN CỐT LÕI (REUSE)
 * ---------------------------------------------------------------------------*/

async function countDocuments(whereDoc, whereCat) {
  return Document.count({
    where: whereDoc,
    include: [{
      model: Category,
      attributes: [],
      where: whereCat,
      required: true
    }],
    distinct: true,
    col: 'documentId'
  });
}

async function findDocuments(whereDoc, whereCat, { limit, offset }) {
  return Document.findAll({
    where: whereDoc,
    include: listIncludeForDocuments(whereCat),
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
    limit,
    offset,
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });
}

async function findDocumentDetail(documentId, whereCat) {
  return Document.findOne({
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
    include: detailInclude(whereCat)
  });
}

/* -----------------------------------------------------------------------------
 *                   LỌC THEO GENRE (ANY / ALL) — FIX PHÂN TRANG
 * ---------------------------------------------------------------------------*/

/**
 * Lấy danh sách documentId cho match 'any' (ít nhất 1 genre)
 * Áp limit/offset trên ID duy nhất để phân trang ổn.
 */
async function findDocumentIdsMatchAny(whereDoc, whereCat, genreIds = [], { limit, offset }) {
  const rows = await Document.findAll({
    where: whereDoc,
    attributes: ['documentId'],
    include: [
      { model: Category, attributes: [], where: whereCat, required: true },
      {
        model: Genre,
        as: 'genres',
        attributes: [],
        through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
        where: { deleted: false, genreId: { [Op.in]: genreIds } },
        required: true
      }
    ],
    group: ['Document.documentId'],
    order: [[col('Document.documentId'), 'DESC']],
    limit,
    offset,
    subQuery: false
  });
  return rows.map(r => r.documentId);
}

/**
 * Lấy danh sách documentId cho match 'all' (đủ tất cả genre)
 */
async function findDocumentIdsMatchAll(whereDoc, whereCat, genreIds = [], { limit, offset }) {
  const rows = await Document.findAll({
    where: whereDoc,
    attributes: [
      'documentId',
      [fn('COUNT', fn('DISTINCT', col('genres.genreId'))), 'genreCount']
    ],
    include: [
      { model: Category, attributes: [], where: whereCat, required: true },
      {
        model: Genre,
        as: 'genres',
        attributes: [],
        through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
        where: { deleted: false, genreId: { [Op.in]: genreIds } },
        required: true
      }
    ],
    group: ['Document.documentId'],
    having: where(col('genreCount'), genreIds.length),
    order: [[col('Document.documentId'), 'DESC']],
    limit,
    offset,
    subQuery: false
  });

  return rows.map(r => r.documentId);
}

/**
 * Đếm tổng số Document cho match 'all'
 */
async function countDocumentsMatchAll(whereDoc, whereCat, genreIds = []) {
  const rows = await Document.findAll({
    where: whereDoc,
    attributes: [
      'documentId',
      [fn('COUNT', fn('DISTINCT', col('genres.genreId'))), 'genreCount']
    ],
    include: [
      { model: Category, attributes: [], where: whereCat, required: true },
      {
        model: Genre,
        as: 'genres',
        attributes: [],
        through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
        where: { deleted: false, genreId: { [Op.in]: genreIds } },
        required: true
      }
    ],
    group: ['Document.documentId'],
    having: where(col('genreCount'), genreIds.length)
  });

  return rows.length;
}

/**
 * Lọc theo Genre, hỗ trợ match 'any' | 'all'
 * ĐÃ FIX phân trang cho nhánh 'any' bằng cách phân trang theo ID trước.
 */
async function getDocumentsByGenre({
  page = 1,
  limit = 10,
  search = '',
  documentType = 'all',
  genreIds = [],
  match = 'any'
} = {}) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) {
    return {
      items: [],
      currentPage: page,
      totalPages: 0,
      totalItems: 0,
      limit,
      hasNextPage: false,
      hasPrevPage: page > 1
    };
  }

  const offset = (page - 1) * limit;
  const whereDoc = buildDocumentWhere(search);
  const whereCat = buildCategoryWhere(documentType);

  if (match === 'any') {
    // 1) Đếm tổng distinct documentId
    const totalItems = await Document.count({
      where: whereDoc,
      include: [
        { model: Category, attributes: [], where: whereCat, required: true },
        {
          model: Genre,
          as: 'genres',
          attributes: [],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false, genreId: { [Op.in]: genreIds } },
          required: true
        }
      ],
      distinct: true,
      col: 'documentId'
    });

    // 2) Lấy trang ID trước
    const ids = await findDocumentIdsMatchAny(whereDoc, whereCat, genreIds, { limit, offset });
    if (ids.length === 0) {
      return {
        items: [],
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        limit,
        hasNextPage: false,
        hasPrevPage: page > 1
      };
    }

    // 3) Lấy chi tiết theo ID (đính kèm genres & copies)
    const rows = await Document.findAll({
      where: { ...whereDoc, documentId: { [Op.in]: ids } },
      include: [
        ...listIncludeForDocuments(whereCat),
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false },
          required: false
        }
      ],
      attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
      order: [['documentId', 'DESC']],
      distinct: true,
      subQuery: false
    });

    // Giữ đúng thứ tự theo ids
    const mapById = new Map(rows.map(r => [r.documentId, r]));
    const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

    const items = ordered.map(mapListItem);
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
  }

  // match === 'all'
  const totalItems = await countDocumentsMatchAll(whereDoc, whereCat, genreIds);
  const ids = await findDocumentIdsMatchAll(whereDoc, whereCat, genreIds, { limit, offset });

  if (ids.length === 0) {
    return {
      items: [],
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit,
      hasNextPage: false,
      hasPrevPage: page > 1
    };
  }

  const rows = await Document.findAll({
    where: { ...whereDoc, documentId: { [Op.in]: ids } },
    include: [
      ...listIncludeForDocuments(whereCat),
      {
        model: Genre,
        as: 'genres',
        attributes: ['genreId', 'name'],
        through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
        where: { deleted: false },
        required: false
      }
    ],
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  const mapById = new Map(rows.map(r => [r.documentId, r]));
  const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

  const items = ordered.map(mapListItem);
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
}

/* -----------------------------------------------------------------------------
 *                                PUBLIC APIS
 * ---------------------------------------------------------------------------*/

const getAllDocumentsWithDepositInfo = async (
  page = 1,
  limit = 10,
  search = '',
  documentType = 'all'
) => {
  try {
    const offset = (page - 1) * limit;

    const whereDoc = buildDocumentWhere(search);
    const whereCat = buildCategoryWhere(documentType);

    const totalItems = await countDocuments(whereDoc, whereCat);
    const rows = await findDocuments(whereDoc, whereCat, { limit, offset });

    const items = rows.map(mapListItem);
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

const getDocumentDetailWithDeposit = async (documentId) => {
  try {
    const whereCat = { deleted: false };
    const doc = await findDocumentDetail(documentId, whereCat);
    if (!doc) return null;

    const o = doc.toJSON();
    const documentType = inferTypeFromCategoryName(o.Category?.name);

    const coverPrice = o.coverPrice || 0;
    const depositRate = o.Category?.deposit_rate || 0;
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const availableCopies = copies.filter(c => c.status === 'AVAILABLE').length;
    const { minDeposit, maxDeposit } = computeDepositStats(coverPrice, depositRate, copies);

    const { book, magazine, newspaper } = extractSubtypeInfo(o);

    const publisher = o.Publisher ? {
      publisherId: o.Publisher.publisherId,
      name: o.Publisher.name,
      note: o.Publisher.note ?? null
    } : null;

    return {
      documentId: o.documentId,
      documentType,
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

      book,
      magazine,
      newspaper,

      deposit: { minDeposit, maxDeposit },
      authors: normalizeAuthors(o.authors || []),
      genres: normalizeGenres(o.genres || []),
      copies: normalizeCopies(copies),
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

const getGenre = async () => {
  try {
    const genres = await Genre.findAll({
      where: { deleted: false },
      attributes: ['genreId', 'name'],
      order: [['name', 'ASC']]
    });
    return genres.map(g => ({
      genreId: g.genreId,
      name: g.name
    }));
  } catch (error) {
    console.error('Error in getGenre:', error);
    throw error;
  }
};
// tìm kiếm all 

// ===== Helper: chuẩn hoá từ khoá tìm kiếm
function buildLikePattern(q) {
  const s = String(q || '').trim();
  if (!s) return null;
  // có thể thêm escape % _ nếu cần
  return `%${s}%`;
}

/**
 * Truy vấn ra danh sách documentId thỏa tìm kiếm tổng quát.
 * Tìm theo: title, Category.name, Publisher.name, authors.fullName, genres.name,
 * book.isbn, magazine.issn, newspaper.issn.
 * - includes để enable các path $...$ nhưng đều required:false
 * - group theo documentId để phân trang ổn định
 */
async function findDocumentIdsByUniversalSearch({ q, documentType = 'all', limit = 10, offset = 0 }) {
  const like = buildLikePattern(q);
  if (!like) return []; // không có từ khoá -> trả rỗng; UI có thể fallback sang list

  const whereCat = buildCategoryWhere(documentType);

  const rows = await Document.findAll({
    where: {
      deleted: false,
      [Op.or]: [
        { title: { [Op.like]: like } },
        { '$Category.name$': { [Op.like]: like } },
        { '$Publisher.name$': { [Op.like]: like } },
        { '$authors.fullName$': { [Op.like]: like } },
        { '$genres.name$': { [Op.like]: like } },
        { '$book.isbn$': { [Op.like]: like } },
        { '$magazine.issn$': { [Op.like]: like } },
        { '$newspaper.issn$': { [Op.like]: like } }
      ]
    },
    attributes: [
      'documentId'
    ],
    include: [
      // Category (lọc loại nếu có)
      { model: Category, attributes: [], where: whereCat, required: true },

      // Các bảng khác để mở đường cho $alias.field$ (required:false)
      { model: Publisher, attributes: [], required: false, where: { deleted: false } },
      { model: Author, as: 'authors', attributes: [], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } },
      { model: Genre, as: 'genres', attributes: [], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } },
      { model: Book, as: 'book', attributes: [], required: false, where: { deleted: false } },
      { model: Magazine, as: 'magazine', attributes: [], required: false, where: { deleted: false } },
      { model: Newspaper, as: 'newspaper', attributes: [], required: false, where: { deleted: false } }
    ],
    group: ['Document.documentId'],
    order: [[col('Document.documentId'), 'DESC']],
    limit,
    offset,
    subQuery: false
  });

  return rows.map(r => r.documentId);
}

/**
 * Đếm tổng distinct documentId cho tìm kiếm tổng quát.
 * Dùng Document.count(distinct) + cùng where/include (required như trên).
 */
async function countDocumentsUniversalSearch({ q, documentType = 'all' }) {
  const like = buildLikePattern(q);
  if (!like) return 0;

  const whereCat = buildCategoryWhere(documentType);

  const total = await Document.count({
    where: {
      deleted: false,
      [Op.or]: [
        { title: { [Op.like]: like } },
        { '$Category.name$': { [Op.like]: like } },
        { '$Publisher.name$': { [Op.like]: like } },
        { '$authors.fullName$': { [Op.like]: like } },
        { '$genres.name$': { [Op.like]: like } },
        { '$book.isbn$': { [Op.like]: like } },
        { '$magazine.issn$': { [Op.like]: like } },
        { '$newspaper.issn$': { [Op.like]: like } }
      ]
    },
    include: [
      { model: Category, attributes: [], where: whereCat, required: true },
      { model: Publisher, attributes: [], required: false, where: { deleted: false } },
      { model: Author, as: 'authors', attributes: [], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } },
      { model: Genre, as: 'genres', attributes: [], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } },
      { model: Book, as: 'book', attributes: [], required: false, where: { deleted: false } },
      { model: Magazine, as: 'magazine', attributes: [], required: false, where: { deleted: false } },
      { model: Newspaper, as: 'newspaper', attributes: [], required: false, where: { deleted: false } }
    ],
    distinct: true,
    col: 'documentId'
  });

  return total;
}

/**
 * PUBLIC: Universal search — tìm theo nhiều trường & bảng liên quan.
 * Giữ kiểu trả về giống list: items + pagination.
 */
async function searchDocumentsUniversal({
  page = 1,
  limit = 10,
  q = '',
  documentType = 'all'
} = {}) {
  const offset = (page - 1) * limit;

  // 1) Đếm tổng
  const totalItems = await countDocumentsUniversalSearch({ q, documentType });

  if (totalItems === 0) {
    return {
      items: [],
      currentPage: page,
      totalPages: 0,
      totalItems: 0,
      limit,
      hasNextPage: false,
      hasPrevPage: page > 1
    };
  }

  // 2) Lấy ID trang hiện tại
  const ids = await findDocumentIdsByUniversalSearch({ q, documentType, limit, offset });
  if (ids.length === 0) {
    return {
      items: [],
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit,
      hasNextPage: false,
      hasPrevPage: page > 1
    };
  }

  // 3) Lấy chi tiết theo ID (đính kèm Category + Copies để tính cọc)
  const whereDoc = { deleted: false, documentId: { [Op.in]: ids } };
  const whereCat = buildCategoryWhere(documentType);

  const rows = await Document.findAll({
    where: whereDoc,
    include: [
      ...listIncludeForDocuments(whereCat),
      // (không bắt buộc, chỉ để hiển thị nếu bạn muốn)
      { model: Publisher, attributes: ['publisherId', 'name'], required: false, where: { deleted: false } },
      { model: Genre, as: 'genres', attributes: ['genreId', 'name'], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } }
    ],
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  // giữ thứ tự theo ids
  const mapById = new Map(rows.map(r => [r.documentId, r]));
  const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

  const items = ordered.map(mapListItem);
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
}
module.exports = {
  getAllDocumentsWithDepositInfo,
  getDocumentDetailWithDeposit,
  getEbookUrlByDocumentId,
  getGenre,
  getDocumentsByGenre,
  searchDocumentsUniversal
};
