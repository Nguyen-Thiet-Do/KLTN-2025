// src/service/documentService.js
/* =============================================================================
 *                              IMPORTS & SETUP
 * ========================================================================== */
const {
  Document, Book, Magazine, Newspaper,
  Category, DocumentCopy, Author, DocumentAuthorMap,
  Publisher, Genre, DocumentGenreMap,
  // thêm để tính "giữ chỗ mềm"
  LoanSlip, LoanDetail
} = require('../model');
const { Op, col, fn, where, literal } = require('sequelize');

/* =============================================================================
 *                              CONSTANTS & LABELS
 * ========================================================================== */
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
 * Chuẩn hoá chuỗi -> UPPER (để so sánh case-insensitive an toàn)
 */
function toUPPER(x) {
  return String(x || '').trim().toUpperCase();
}

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

/* =============================================================================
 *                          QUERY BUILDERS (WHERE/INCLUDE)
 * ========================================================================== */
/**
 * Tạo where cho bảng Document theo text search.
 * @param {string} [search=''] - Tìm theo tiêu đề (LIKE %search%)
 * @returns {object} - Sequelize where cho Document
 */
function buildDocumentWhere(search = '') {
  const whereDoc = { deleted: false };
  if (search) whereDoc.title = { [Op.like]: `%${search}%` };
  return whereDoc;
}

/**
 * Tạo where cho bảng Category theo documentType.
 * - 'all': không lọc theo loại
 * - 'book' | 'magazine' | 'newspaper': lọc theo tập nhãn tương ứng
 * @param {'all'|'book'|'magazine'|'newspaper'} [documentType='all']
 * @returns {object} - Sequelize where cho Category
 */
function buildCategoryWhere(documentType = 'all') {
  const whereCat = { deleted: false };
  if (documentType !== 'all') {
    whereCat.name = { [Op.in]: TYPE_LABELS[documentType] || [] };
  }
  return whereCat;
}

/**
 * Include cho danh sách tài liệu (LIST)
 * - Join Category (bắt buộc) để biết tên và xác thực loại hợp lệ
 * - Join DocumentCopy (tuỳ chọn) để tính tồn kho
 * Lưu ý: đã loại bỏ các trường liên quan tới deposit.
 * @param {object} categoryWhere - where cho Category
 * @returns {Array} - Mảng include cho Sequelize
 */
function listIncludeForDocuments(categoryWhere) {
  return [
    {
      model: Category,
      // chỉ lấy những trường cần cho list, bỏ deposit_rate
      attributes: ['categoryId', 'name'],
      where: categoryWhere,
      required: true
    },
    {
      model: DocumentCopy,
      as: 'copies',
      attributes: ['documentCopyId', 'conditionNote', 'status', 'numberBorrow'],
      where: { deleted: false },
      required: false,
      separate: true
    }
  ];
}

/**
 * Include cho chi tiết tài liệu (DETAIL)
 * - Join Category (bắt buộc)
 * - Join các subtype (Book/Magazine/Newspaper), Publisher (nullable)
 * - Join Copies, Authors (N-N), Genres (N-N)
 * Lưu ý: đã loại bỏ deposit_rate khỏi Category attributes.
 * @param {object} categoryWhere - where cho Category
 * @returns {Array} - Mảng include cho Sequelize
 */
