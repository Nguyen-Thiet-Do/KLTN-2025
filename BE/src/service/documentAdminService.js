// ================================
// File: /service/documentAdminService.js (Optimized - full info + genres)
// ================================

const {
  Document, Category, Publisher,
  Author, DocumentAuthorMap,
  Book, Magazine, Newspaper, DocumentCopy,
  Genre, DocumentGenreMap
} = require('../model');
const sequelize = require('../config/database');
const { Op, QueryTypes } = require('sequelize');

// Nếu dùng upload file: service R2 (đã có trong dự án của bạn)
const { uploadCover, uploadEbook } = require('./r2Service');

// ========= Cấu hình URL public cho proxy stream (sửa theo domain của bạn) =========
const PUBLIC_FILES_BASE = process.env.PUBLIC_FILES_BASE || 'https://kltn-2025-ehsx.onrender.com/api/files';
function keyToPublicUrl(key) {
  // key: "covers/xxx.webp" | "ebooks/yyy.pdf"
  const [folder, file] = String(key || '').split('/');
  if (!folder || !file) return null;
  if (folder === 'covers') return `${PUBLIC_FILES_BASE}/covers/${file}`;
  if (folder === 'ebooks') return `${PUBLIC_FILES_BASE}/ebooks/${file}`;
  return null;
}

// Nhãn category để map sang type (đa ngôn ngữ)
const TYPE_LABELS = {
  book: ['Sách', 'Sach', 'book'],
  magazine: ['Tạp chí', 'Tap chí', 'Tap chi', 'magazine'],
  newspaper: ['Báo', 'Bao', 'newspaper']
};

/**
 * Cache map categoryId cho từng loại để loại bỏ JOIN Category trong truy vấn list.
 * -> Giảm chi phí COUNT/LIST rất nhiều.
 */
const CATEGORY_ID_CACHE = { last: 0, map: null };
async function getCategoryMapCached() {
  const now = Date.now();
  if (CATEGORY_ID_CACHE.map && (now - CATEGORY_ID_CACHE.last < 5 * 60 * 1000)) {
    return CATEGORY_ID_CACHE.map;
  }
  const rows = await Category.findAll({ where: { deleted: false }, attributes: ['categoryId', 'name'] });
  const map = { book: [], magazine: [], newspaper: [], all: [] };
  for (const r of rows) {
    map.all.push(r.categoryId);
    const n = r.name;
    if (TYPE_LABELS.book.includes(n)) map.book.push(r.categoryId);
    if (TYPE_LABELS.magazine.includes(n)) map.magazine.push(r.categoryId);
    if (TYPE_LABELS.newspaper.includes(n)) map.newspaper.push(r.categoryId);
  }
  CATEGORY_ID_CACHE.last = now;
  CATEGORY_ID_CACHE.map = map;
  return map;
}

function buildDocumentWhereBase(categoryIds) {
  return { deleted: false, categoryId: { [Op.in]: categoryIds } };
}

function toNumberOrNull(x) {
  const v = parseFloat(x);
  return Number.isNaN(v) ? null : v;
}

// -------------------- Authors helpers --------------------
function normalizeAuthorsFromMaps(maps = []) {
  const arr = [...maps].sort((a, b) => (a.ord ?? 1) - (b.ord ?? 1));
  return arr.map(m => ({
    authorId: m.Author.authorId,
    fullName: m.Author.fullName,
    role: m.role ?? 'main',
    ord: m.ord ?? 1
  }));
}

function normalizeAuthorsFromDocAuthors(authors = []) {
  const arr = [...authors].sort(
    (a, b) => (a.DocumentAuthorMap?.ord ?? 1) - (b.DocumentAuthorMap?.ord ?? 1)
  );
  return arr.map(a => ({
    authorId: a.authorId,
    fullName: a.fullName,
    role: a.DocumentAuthorMap?.role ?? 'main',
    ord: a.DocumentAuthorMap?.ord ?? 1
  }));
}

// -------------------- Genres helpers --------------------
function normalizeGenresFromMaps(maps = []) {
  // maps: [{ Genre: { genreId, name } }]
  const seen = new Set();
  const out = [];
  for (const m of maps) {
    if (!m.Genre) continue;
    const key = m.Genre.genreId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ genreId: m.Genre.genreId, name: m.Genre.name });
  }
  return out;
}

function normalizeGenresFromDocGenres(genres = []) {
  // genres: many-to-many alias 'genres'
  const seen = new Set();
  const out = [];
  for (const g of genres) {
    if (seen.has(g.genreId)) continue;
    seen.add(g.genreId);
    out.push({ genreId: g.genreId, name: g.name });
  }
  return out;
}

function extractSubtype(o) {
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

function mapItem(row) {
  const o = row.toJSON();
  const { book, magazine, newspaper } = extractSubtype(o);
  return {
    // From Documents
    documentId: o.documentId,
    title: o.title,
    language: o.language,
    publicationYear: o.publicationYear,
    coverPrice: o.coverPrice,
    coverPhoto: o.coverPhoto,
    ebookUrl: o.ebookUrl,
    numberOfCopy: o.numberOfCopy,
    description: o.description ?? null,
    shelfLocation: o.shelfLocation ?? null,

    // Category & Publisher
    category: o.Category ? { categoryId: o.Category.categoryId, name: o.Category.name } : null,
    publisher: o.Publisher ? { publisherId: o.Publisher.publisherId, name: o.Publisher.name } : null,

    // Authors: ưu tiên many-to-many alias 'authors', fallback authorsMaps nếu có
    authors: o.authors
      ? normalizeAuthorsFromDocAuthors(o.authors)
      : normalizeAuthorsFromMaps((o.authorsMaps || []).map(m => ({ ...m, Author: m.Author }))),

    // Genres: ưu tiên alias 'genres', fallback maps nếu có
    genres: o.genres
      ? normalizeGenresFromDocGenres(o.genres)
      : normalizeGenresFromMaps((o.genresMaps || []).map(m => ({ ...m, Genre: m.Genre }))),

    // Subtype
    book,
    magazine,
    newspaper
  };
}

/* ============================================================
 *                       GET FUNCTIONS (FAST)
 *  - Two-step paging (lấy id theo trang → batch load)
 *  - Không JOIN N-N trong truy vấn phân trang
 *  - Hỗ trợ FULLTEXT hoặc LIKE fallback
 *  - Trả đủ description, shelfLocation, genres
 * ==========================================================*/

/**
 * @param {Object} opts
 * @param {'all'|'book'|'magazine'|'newspaper'} opts.documentType
 * @param {number} opts.page
 * @param {number} opts.limit
 * @param {string} opts.search
 * @param {'auto'|'fulltext'|'like'} opts.searchMode
 * @param {boolean} opts.withAuthors
 * @param {boolean} opts.withSubtype
 */
async function getBasicDocumentsByCategoryFast({
  documentType = 'all',
  page = 1,
  limit = 20,
  search = '',
  searchMode = 'auto',
  withAuthors = true,
  withSubtype = true
} = {}) {
  const offset = (page - 1) * limit;
  const catMap = await getCategoryMapCached();
  const categoryIds = catMap[documentType] || catMap.all;
  const whereBase = buildDocumentWhereBase(categoryIds);

  const useFulltextAuto = search && search.trim().length >= 2;
  const useFulltext = (searchMode === 'fulltext') || (searchMode === 'auto' && useFulltextAuto);

  let ids = [], totalItems = 0;

  if (useFulltext) {
    // Dùng FULLTEXT: tận dụng index ft_documents_title_desc_lang
    const q = search.trim().split(/\s+/).map(w => `+${w}*`).join(' ');
    const list = await sequelize.query(
      `SELECT d.documentId
       FROM Documents d
       WHERE d.deleted = 0
         AND d.categoryId IN (:catIds)
         AND MATCH(d.title, d.description, d.language) AGAINST (:q IN BOOLEAN MODE)
       ORDER BY d.documentId DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { catIds: categoryIds, q, limit, offset }, type: QueryTypes.SELECT }
    );

    const countRows = await sequelize.query(
      `SELECT COUNT(*) AS total
         FROM Documents d
        WHERE d.deleted = 0
          AND d.categoryId IN (:catIds)
          AND MATCH(d.title, d.description, d.language) AGAINST (:q IN BOOLEAN MODE)`,
      { replacements: { catIds: categoryIds, q }, type: QueryTypes.SELECT }
    );

    ids = list.map(r => r.documentId);
    totalItems = Number((countRows?.[0]?.total) || 0);
  } else {
    // LIKE fallback (sử dụng index BTREE trên title nếu có; với %...% sẽ kém hơn)
    const where = search
      ? { ...whereBase, title: { [Op.like]: `%${search}%` } }
      : whereBase;

    totalItems = await Document.count({ where });

    const docs = await Document.findAll({
      where,
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title',
        'language', 'publicationYear', 'coverPrice',
        'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation' // <-- thêm
      ],
      include: [
        // Publisher không nở dòng → có thể include ngay ở pha 1
        { model: Publisher, attributes: ['publisherId', 'name'], required: false, where: { deleted: false } }
      ],
      order: [['documentId', 'DESC']],
      limit, offset
    });
    ids = docs.map(d => d.documentId);
  }

  if (ids.length === 0) {
    return {
      items: [], currentPage: page, totalPages: 0, totalItems: 0,
      limit, hasNextPage: false, hasPrevPage: false
    };
  }

  // === Pha 2: batch load các phần còn lại để ghép dữ liệu trả về ===
  const promises = [
    Document.findAll({
      where: { documentId: { [Op.in]: ids } },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation' // <-- thêm
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'], required: false },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false }
      ]
    })
  ];

  // LẤY AUTHORS 2 BƯỚC (không eager load Author từ DocumentAuthorMap để tránh lỗi association)
  if (withAuthors) {
    promises.push(
      DocumentAuthorMap.findAll({
        where: { documentId: { [Op.in]: ids }, deleted: false },
        attributes: ['documentId', 'authorId', 'role', 'ord']
      })
    );
    // Giữ chỗ cho destructuring đồng nhất
    promises.push(Promise.resolve([]));
  } else {
    promises.push(Promise.resolve([]), Promise.resolve([]));
  }

  // Subtype cho đủ
  if (withSubtype) {
    promises.push(
      Book.findAll({ where: { documentId: { [Op.in]: ids }, deleted: false }, attributes: ['documentId', 'isbn', 'edition', 'pageCount'] }),
      Magazine.findAll({ where: { documentId: { [Op.in]: ids }, deleted: false }, attributes: ['documentId', 'issn', 'volume', 'issue', 'period', 'coverDate'] }),
      Newspaper.findAll({ where: { documentId: { [Op.in]: ids }, deleted: false }, attributes: ['documentId', 'issn', 'issueDate', 'issueNumber'] })
    );
  } else {
    promises.push(Promise.resolve([]), Promise.resolve([]), Promise.resolve([]));
  }

  // Genres: luôn lấy để trả đủ bộ (nhẹ)
  promises.push(
    DocumentGenreMap.findAll({
      where: { documentId: { [Op.in]: ids }, deleted: false },
      attributes: ['documentId', 'genreId']
    })
  );

  const [docsFull, authorMapsOnly, _authorRowsPlaceholder, books, magazines, newspapers, genreMapsOnly] = await Promise.all(promises);

  // Gắn Author vào map theo documentId (truy vấn Author 1 lần)
  let authorsByDoc = {};
  if (withAuthors) {
    const authorIds = [...new Set(authorMapsOnly.map(m => m.authorId))];
    const authorRows = authorIds.length
      ? await Author.findAll({
        where: { authorId: { [Op.in]: authorIds }, deleted: false },
        attributes: ['authorId', 'fullName']
      })
      : [];
    const authorById = new Map(authorRows.map(a => [a.authorId, a]));
    for (const m of authorMapsOnly) {
      const a = authorById.get(m.authorId);
      if (!a) continue;
      (authorsByDoc[m.documentId] ||= []).push({ Author: a, role: m.role, ord: m.ord });
    }
  }

  // Gắn Genres vào map theo documentId (truy vấn Genre 1 lần)
  let genresByDoc = {};
  {
    const genreIds = [...new Set((genreMapsOnly || []).map(m => m.genreId))];
    const genreRows = genreIds.length
      ? await Genre.findAll({ where: { genreId: { [Op.in]: genreIds }, deleted: false }, attributes: ['genreId', 'name'] })
      : [];
    const gById = new Map(genreRows.map(g => [g.genreId, g]));
    for (const m of (genreMapsOnly || [])) {
      const g = gById.get(m.genreId);
      if (!g) continue;
      (genresByDoc[m.documentId] ||= []).push({ Genre: g });
    }
  }

  const byId = new Map(docsFull.map(d => [d.documentId, d.toJSON()]));

  const bookByDoc = withSubtype ? Object.fromEntries(books.map(x => [x.documentId, { isbn: x.isbn, edition: x.edition, pageCount: x.pageCount }])) : {};
  const magByDoc = withSubtype ? Object.fromEntries(magazines.map(x => [x.documentId, { issn: x.issn, volume: x.volume, issue: x.issue, period: x.period, coverDate: x.coverDate }])) : {};
  const newsByDoc = withSubtype ? Object.fromEntries(newspapers.map(x => [x.documentId, { issn: x.issn, issueDate: x.issueDate, issueNumber: x.issueNumber }])) : {};

  const items = ids.map(id => {
    const o = byId.get(id); if (!o) return null;
    const authors = withAuthors ? normalizeAuthorsFromMaps(authorsByDoc[id] || []) : [];
    const genres = normalizeGenresFromMaps(genresByDoc[id] || []);
    return {
      documentId: o.documentId,
      title: o.title,
      language: o.language,
      publicationYear: o.publicationYear,
      coverPrice: o.coverPrice,
      coverPhoto: o.coverPhoto,
      ebookUrl: o.ebookUrl,
      numberOfCopy: o.numberOfCopy,
      description: o.description ?? null,
      shelfLocation: o.shelfLocation ?? null,
      category: o.Category ? { categoryId: o.Category.categoryId, name: o.Category.name } : null,
      publisher: o.Publisher ? { publisherId: o.Publisher.publisherId, name: o.Publisher.name } : null,
      authors,
      genres,
      book: withSubtype ? (bookByDoc[id] || null) : null,
      magazine: withSubtype ? (magByDoc[id] || null) : null,
      newspaper: withSubtype ? (newsByDoc[id] || null) : null
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

/** Shortcut helpers (FAST) */
const getBooksBasic = (opts = {}) => getBasicDocumentsByCategoryFast({ ...opts, documentType: 'book' });
const getMagazinesBasic = (opts = {}) => getBasicDocumentsByCategoryFast({ ...opts, documentType: 'magazine' });
const getNewspapersBasic = (opts = {}) => getBasicDocumentsByCategoryFast({ ...opts, documentType: 'newspaper' });

/* ============================================================
 *                       COPIES (NO DEPOSIT)
 * ==========================================================*/

async function getDocumentCopies(documentId, { status } = {}) {
  const doc = await Document.findOne({
    where: { documentId, deleted: false },
    attributes: ['documentId']
  });
  if (!doc) return null;

  // Lấy tất cả copies (không phân trang theo yêu cầu)
  const whereCopies = { deleted: false, documentId };
  if (status) whereCopies.status = status;

  const copies = await DocumentCopy.findAll({
    where: whereCopies,
    attributes: ['documentCopyId', 'barCode', 'status', 'conditionNote', 'entryDate'],
    order: [['documentCopyId', 'ASC']]
  });

  return {
    documentId: doc.documentId,
    copies
  };
}

/* ============================================================
 *                       CREATE HELPERS (BULK)
 * ==========================================================*/

// Chuẩn hoá type -> lấy categoryId
async function resolveCategoryIdOrThrow(documentType) {
  const catMap = await getCategoryMapCached();
  const theIds = catMap[documentType];
  const ids = theIds;
  if (!ids || ids.length === 0) throw new Error(`Category cho loại "${documentType}" chưa tồn tại trong DB`);
  return Math.min(...ids);
}

async function ensurePublisher(publisherName, t) {
  if (!publisherName) return null;
  const name = String(publisherName).trim();
  if (!name) return null;

  const found = await Publisher.findOne({ where: { name }, transaction: t, lock: t.LOCK.UPDATE });
  if (found) {
    if (found.deleted) await found.update({ deleted: false }, { transaction: t });
    return found;
  }
  return await Publisher.create({ name, deleted: false }, { transaction: t });
}

async function ensureGenres(genreNames = [], t) {
  if (!Array.isArray(genreNames) || genreNames.length === 0) return [];
  const names = [...new Set(genreNames.map(s => String(s).trim()).filter(Boolean))];

  const existed = await Genre.findAll({ where: { name: { [Op.in]: names } }, transaction: t, lock: t.LOCK.UPDATE });
  const existedByName = new Map(existed.map(g => [g.name, g]));

  const toCreate = names.filter(n => !existedByName.has(n)).map(n => ({ name: n, deleted: false }));
  if (toCreate.length) {
    await Genre.bulkCreate(toCreate, { transaction: t, ignoreDuplicates: true });
  }

  const allAfter = await Genre.findAll({ where: { name: { [Op.in]: names } }, transaction: t });
  const toUndeleteIds = allAfter.filter(g => g.deleted).map(g => g.genreId);
  if (toUndeleteIds.length) {
    await Genre.update({ deleted: false }, { where: { genreId: { [Op.in]: toUndeleteIds } }, transaction: t });
  }

  return await Genre.findAll({ where: { name: { [Op.in]: names } }, transaction: t });
}

async function ensureAuthors(authorInputs = [], t) {
  if (!Array.isArray(authorInputs) || authorInputs.length === 0) return [];
  // Chuẩn hóa input + dedupe theo (fullName, role, ord)
  const uniq = [];
  const seen = new Set();
  for (const a of authorInputs) {
    const fullName = String(a.fullName || '').trim();
    if (!fullName) continue;
    const role = a.role || 'main';
    const ord = Number.isFinite(+a.ord) ? +a.ord : 1;
    const key = `${fullName}::${role}::${ord}`;
    if (!seen.has(key)) { seen.add(key); uniq.push({ fullName, role, ord }); }
  }

  const names = [...new Set(uniq.map(u => u.fullName))];
  const existed = await Author.findAll({ where: { fullName: { [Op.in]: names } }, transaction: t, lock: t.LOCK.UPDATE });
  const existedByName = new Map(existed.map(a => [a.fullName, a]));

  const toCreate = names.filter(n => !existedByName.has(n)).map(n => ({ fullName: n, deleted: false }));
  if (toCreate.length) {
    await Author.bulkCreate(toCreate, { transaction: t, ignoreDuplicates: true });
  }

  const allAfter = await Author.findAll({ where: { fullName: { [Op.in]: names } }, transaction: t });
  const toUndeleteIds = allAfter.filter(a => a.deleted).map(a => a.authorId);
  if (toUndeleteIds.length) {
    await Author.update({ deleted: false }, { where: { authorId: { [Op.in]: toUndeleteIds } }, transaction: t });
  }

  const finalAuthors = await Author.findAll({ where: { fullName: { [Op.in]: names } }, transaction: t });
  const byName = new Map(finalAuthors.map(a => [a.fullName, a]));
  return uniq.map(u => ({ author: byName.get(u.fullName), role: u.role, ord: u.ord }));
}

async function bulkUpsertDocAuthorMap(documentId, authorTriples, t) {
  if (!authorTriples.length) return;
  const rows = authorTriples.map(a => ({ documentId, authorId: a.author.authorId, role: a.role || 'main', ord: a.ord || 1, deleted: false }));
  await DocumentAuthorMap.bulkCreate(rows, {
    updateOnDuplicate: ['deleted', 'role', 'ord'],
    transaction: t
  });
}

async function bulkUpsertDocGenreMap(documentId, genres, t) {
  if (!genres.length) return;
  const rows = genres.map(g => ({ documentId, genreId: g.genreId, deleted: false }));
  await DocumentGenreMap.bulkCreate(rows, {
    updateOnDuplicate: ['deleted'],
    transaction: t
  });
}

/** ===== File hoặc URL -> ra URL để lưu DB ===== */
async function ensureCoverAndEbookUrls({ coverFile, ebookFile, coverUrl, ebookViewUrl }) {
  let cover = (coverUrl || '').trim();
  let ebook = (ebookViewUrl || '').trim();

  if (!cover && coverFile) {
    const { key } = await uploadCover(coverFile);
    cover = keyToPublicUrl(key);
  }
  if (!ebook && ebookFile) {
    const { key } = await uploadEbook(ebookFile);
    ebook = keyToPublicUrl(key);
  }

  if (!cover) {
    const err = new Error('Ảnh bìa (cover) là bắt buộc: gửi file "cover" hoặc trường "coverUrl".');
    err.status = 400;
    throw err;
  }
  return { coverUrl: cover, ebookViewUrl: ebook || null };
}

/** ===== Copies helpers ===== */
function normalizeCopyInput(x = {}, idx = 0) {
  const status = (x.status || 'available').trim();
  const conditionNote = x.conditionNote != null ? String(x.conditionNote).trim() : null;
  const entryDate = x.entryDate ? new Date(x.entryDate) : new Date();
  const barCode = x.barCode ? String(x.barCode).trim() : null;
  return { barCode, status, conditionNote, entryDate, _idx: idx };
}

async function generateBarcodesIfMissing(documentId, items, t) {
  const countExisting = await DocumentCopy.count({ where: { deleted: false, documentId }, transaction: t, lock: t.LOCK.UPDATE });
  let seq = countExisting + 1;
  return items.map(it => it.barCode ? it : {
    ...it, barCode: `DOC${documentId}-${String(seq++).padStart(4, '0')}`
  });
}

async function createDocumentCopiesBulk(documentId, copies = [], t) {
  if (!Array.isArray(copies) || copies.length === 0) return [];

  const inputs = copies.map((x, i) => normalizeCopyInput(x, i));
  const withCodes = await generateBarcodesIfMissing(documentId, inputs, t);

  // Dedupe theo barCode trước khi insert
  const seen = new Set();
  const unique = [];
  for (const c of withCodes) {
    if (seen.has(c.barCode)) continue;
    seen.add(c.barCode);
    unique.push(c);
  }

  // Kiểm tra trùng barcode đã tồn tại để báo lỗi rõ ràng (thay vì ignore)
  const exists = await DocumentCopy.findAll({
    where: { barCode: { [Op.in]: unique.map(c => c.barCode) } },
    transaction: t
  });
  if (exists.length) {
    const codes = exists.map(e => e.barCode).join(', ');
    const err = new Error(`Barcode đã tồn tại: ${codes}`);
    err.status = 409;
    throw err;
  }

  // Bulk insert
  const payload = unique.map(c => ({
    documentId,
    barCode: c.barCode,
    status: c.status,
    conditionNote: c.conditionNote,
    entryDate: c.entryDate,
    deleted: false
  }));
  const created = await DocumentCopy.bulkCreate(payload, { transaction: t });

  // Cập nhật numberOfCopy không cần COUNT lại
  await Document.update(
    { numberOfCopy: sequelize.literal(`numberOfCopy + ${created.length}`) },
    { where: { documentId }, transaction: t }
  );

  return created;
}

/* ============================================================
 *                     CREATE * FUNCTIONS (Optimized)
 * ==========================================================*/

async function createBook({
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  // multipart (coverFile, ebookFile) HOẶC url (coverUrl, ebookViewUrl)
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  bookData = {},
  initialCopies = [],
  initialCopiesCount = 0
}) {
  return await sequelize.transaction(async (t) => {
    const { coverUrl: coverFinal, ebookViewUrl: ebookFinal } =
      await ensureCoverAndEbookUrls({ coverFile, ebookFile, coverUrl, ebookViewUrl });

    const categoryId = await resolveCategoryIdOrThrow('book');
    const pub = await ensurePublisher(publisherName, t);

    const doc = await Document.create({
      categoryId,
      publisherId: pub ? pub.publisherId : null,
      title, shelfLocation: shelfLocation || null,
      language: language || null,
      publicationYear: Number.isFinite(+publicationYear) ? +publicationYear : null,
      coverPrice: Number.isFinite(+coverPrice) ? +coverPrice : null,
      description: description || null,
      coverPhoto: coverFinal,
      ebookUrl: ebookFinal,
      numberOfCopy: 0,
      deleted: false
    }, { transaction: t });

    const ensuredAuthors = await ensureAuthors(authors, t);
    await bulkUpsertDocAuthorMap(doc.documentId, ensuredAuthors, t);

    const ensuredGenres = await ensureGenres(genres, t);
    await bulkUpsertDocGenreMap(doc.documentId, ensuredGenres, t);

    await Book.create({
      documentId: doc.documentId,
      isbn: bookData.isbn || null,
      edition: Number.isFinite(+bookData.edition) ? +bookData.edition : null,
      pageCount: Number.isFinite(+bookData.pageCount) ? +bookData.pageCount : null,
      deleted: false
    }, { transaction: t });

    const copiesPayload =
      Array.isArray(initialCopies) && initialCopies.length > 0
        ? initialCopies
        : (Number.isFinite(+initialCopiesCount) && +initialCopiesCount > 0
          ? Array.from({ length: +initialCopiesCount }, () => ({ status: 'available', conditionNote: '100' }))
          : []);

    await createDocumentCopiesBulk(doc.documentId, copiesPayload, t);

    // Trả kết quả đầy đủ (kèm genres)
    const full = await Document.findOne({
      where: { documentId: doc.documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author,
          as: 'authors',
          attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

async function createMagazine({
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  magazineData = {},
  initialCopies = [],
  initialCopiesCount = 0
}) {
  return await sequelize.transaction(async (t) => {
    const { coverUrl: coverFinal, ebookViewUrl: ebookFinal } =
      await ensureCoverAndEbookUrls({ coverFile, ebookFile, coverUrl, ebookViewUrl });

    const categoryId = await resolveCategoryIdOrThrow('magazine');
    const pub = await ensurePublisher(publisherName, t);

    const doc = await Document.create({
      categoryId,
      publisherId: pub ? pub.publisherId : null,
      title, shelfLocation: shelfLocation || null,
      language: language || null,
      publicationYear: Number.isFinite(+publicationYear) ? +publicationYear : null,
      coverPrice: Number.isFinite(+coverPrice) ? +coverPrice : null,
      description: description || null,
      coverPhoto: coverFinal,
      ebookUrl: ebookFinal,
      numberOfCopy: 0,
      deleted: false
    }, { transaction: t });

    const ensuredAuthors = await ensureAuthors(authors, t);
    await bulkUpsertDocAuthorMap(doc.documentId, ensuredAuthors, t);

    const ensuredGenres = await ensureGenres(genres, t);
    await bulkUpsertDocGenreMap(doc.documentId, ensuredGenres, t);

    await Magazine.create({
      documentId: doc.documentId,
      issn: magazineData.issn || null,
      volume: Number.isFinite(+magazineData.volume) ? +magazineData.volume : null,
      issue: Number.isFinite(+magazineData.issue) ? +magazineData.issue : null,
      period: magazineData.period || null,
      coverDate: magazineData.coverDate || null,
      deleted: false
    }, { transaction: t });

    const copiesPayload =
      Array.isArray(initialCopies) && initialCopies.length > 0
        ? initialCopies
        : (Number.isFinite(+initialCopiesCount) && +initialCopiesCount > 0
          ? Array.from({ length: +initialCopiesCount }, () => ({ status: 'available', conditionNote: '100' }))
          : []);

    await createDocumentCopiesBulk(doc.documentId, copiesPayload, t);

    const full = await Document.findOne({
      where: { documentId: doc.documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author,
          as: 'authors',
          attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

async function createNewspaper({
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  newspaperData = {},
  initialCopies = [],
  initialCopiesCount = 0
}) {
  return await sequelize.transaction(async (t) => {
    const { coverUrl: coverFinal, ebookViewUrl: ebookFinal } =
      await ensureCoverAndEbookUrls({ coverFile, ebookFile, coverUrl, ebookViewUrl });

    const categoryId = await resolveCategoryIdOrThrow('newspaper');
    const pub = await ensurePublisher(publisherName, t);

    const doc = await Document.create({
      categoryId,
      publisherId: pub ? pub.publisherId : null,
      title, shelfLocation: shelfLocation || null,
      language: language || null,
      publicationYear: Number.isFinite(+publicationYear) ? +publicationYear : null,
      coverPrice: Number.isFinite(+coverPrice) ? +coverPrice : null,
      description: description || null,
      coverPhoto: coverFinal,
      ebookUrl: ebookFinal,
      numberOfCopy: 0,
      deleted: false
    }, { transaction: t });

    const ensuredAuthors = await ensureAuthors(authors, t);
    await bulkUpsertDocAuthorMap(doc.documentId, ensuredAuthors, t);

    const ensuredGenres = await ensureGenres(genres, t);
    await bulkUpsertDocGenreMap(doc.documentId, ensuredGenres, t);

    await Newspaper.create({
      documentId: doc.documentId,
      issn: newspaperData.issn || null,
      issueDate: newspaperData.issueDate || null,
      issueNumber: Number.isFinite(+newspaperData.issueNumber) ? +newspaperData.issueNumber : null,
      deleted: false
    }, { transaction: t });

    const copiesPayload =
      Array.isArray(initialCopies) && initialCopies.length > 0
        ? initialCopies
        : (Number.isFinite(+initialCopiesCount) && +initialCopiesCount > 0
          ? Array.from({ length: +initialCopiesCount }, () => ({ status: 'available', conditionNote: '100' }))
          : []);

    await createDocumentCopiesBulk(doc.documentId, copiesPayload, t);

    const full = await Document.findOne({
      where: { documentId: doc.documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author,
          as: 'authors',
          attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

/** Nhập thêm bản sao sau này */
async function addCopies(documentId, copies = []) {
  return await sequelize.transaction(async (t) => {
    const doc = await Document.findOne({
      where: { documentId, deleted: false },
      attributes: ['documentId'],
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!doc) {
      const err = new Error('Document không tồn tại');
      err.status = 404;
      throw err;
    }

    const created = await createDocumentCopiesBulk(documentId, copies, t);
    const numberOfCopy = (await Document.findOne({ where: { documentId }, attributes: ['numberOfCopy'], transaction: t })).numberOfCopy;
    return { createdCount: created.length, numberOfCopy };
  });
}

async function getDocumentCopy(documentCopyId) {
  const copy = await DocumentCopy.findOne({
    where: { documentCopyId, deleted: false },
    attributes: ['documentCopyId', 'documentId', 'barCode', 'status', 'conditionNote', 'entryDate']
  });

  if (!copy) return null;

  return {
    documentCopyId: copy.documentCopyId,
    documentId: copy.documentId,
    barCode: copy.barCode,
    status: copy.status,
    conditionNote: copy.conditionNote,
    entryDate: copy.entryDate
  };
}

async function getDocumentCopyAndDoc(documentCopyId, { withAuthors = true, withSubtype = true } = {}) {
  // 1) Lấy bản sao và documentId
  const copy = await DocumentCopy.findOne({
    where: { documentCopyId, deleted: false },
    attributes: ['documentCopyId', 'documentId', 'barCode', 'status', 'conditionNote', 'entryDate'],
    include: [{
      model: Document,
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [{
        model: Category,
        attributes: ['categoryId', 'name'],
        where: { deleted: false },
        required: true
      }, {
        model: Publisher,
        attributes: ['publisherId', 'name'],
        required: false
      }],
      required: true
    }]
  });
  if (!copy) return null;

  // 2) (Tuỳ chọn) lấy thêm authors, genres và subtype
  let documentFull = null;
  if (withAuthors || withSubtype) {
    documentFull = await Document.findOne({
      where: { documentId: copy.documentId, deleted: false },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'], required: false },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        withAuthors ? {
          model: Author,
          as: 'authors',
          attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false },
          required: false
        } : null,
        {
          model: Genre,
          as: 'genres',
          attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false },
          required: false
        },
        withSubtype ? { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'], required: false } : null,
        withSubtype ? { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'], required: false } : null,
        withSubtype ? { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'], required: false } : null
      ].filter(Boolean)
    });
  } else {
    documentFull = copy.Document;
  }

  const documentBasic = mapItem(documentFull);

  // 3) Trả kết quả
  return {
    copy: {
      documentCopyId: copy.documentCopyId,
      documentId: copy.documentId,
      barCode: copy.barCode,
      status: copy.status,
      conditionNote: copy.conditionNote,
      entryDate: copy.entryDate,
      category: copy.Document?.Category
        ? { categoryId: copy.Document.Category.categoryId, name: copy.Document.Category.name }
        : null
    },
    document: documentBasic
  };
}

// =================== UPDATE HELPERS ===================

function mergeDefined(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v !== undefined) target[k] = v;
  }
  return target;
}

async function ensureCoverAndEbookUrlsForUpdate({
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  currentCoverUrl, currentEbookUrl
}) {
  let cover = coverUrl !== undefined ? String(coverUrl || '').trim() : undefined;
  let ebook = ebookViewUrl !== undefined ? String(ebookViewUrl || '').trim() : undefined;

  if (cover === undefined && coverFile) {
    const { key } = await uploadCover(coverFile);
    cover = keyToPublicUrl(key);
  }
  if (ebook === undefined && ebookFile) {
    const { key } = await uploadEbook(ebookFile);
    ebook = keyToPublicUrl(key);
  }

  return {
    coverUrl: cover === undefined ? currentCoverUrl : (cover || null),
    ebookViewUrl: ebook === undefined ? currentEbookUrl : (ebook || null)
  };
}

async function replaceDocAuthorMap(documentId, authorInputs = [], t) {
  if (authorInputs === undefined) return;
  await DocumentAuthorMap.update(
    { deleted: true },
    { where: { documentId }, transaction: t }
  );
  if (!authorInputs || authorInputs.length === 0) return;

  const ensured = await ensureAuthors(authorInputs, t);
  const rows = ensured.map(a => ({
    documentId,
    authorId: a.author.authorId,
    role: a.role || 'main',
    ord: a.ord || 1,
    deleted: false
  }));

  await DocumentAuthorMap.bulkCreate(rows, {
    updateOnDuplicate: ['deleted', 'role', 'ord'],
    transaction: t
  });
}

async function replaceDocGenreMap(documentId, genreNames, t) {
  if (genreNames === undefined) return;

  await DocumentGenreMap.update(
    { deleted: true },
    { where: { documentId }, transaction: t }
  );

  if (!genreNames || genreNames.length === 0) return;

  const genres = await ensureGenres(genreNames, t);
  const rows = genres.map(g => ({
    documentId,
    genreId: g.genreId,
    deleted: false
  }));

  await DocumentGenreMap.bulkCreate(rows, {
    updateOnDuplicate: ['deleted'],
    transaction: t
  });
}

async function ensurePublisherForUpdate(publisherName, t) {
  if (publisherName === undefined) return undefined;
  if (!publisherName) return null; // clear
  const pub = await ensurePublisher(publisherName, t);
  return pub ? pub.publisherId : null;
}

// =================== UPDATE: BOOK ===================
async function updateBook({
  documentId,
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  bookData = {}
}) {
  if (!Number.isInteger(+documentId) || +documentId <= 0) {
    const err = new Error('documentId không hợp lệ');
    err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const doc = await Document.findOne({
      where: { documentId, deleted: false },
      include: [{ model: Book, as: 'book', required: false }],
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!doc) { const e = new Error('Document không tồn tại'); e.status = 404; throw e; }

    const fileUrls = await ensureCoverAndEbookUrlsForUpdate({
      coverFile, ebookFile, coverUrl, ebookViewUrl,
      currentCoverUrl: doc.coverPhoto,
      currentEbookUrl: doc.ebookUrl
    });

    const publisherId = await ensurePublisherForUpdate(publisherName, t);
    const docPatch = {};
    mergeDefined(docPatch, {
      title,
      shelfLocation: shelfLocation === '' ? null : shelfLocation,
      language: language === '' ? null : language,
      publicationYear: publicationYear !== undefined ? (Number.isFinite(+publicationYear) ? +publicationYear : null) : undefined,
      coverPrice: coverPrice !== undefined ? (Number.isFinite(+coverPrice) ? +coverPrice : null) : undefined,
      description: description === '' ? null : description,
      coverPhoto: fileUrls.coverUrl,
      ebookUrl: fileUrls.ebookViewUrl
    });
    if (publisherId !== undefined) mergeDefined(docPatch, { publisherId });

    if (Object.keys(docPatch).length) {
      await doc.update(docPatch, { transaction: t });
    }

    await replaceDocAuthorMap(documentId, authors, t);
    await replaceDocGenreMap(documentId, genres, t);

    const bookPatch = {};
    if (bookData !== undefined) {
      mergeDefined(bookPatch, {
        isbn: bookData.isbn === '' ? null : bookData.isbn,
        edition: bookData.edition !== undefined ? (Number.isFinite(+bookData.edition) ? +bookData.edition : null) : undefined,
        pageCount: bookData.pageCount !== undefined ? (Number.isFinite(+bookData.pageCount) ? +bookData.pageCount : null) : undefined
      });
      if (Object.keys(bookPatch).length) {
        if (doc.book) {
          await doc.book.update(bookPatch, { transaction: t });
        } else {
          await Book.create({ documentId, ...bookPatch, deleted: false }, { transaction: t });
        }
      }
    }

    const full = await Document.findOne({
      where: { documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author, as: 'authors', attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        {
          model: Genre, as: 'genres', attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

// =================== UPDATE: MAGAZINE ===================
async function updateMagazine({
  documentId,
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  magazineData = {}
}) {
  if (!Number.isInteger(+documentId) || +documentId <= 0) {
    const err = new Error('documentId không hợp lệ');
    err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const doc = await Document.findOne({
      where: { documentId, deleted: false },
      include: [{ model: Magazine, as: 'magazine', required: false }],
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!doc) { const e = new Error('Document không tồn tại'); e.status = 404; throw e; }

    const fileUrls = await ensureCoverAndEbookUrlsForUpdate({
      coverFile, ebookFile, coverUrl, ebookViewUrl,
      currentCoverUrl: doc.coverPhoto,
      currentEbookUrl: doc.ebookUrl
    });

    const publisherId = await ensurePublisherForUpdate(publisherName, t);

    const docPatch = {};
    mergeDefined(docPatch, {
      title,
      shelfLocation: shelfLocation === '' ? null : shelfLocation,
      language: language === '' ? null : language,
      publicationYear: publicationYear !== undefined ? (Number.isFinite(+publicationYear) ? +publicationYear : null) : undefined,
      coverPrice: coverPrice !== undefined ? (Number.isFinite(+coverPrice) ? +coverPrice : null) : undefined,
      description: description === '' ? null : description,
      coverPhoto: fileUrls.coverUrl,
      ebookUrl: fileUrls.ebookViewUrl
    });
    if (publisherId !== undefined) mergeDefined(docPatch, { publisherId });

    if (Object.keys(docPatch).length) {
      await doc.update(docPatch, { transaction: t });
    }

    await replaceDocAuthorMap(documentId, authors, t);
    await replaceDocGenreMap(documentId, genres, t);

    const magPatch = {};
    if (magazineData !== undefined) {
      mergeDefined(magPatch, {
        issn: magazineData.issn === '' ? null : magazineData.issn,
        volume: magazineData.volume !== undefined ? (Number.isFinite(+magazineData.volume) ? +magazineData.volume : null) : undefined,
        issue: magazineData.issue !== undefined ? (Number.isFinite(+magazineData.issue) ? +magazineData.issue : null) : undefined,
        period: magazineData.period === '' ? null : magazineData.period,
        coverDate: magazineData.coverDate === '' ? null : magazineData.coverDate
      });
      if (Object.keys(magPatch).length) {
        if (doc.magazine) {
          await doc.magazine.update(magPatch, { transaction: t });
        } else {
          await Magazine.create({ documentId, ...magPatch, deleted: false }, { transaction: t });
        }
      }
    }

    const full = await Document.findOne({
      where: { documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author, as: 'authors', attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        {
          model: Genre, as: 'genres', attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

// =================== UPDATE: NEWSPAPER ===================
async function updateNewspaper({
  documentId,
  title, language, publicationYear, coverPrice, description, shelfLocation,
  publisherName, authors, genres,
  coverFile, ebookFile, coverUrl, ebookViewUrl,
  newspaperData = {}
}) {
  if (!Number.isInteger(+documentId) || +documentId <= 0) {
    const err = new Error('documentId không hợp lệ');
    err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const doc = await Document.findOne({
      where: { documentId, deleted: false },
      include: [{ model: Newspaper, as: 'newspaper', required: false }],
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!doc) { const e = new Error('Document không tồn tại'); e.status = 404; throw e; }

    const fileUrls = await ensureCoverAndEbookUrlsForUpdate({
      coverFile, ebookFile, coverUrl, ebookViewUrl,
      currentCoverUrl: doc.coverPhoto,
      currentEbookUrl: doc.ebookUrl
    });

    const publisherId = await ensurePublisherForUpdate(publisherName, t);

    const docPatch = {};
    mergeDefined(docPatch, {
      title,
      shelfLocation: shelfLocation === '' ? null : shelfLocation,
      language: language === '' ? null : language,
      publicationYear: publicationYear !== undefined ? (Number.isFinite(+publicationYear) ? +publicationYear : null) : undefined,
      coverPrice: coverPrice !== undefined ? (Number.isFinite(+coverPrice) ? +coverPrice : null) : undefined,
      description: description === '' ? null : description,
      coverPhoto: fileUrls.coverUrl,
      ebookUrl: fileUrls.ebookViewUrl
    });
    if (publisherId !== undefined) mergeDefined(docPatch, { publisherId });

    if (Object.keys(docPatch).length) {
      await doc.update(docPatch, { transaction: t });
    }

    await replaceDocAuthorMap(documentId, authors, t);
    await replaceDocGenreMap(documentId, genres, t);

    const newsPatch = {};
    if (newspaperData !== undefined) {
      mergeDefined(newsPatch, {
        issn: newspaperData.issn === '' ? null : newspaperData.issn,
        issueDate: newspaperData.issueDate === '' ? null : newspaperData.issueDate,
        issueNumber: newspaperData.issueNumber !== undefined
          ? (Number.isFinite(+newspaperData.issueNumber) ? +newspaperData.issueNumber : null)
          : undefined
      });
      if (Object.keys(newsPatch).length) {
        if (doc.newspaper) {
          await doc.newspaper.update(newsPatch, { transaction: t });
        } else {
          await Newspaper.create({ documentId, ...newsPatch, deleted: false }, { transaction: t });
        }
      }
    }

    const full = await Document.findOne({
      where: { documentId },
      attributes: [
        'documentId', 'categoryId', 'publisherId', 'title', 'language',
        'publicationYear', 'coverPrice', 'coverPhoto', 'ebookUrl', 'numberOfCopy',
        'description', 'shelfLocation'
      ],
      include: [
        { model: Category, attributes: ['categoryId', 'name'] },
        { model: Publisher, attributes: ['publisherId', 'name'], required: false },
        {
          model: Author, as: 'authors', attributes: ['authorId', 'fullName'],
          through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        {
          model: Genre, as: 'genres', attributes: ['genreId', 'name'],
          through: { model: DocumentGenreMap, attributes: [], where: { deleted: false } },
          where: { deleted: false }, required: false
        },
        { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'] }
      ],
      transaction: t
    });

    return mapItem(full);
  });
}

async function recalcNumberOfCopy(documentId, t) {
  const active = await DocumentCopy.count({
    where: { documentId, deleted: false }, transaction: t
  });
  await Document.update(
    { numberOfCopy: active },
    { where: { documentId }, transaction: t }
  );
  return active;
}

// ======================== SOFT DELETE: CONSTANTS & HELPERS ========================

const BLOCKED_COPY_STATUSES = new Set([
  'borrowed',        // đang mượn
  'reserved',        // đã đặt chỗ
  'overdue',         // quá hạn
  'lost_processing'  // đang xử lý mất sách / tranh chấp
]);

const ALLOWED_COPY_DELETE_STATUSES = new Set([
  'available',         // sẵn sàng
  'maintenance_ok'     // bảo trì xong (tuỳ hệ thống)
]);

/**
 * Kiểm tra điều kiện để xoá mềm 1 Document.
 * - Nếu còn copies active và không bật cascadeCopies => chặn
 * - Nếu bật cascadeCopies, cấm khi tồn tại copy ở trạng thái blocked
 */
async function assertDeletableDocument(documentId, { cascadeCopies }, t) {
  const allActiveCount = await DocumentCopy.count({
    where: { documentId, deleted: false },
    transaction: t
  });

  if (allActiveCount > 0 && !cascadeCopies) {
    const err = new Error('Không thể xóa: tài liệu còn bản sao đang tồn tại. Bật cascadeCopies=1 nếu muốn xóa mềm toàn bộ bản sao.');
    err.status = 409; throw err;
  }

  if (allActiveCount > 0) {
    const blockedOne = await DocumentCopy.findOne({
      where: {
        documentId,
        deleted: false,
        status: { [Op.in]: Array.from(BLOCKED_COPY_STATUSES) }
      },
      attributes: ['documentCopyId', 'status', 'barCode'],
      transaction: t
    });
    if (blockedOne) {
      const err = new Error(`Không thể xóa: có bản sao đang ở trạng thái "${blockedOne.status}" (barCode=${blockedOne.barCode}). Hãy thu hồi/hoàn tất giao dịch trước.`);
      err.status = 409; throw err;
    }
  }
}

/**
 * Kiểm tra điều kiện để xoá mềm 1 Copy.
 * - Chỉ cho phép xoá khi status nằm trong whitelist (vd: available)
 */
async function assertDeletableCopy(copy, t) {
  if (copy.deleted) return;
  const status = String(copy.status || '').trim().toLowerCase();
  if (!ALLOWED_COPY_DELETE_STATUSES.has(status)) {
    const err = new Error(`Không thể xóa bản sao: trạng thái hiện tại "${copy.status}" không cho phép xóa.`);
    err.status = 409; throw err;
  }
}

// ======================== SOFT DELETE: SERVICES ========================

async function softDeleteDocument(documentId, {
  cascadeSubtype = true,
  cascadeCopies = false,
  cascadeMaps = false
} = {}) {
  if (!Number.isInteger(+documentId) || +documentId <= 0) {
    const err = new Error('documentId không hợp lệ'); err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const doc = await Document.findOne({
      where: { documentId }, transaction: t, lock: t.LOCK.UPDATE,
      include: [
        { model: Book, as: 'book', required: false },
        { model: Magazine, as: 'magazine', required: false },
        { model: Newspaper, as: 'newspaper', required: false }
      ]
    });
    if (!doc) { const e = new Error('Document không tồn tại'); e.status = 404; throw e; }

    await assertDeletableDocument(documentId, { cascadeCopies }, t);

    if (!doc.deleted) {
      await doc.update({ deleted: true }, { transaction: t });
    }

    if (cascadeSubtype) {
      if (doc.book && !doc.book.deleted) await doc.book.update({ deleted: true }, { transaction: t });
      if (doc.magazine && !doc.magazine.deleted) await doc.magazine.update({ deleted: true }, { transaction: t });
      if (doc.newspaper && !doc.newspaper.deleted) await doc.newspaper.update({ deleted: true }, { transaction: t });
    }

    let affectedCopies = 0;
    if (cascadeCopies) {
      const result = await DocumentCopy.update(
        { deleted: true },
        { where: { documentId, deleted: false }, transaction: t }
      );
      affectedCopies = Array.isArray(result) ? result[0] : result;
      await recalcNumberOfCopy(documentId, t);
    }

    if (cascadeMaps) {
      await DocumentAuthorMap.update(
        { deleted: true },
        { where: { documentId, deleted: false }, transaction: t }
      );
      await DocumentGenreMap.update(
        { deleted: true },
        { where: { documentId, deleted: false }, transaction: t }
      );
    }

    return {
      ok: true,
      documentId,
      deleted: true,
      cascade: { subtype: cascadeSubtype, copies: cascadeCopies, maps: cascadeMaps },
      affectedCopies
    };
  });
}

async function softDeleteCopy(documentCopyId) {
  if (!Number.isInteger(+documentCopyId) || +documentCopyId <= 0) {
    const err = new Error('documentCopyId không hợp lệ'); err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const copy = await DocumentCopy.findOne({
      where: { documentCopyId }, transaction: t, lock: t.LOCK.UPDATE
    });
    if (!copy) { const e = new Error('DocumentCopy không tồn tại'); e.status = 404; throw e; }

    await assertDeletableCopy(copy, t);

    if (!copy.deleted) {
      await copy.update({ deleted: true }, { transaction: t });
      await recalcNumberOfCopy(copy.documentId, t);
    }

    return { ok: true, documentCopyId, deleted: true, documentId: copy.documentId };
  });
}

async function updateCopy(documentCopyId, {
  barCode,
  status,
  conditionNote,
  entryDate
} = {}) {
  if (!Number.isInteger(+documentCopyId) || +documentCopyId <= 0) {
    const err = new Error('documentCopyId không hợp lệ'); err.status = 400; throw err;
  }

  return await sequelize.transaction(async (t) => {
    const copy = await DocumentCopy.findOne({
      where: { documentCopyId, deleted: false },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!copy) { const e = new Error('DocumentCopy không tồn tại hoặc đã bị xoá'); e.status = 404; throw e; }

    const patch = {};

    if (barCode !== undefined) {
      const nextCode = barCode ? String(barCode).trim().toUpperCase() : null;
      if (!nextCode) {
        const e = new Error('barCode không được rỗng'); e.status = 400; throw e;
      }
      const dup = await DocumentCopy.findOne({
        where: {
          barCode: nextCode,
          documentCopyId: { [Op.ne]: copy.documentCopyId }
        },
        transaction: t
      });
      if (dup) {
        const e = new Error(`Barcode đã tồn tại: ${nextCode}`); e.status = 409; throw e;
      }
      patch.barCode = nextCode;
    }

    if (status !== undefined) {
      patch.status = String(status || '').trim();
      if (!patch.status) {
        const e = new Error('status không được rỗng'); e.status = 400; throw e;
      }
    }

    if (conditionNote !== undefined) {
      patch.conditionNote = conditionNote != null ? String(conditionNote).trim() : null;
    }

    if (entryDate !== undefined) {
      patch.entryDate = entryDate ? new Date(entryDate) : new Date();
      if (isNaN(patch.entryDate.getTime())) {
        const e = new Error('entryDate không hợp lệ'); e.status = 400; throw e;
      }
    }

    if (Object.keys(patch).length) {
      await copy.update(patch, { transaction: t });
    }

    const data = await getDocumentCopy(copy.documentCopyId);
    return { ok: true, data };
  });
}

module.exports = {
  // list
  getBasicDocumentsByCategoryFast,
  getBooksBasic,
  getMagazinesBasic,
  getNewspapersBasic,
  getDocumentCopies,
  getDocumentCopy,
  getDocumentCopyAndDoc,
  // create & copies
  createBook,
  createMagazine,
  createNewspaper,
  addCopies,
  // update
  updateBook,
  updateMagazine,
  updateNewspaper,
  updateCopy,
  // soft delete
  softDeleteDocument,
  softDeleteCopy
};