function detailInclude(categoryWhere) {
  return [
    {
      model: Category,
      // bỏ deposit_rate khỏi attributes
      attributes: ['categoryId', 'name', 'deleted'],
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
      attributes: ['documentCopyId', 'barCode', 'status', 'conditionNote', 'entryDate', 'deleted', 'numberBorrow'],
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

/* =============================================================================
 *                       BUSINESS HELPERS (CHUẨN HOÁ)
 * ========================================================================== */
function safeToNumber(x) {
  const v = parseFloat(x);
  return Number.isNaN(v) ? null : v;
}

function normalizeCopies(copies = []) {
  return copies.map(c => ({
    documentCopyId: c.documentCopyId,
    barCode: c.barCode,
    status: c.status,
    conditionNote: c.conditionNote,
    entryDate: c.entryDate,
    numberBorrow: c.numberBorrow
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

/**
 * Đếm AVAILABLE theo case-insensitive
 */
function countAvailableCopiesCaseInsensitive(copies = []) {
  let n = 0;
  for (const c of copies) {
    if (toUPPER(c.status) === 'AVAILABLE') n += 1;
  }
  return n;
}

/**
 * MỚI: Đếm số bản "còn có thể mượn"
 * Hiện tại định nghĩa = status === 'AVAILABLE' (case-insensitive).
 * Nếu muốn thay logic (ví dụ cho ON_SHELF), chỉnh hàm này.
 */
function countBorrowableCopiesCaseInsensitive(copies = []) {
  let n = 0;
  for (const c of copies) {
    if (toUPPER(c.status) === 'AVAILABLE') n += 1;
  }
  return n;
}

/**
 * MỚI: Tổng số lượt đã mượn của các bản sao (tổng numberBorrow trên các copies)
 */
function totalNumberBorrowFromCopies(copies = []) {
  let s = 0;
  for (const c of copies) {
    const v = safeToNumber(c.numberBorrow);
    s += (Number.isFinite(v) ? v : 0);
  }
  return s;
}

function mapListItem(d) {
  const o = d.toJSON();
  const coverPrice = o.coverPrice || 0;
  const copies = Array.isArray(o.copies) ? o.copies : [];
  // dùng case-insensitive
  const availableCopies = countAvailableCopiesCaseInsensitive(copies);

  // --- MỚI: tổng lượt mượn và số bản có thể mượn ---
  const borrowableCopies = countBorrowableCopiesCaseInsensitive(copies);
  const totalBorrow = totalNumberBorrowFromCopies(copies);

  return {
    documentId: o.documentId,
    title: o.title,
    coverPhoto: o.coverPhoto,
    coverPrice,
    categoryName: o.Category?.name,
    shelfLocation: o.shelfLocation,
    totalCopies: copies.length,
    availableCopies,
    borrowableCopies,       // số bản còn có thể mượn
    totalBorrow,            // tổng lượt mượn của tất cả copies
    documentType: inferTypeFromCategoryName(o.Category?.name)
  };
}

/**
 * Bản mở rộng của mapListItem để thêm availableCopiesEffective
 */
function mapListItemWithEffective(d, effectiveAvailable = null) {
  const base = mapListItem(d);
  return {
    ...base,
    availableCopiesEffective: effectiveAvailable !== null ? Math.max(0, effectiveAvailable) : base.availableCopies
  };
}

// ===== Helper: chuẩn hoá từ khoá tìm kiếm
function buildLikePattern(q) {
  const s = String(q || '').trim();
  if (!s) return null;
  return `%${s}%`;
}

/* =============================================================================
 *                       HOLDS (PENDING) HELPERS
 * ========================================================================== */
/**
 * Đếm số lượng LoanDetail đang "giữ chỗ mềm" (PENDING, chưa gán copy) theo documentId.
 * So sánh PENDING theo case-insensitive bằng UPPER(LoanSlip.status) = 'PENDING'
 * Hiện tại dựa trên tag trong note: REQUEST_DOCUMENT_ID=<documentId>
 * @param {number[]} documentIds
 * @param {object} [tx]
 * @returns {Promise<Map<number, number>>}
 */
async function getPendingHoldsByDocumentIds(documentIds = [], tx = undefined) {
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return new Map();
  }

  const notePatterns = documentIds.map(id => `REQUEST_DOCUMENT_ID=${id}`);

  const rows = await LoanDetail.findAll({
    include: [{
      model: LoanSlip,
      required: true,
      where: {
        deleted: false,
        // CASE-INSENSITIVE: UPPER(status) = 'PENDING'
        [Op.and]: [where(fn('upper', col('LoanSlip.status')), 'PENDING')]
      },
      attributes: []
    }],
    where: {
      documentCopyId: { [Op.is]: null },
      note: { [Op.in]: notePatterns }
    },
    attributes: ['note', [fn('COUNT', col('LoanDetail.loanDetailId')), 'cnt']],
    group: ['note'],
    transaction: tx
  });

  const map = new Map(documentIds.map(id => [id, 0]));
  for (const r of rows) {
    const note = r.get('note');
    const cnt = Number(r.get('cnt')) || 0;
    const m = /REQUEST_DOCUMENT_ID=(\d+)/.exec(String(note || ''));
    const docId = m ? Number(m[1]) : null;
    if (docId && map.has(docId)) {
      map.set(docId, (map.get(docId) || 0) + cnt);
    }
  }
  return map;
}

/**
 * Đếm pending holds cho 1 documentId
 */
async function getPendingHoldsByDocumentId(documentId, tx = undefined) {
  const map = await getPendingHoldsByDocumentIds([documentId], tx);
  return map.get(documentId) || 0;
}

/* =============================================================================
 *                          CORE QUERY (REUSABLE)
 * ========================================================================== */
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
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    limit,
    offset,
    order: [['documentId', 'DESC']],
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

/* =============================================================================
 *                       GENRE FILTERING (ANY / ALL) — PAGINATION-FIXED
 * ========================================================================== */
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
      attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
      order: [['documentId', 'DESC']],
      distinct: true,
      subQuery: false
    });

    const mapById = new Map(rows.map(r => [r.documentId, r]));
    const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

    // Tính effective cho list
    const docIds = ordered.map(r => r.documentId);
    const pendingMap = await getPendingHoldsByDocumentIds(docIds);
    const items = ordered.map(d => {
      const o = d.toJSON();
      const copies = Array.isArray(o.copies) ? o.copies : [];
      const available = countAvailableCopiesCaseInsensitive(copies);
      const holds = pendingMap.get(o.documentId) || 0;
      const effective = available - holds;
      return mapListItemWithEffective(d, effective);
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
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  const mapById = new Map(rows.map(r => [r.documentId, r]));
  const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

  const docIds = ordered.map(r => r.documentId);
  const pendingMap = await getPendingHoldsByDocumentIds(docIds);
  const items = ordered.map(d => {
    const o = d.toJSON();
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const available = countAvailableCopiesCaseInsensitive(copies);
    const holds = pendingMap.get(o.documentId) || 0;
    const effective = available - holds;
    return mapListItemWithEffective(d, effective);
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
}

/* =============================================================================
 *                         UNIVERSAL SEARCH (NHIỀU TRƯỜNG)
 * ========================================================================== */
async function findDocumentIdsByUniversalSearch({ q, documentType = 'all', limit = 10, offset = 0 }) {
  const like = buildLikePattern(q);
  if (!like) return []; // không có từ khoá -> trả rỗng

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
    attributes: ['documentId'],
    include: [
      { model: Category, attributes: [], where: whereCat, required: true },
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

async function searchDocumentsUniversal({
  page = 1,
  limit = 10,
  q = '',
  documentType = 'all'
} = {}) {
  const offset = (page - 1) * limit;

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

  const whereDoc = { deleted: false, documentId: { [Op.in]: ids } };
  const whereCat = buildCategoryWhere(documentType);

  const rows = await Document.findAll({
    where: whereDoc,
    include: [
      ...listIncludeForDocuments(whereCat),
      { model: Publisher, attributes: ['publisherId', 'name'], required: false, where: { deleted: false } },
      { model: Genre, as: 'genres', attributes: ['genreId', 'name'], required: false, through: { attributes: [], where: { deleted: false } }, where: { deleted: false } }
    ],
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  const mapById = new Map(rows.map(r => [r.documentId, r]));
  const ordered = ids.map(id => mapById.get(id)).filter(Boolean);

  // Tính effective cho list
  const docIds = ordered.map(r => r.documentId);
  const pendingMap = await getPendingHoldsByDocumentIds(docIds);
  const items = ordered.map(d => {
    const o = d.toJSON();
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const available = countAvailableCopiesCaseInsensitive(copies);
    const holds = pendingMap.get(o.documentId) || 0;
    const effective = available - holds;
    return mapListItemWithEffective(d, effective);
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
}

/* =============================================================================
 *                      SIMILAR DOCS (RECOMMENDER FOR READERS)
 * ========================================================================== */
async function getSimilarSeed(documentId) {
  const doc = await Document.findOne({
    where: { documentId, deleted: false },
    attributes: ['documentId', 'categoryId', 'publisherId', 'language', 'shelfLocation'],
    include: [
      { model: Category, attributes: ['categoryId', 'name'], where: { deleted: false }, required: true },
      { model: Author, as: 'authors', attributes: ['authorId'], through: { attributes: [], where: { deleted: false } }, where: { deleted: false }, required: false },
      { model: Genre, as: 'genres', attributes: ['genreId'], through: { attributes: [], where: { deleted: false } }, where: { deleted: false }, required: false }
    ]
  });
  if (!doc) return null;

  const o = doc.toJSON();
  return {
    categoryId: o.categoryId,
    publisherId: o.publisherId || null,
    authorIds: (o.authors || []).map(a => a.authorId),
    genreIds: (o.genres || []).map(g => g.genreId)
  };
}

async function findBySharedGenres(genreIds = [], excludeId, limit = 200) {
  if (!genreIds.length) return new Map();
  const rows = await Document.findAll({
    where: { deleted: false, documentId: { [Op.ne]: excludeId } },
    attributes: [
      'documentId',
      [fn('COUNT', fn('DISTINCT', col('genres.genreId'))), 'sharedGenreCount']
    ],
    include: [{
      model: Genre,
      as: 'genres',
      attributes: [],
      through: { attributes: [], where: { deleted: false } },
      where: { deleted: false, genreId: { [Op.in]: genreIds } },
      required: true
    }],
    group: ['Document.documentId'],
    order: [[col('sharedGenreCount'), 'DESC']],
    limit,
    subQuery: false
  });
  const map = new Map();
  rows.forEach(r => map.set(r.documentId, Number(r.get('sharedGenreCount')) || 0));
  return map;
}

async function findBySharedAuthors(authorIds = [], excludeId, limit = 200) {
  if (!authorIds.length) return new Map();
  const rows = await Document.findAll({
    where: { deleted: false, documentId: { [Op.ne]: excludeId } },
    attributes: [
      'documentId',
      [fn('COUNT', fn('DISTINCT', col('authors.authorId'))), 'sharedAuthorCount']
    ],
    include: [{
      model: Author,
      as: 'authors',
      attributes: [],
      through: { attributes: [], where: { deleted: false } },
      where: { deleted: false, authorId: { [Op.in]: authorIds } },
      required: true
    }],
    group: ['Document.documentId'],
    order: [[col('sharedAuthorCount'), 'DESC']],
    limit,
    subQuery: false
  });
  const map = new Map();
  rows.forEach(r => map.set(r.documentId, Number(r.get('sharedAuthorCount')) || 0));
  return map;
}

async function findByPublisher(publisherId, excludeId, limit = 200) {
  if (!publisherId) return new Set();
  const rows = await Document.findAll({
    where: { deleted: false, publisherId, documentId: { [Op.ne]: excludeId } },
    attributes: ['documentId'],
    order: [['documentId', 'DESC']],
    limit
  });
  return new Set(rows.map(r => r.documentId));
}

async function findByCategory(categoryId, excludeId, limit = 200) {
  if (!categoryId) return new Set();
  const rows = await Document.findAll({
    where: { deleted: false, categoryId, documentId: { [Op.ne]: excludeId } },
    attributes: ['documentId'],
    order: [['documentId', 'DESC']],
    limit
  });
  return new Set(rows.map(r => r.documentId));
}

async function getSimilarDocumentsForReader(documentId, {
  limit = 10,
  weights = { genre: 2, author: 3, publisher: 1, category: 1 }
} = {}) {
  const seed = await getSimilarSeed(documentId);
  if (!seed) return { items: [] };

  const [byGenres, byAuthors, setPub, setCat] = await Promise.all([
    findBySharedGenres(seed.genreIds, documentId, 300),
    findBySharedAuthors(seed.authorIds, documentId, 300),
    findByPublisher(seed.publisherId, documentId, 200),
    findByCategory(seed.categoryId, documentId, 200)
  ]);

  const candidateIds = new Set([
    ...byGenres.keys(),
    ...byAuthors.keys(),
    ...setPub.values(),
    ...setCat.values()
  ]);

  if (candidateIds.size === 0) return { items: [] };

  const scored = [];
  for (const id of candidateIds) {
    const sharedGenre = byGenres.get(id) || 0;
    const sharedAuthor = byAuthors.get(id) || 0;
    const pubMatch = setPub.has(id) ? 1 : 0;
    const catMatch = setCat.has(id) ? 1 : 0;

    const score =
      sharedGenre * (weights.genre || 0) +
      sharedAuthor * (weights.author || 0) +
      pubMatch * (weights.publisher || 0) +
      catMatch * (weights.category || 0);

    const matchedBy = [];
    if (sharedGenre > 0) matchedBy.push('genre');
    if (sharedAuthor > 0) matchedBy.push('author');
    if (pubMatch) matchedBy.push('publisher');
    if (catMatch) matchedBy.push('category');

    scored.push({ id, score, matchedBy, sharedGenre, sharedAuthor, pubMatch, catMatch });
  }

  scored.sort((a, b) => (b.score - a.score) || (b.id - a.id));

  const topIds = scored.slice(0, limit).map(x => x.id);
  const whereDoc = { deleted: false, documentId: { [Op.in]: topIds } };
  const whereCat = { deleted: false };

  const rows = await Document.findAll({
    where: whereDoc,
    include: listIncludeForDocuments(whereCat),
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  const byId = new Map(rows.map(r => [r.documentId, r]));
  const items = [];
  for (const s of scored) {
    if (!topIds.includes(s.id)) continue;
    const row = byId.get(s.id);
    if (!row) continue;
    const base = mapListItem(row);
    items.push({
      ...base,
      score: s.score,
      matchedBy: s.matchedBy
    });
  }

  return { items };
}

/* =============================================================================
 *                               PUBLIC APIS
 * ========================================================================== */
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

    // TÍNH availableCopiesEffective (giữ lại)
    const ids = rows.map(r => r.documentId);
    const pendingMap = await getPendingHoldsByDocumentIds(ids);

    const items = rows.map(d => {
      const o = d.toJSON();
      const copies = Array.isArray(o.copies) ? o.copies : [];
      const available = countAvailableCopiesCaseInsensitive(copies);
      const holds = pendingMap.get(o.documentId) || 0;
      const effective = available - holds;
      return mapListItemWithEffective(d, effective);
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

const getDocumentDetailWithDeposit = async (documentId) => {
  try {
    const whereCat = { deleted: false };
    const doc = await findDocumentDetail(documentId, whereCat);
    if (!doc) return null;

    const o = doc.toJSON();
    const documentType = inferTypeFromCategoryName(o.Category?.name);

    const coverPrice = o.coverPrice || 0;
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const availableCopies = countAvailableCopiesCaseInsensitive(copies);

    // TÍNH availableCopiesEffective cho detail (giữ lại)
    const pendingHolds = await getPendingHoldsByDocumentId(o.documentId);
    const availableCopiesEffective = Math.max(0, availableCopies - pendingHolds);

    const { book, magazine, newspaper } = extractSubtypeInfo(o);

    const publisher = o.Publisher ? {
      publisherId: o.Publisher.publisherId,
      name: o.Publisher.name,
      note: o.Publisher.note ?? null
    } : null;

    // --- MỚI: tính borrowableCopies và totalBorrow cho detail ---
    const borrowableCopies = countBorrowableCopiesCaseInsensitive(copies);
    const totalBorrow = totalNumberBorrowFromCopies(copies);

    return {
      documentId: o.documentId,
      documentType,
      title: o.title,
      language: o.language,
      publicationYear: o.publicationYear,
      coverPrice: o.coverPrice,
      shelfLocation: o.shelfLocation,
      description: o.description,
      coverPhoto: o.coverPhoto,
      ebookUrl: o.ebookUrl,
      numberOfCopy: o.numberOfCopy,

      category: {
        categoryId: o.Category?.categoryId,
        name: o.Category?.name
      },
      publisher,

      book,
      magazine,
      newspaper,

      authors: normalizeAuthors(o.authors || []),
      genres: normalizeGenres(o.genres || []),
      copies: normalizeCopies(copies),
      totalCopies: copies.length,

      // Số liệu kho
      availableCopies,               // AVAILABLE (case-insensitive)
      availableCopiesEffective,      // AVAILABLE - pending holds

      // --- MỚI: thông tin mượn ---
      borrowableCopies,
      totalBorrow
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

/* =============================================================================
 *                      LATEST & POPULAR — ĐA LOẠI
 * ========================================================================== */
/**
 * Lấy tài liệu mới nhất theo loại (hoặc all).
 * Mặc định sắp xếp theo documentId DESC (an toàn cho mọi loại).
 */
async function getLatestDocuments({ page = 1, limit = 10, documentType = 'all' } = {}) {
  const offset = (page - 1) * limit;

  const whereDoc = { deleted: false };
  const whereCat = buildCategoryWhere(documentType);

  const totalItems = await Document.count({
    where: whereDoc,
    include: [{ model: Category, attributes: [], where: whereCat, required: true }],
    distinct: true, col: 'documentId'
  });

  const rows = await Document.findAll({
    where: whereDoc,
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    include: listIncludeForDocuments(whereCat),
    order: [['documentId', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false
  });

  const ids = rows.map(r => r.documentId);
  const pendingMap = await getPendingHoldsByDocumentIds(ids);

  const items = rows.map(d => {
    const o = d.toJSON();
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const available = countAvailableCopiesCaseInsensitive(copies);
    const holds = pendingMap.get(o.documentId) || 0;
    return mapListItemWithEffective(d, available - holds);
  });

  const totalPages = Math.ceil(totalItems / limit);
  return {
    items, currentPage: page, totalPages, totalItems, limit,
    hasNextPage: page < totalPages, hasPrevPage: page > 1
  };
}

/**
 * Lấy tài liệu ưa chuộng nhất theo loại (hoặc all) — tổng số lượt mượn của các bản sao.
 */
async function getPopularDocuments({ page = 1, limit = 10, documentType = 'all' } = {}) {
  const offset = (page - 1) * limit;

  const whereDoc = { deleted: false };
  const whereCat = buildCategoryWhere(documentType);

  // Tổng số items cho phân trang
  const totalItems = await Document.count({
    where: whereDoc,
    include: [{ model: Category, attributes: [], where: whereCat, required: true }],
    distinct: true, col: 'documentId'
  });

  // Xếp hạng theo tổng numberBorrow (LEFT JOIN để tài liệu chưa có copy vẫn tính 0)
  const rankRows = await Document.findAll({
    where: whereDoc,
    attributes: [
      'documentId',
      [fn('COALESCE', fn('SUM', col('copies.numberBorrow')), 0), 'totalBorrow']
    ],
    include: [
      {
        model: Category,
        attributes: [],
        where: whereCat,
        required: true
      },
      {
        model: DocumentCopy,
        as: 'copies',
        attributes: [],
        where: { deleted: false },
        required: false
      }
    ],
    group: ['Document.documentId'],
    order: [[literal('totalBorrow'), 'DESC'], ['documentId', 'DESC']],
    limit,
    offset,
    subQuery: false
  });

  if (!rankRows.length) {
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

  const topIds = rankRows.map(r => r.documentId);

  // Lấy lại detail theo include chuẩn (có copies tách riêng để tính tồn kho/effective)
  const detailRows = await Document.findAll({
    where: { deleted: false, documentId: { [Op.in]: topIds } },
    include: listIncludeForDocuments(whereCat),
    attributes: ['documentId', 'title', 'coverPhoto', 'coverPrice', 'categoryId', 'shelfLocation'],
    order: [['documentId', 'DESC']],
    distinct: true,
    subQuery: false
  });

  const byId = new Map(detailRows.map(r => [r.documentId, r]));
  const pendingMap = await getPendingHoldsByDocumentIds(topIds);

  const items = rankRows.map(r => {
    const row = byId.get(r.documentId);
    if (!row) return null;

    const o = row.toJSON();
    const copies = Array.isArray(o.copies) ? o.copies : [];
    const available = countAvailableCopiesCaseInsensitive(copies);
    const holds = pendingMap.get(o.documentId) || 0;
    const effective = available - holds;

    // totalBorrow từ SQL rankRows (ổn định hơn khi DB giàu dữ liệu)
    const totalBorrowSql = Number(r.get('totalBorrow') || 0);

    const base = mapListItemWithEffective(row, effective);

    // Ghi đè/ổn định totalBorrow với giá trị SQL (nếu bạn muốn luôn dùng tổng từ copies, có thể đổi)
    return {
      ...base,
      totalBorrow: totalBorrowSql
    };
  }).filter(Boolean);

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

/* =============================================================================
 *                                  EXPORTS
 * ========================================================================== */
module.exports = {
  // Public list/detail APIs
  getAllDocumentsWithDepositInfo,
  getDocumentDetailWithDeposit,

  // Small helpers APIs
  getEbookUrlByDocumentId,
  getGenre,

  // Genre-based list API
  getDocumentsByGenre,

  // Universal search API
  searchDocumentsUniversal,

  // Recommender API
  getSimilarDocumentsForReader,

  getLatestDocuments,
  getPopularDocuments,
};
