// src/service/documentBasicByCategoryService.js
const {
    Document, Category, Publisher,
    Author, DocumentAuthorMap,
    Book, Magazine, Newspaper, DocumentCopy,
    Genre, DocumentGenreMap
} = require('../model');
const sequelize = require('../config/database');
const { Op, UniqueConstraintError } = require('sequelize');

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

// Nhãn category để map sang type (có đa ngôn ngữ)
const TYPE_LABELS = {
    book: ['Sách', 'Sach', 'book'],
    magazine: ['Tạp chí', 'Tap chí', 'Tap chi', 'magazine'],
    newspaper: ['Báo', 'Bao', 'newspaper']
};

function buildCategoryWhere(documentType = 'all') {
    const where = { deleted: false };
    if (documentType !== 'all') where.name = { [Op.in]: TYPE_LABELS[documentType] || [] };
    return where;
}

function buildDocumentWhere(search = '') {
    const where = { deleted: false };
    if (search) where.title = { [Op.like]: `%${search}%` };
    return where;
}

function normalizeAuthors(authors = []) {
    // Sắp xếp theo ord trong DocumentAuthorMap
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

        // Category & Publisher
        category: o.Category ? { categoryId: o.Category.categoryId, name: o.Category.name } : null,
        publisher: o.Publisher ? { publisherId: o.Publisher.publisherId, name: o.Publisher.name } : null,

        // Authors (đã chuẩn hoá)
        authors: normalizeAuthors(o.authors || []),

        // Subtype
        book,
        magazine,
        newspaper
    };
}

/* ============================================================
 *                       GET FUNCTIONS
 * ==========================================================*/

/**
 * Lấy danh sách thông tin cơ bản theo category (book/magazine/newspaper/all)
 */
async function getBasicDocumentsByCategory({
    documentType = 'all',
    page = 1,
    limit = 20,
    search = ''
} = {}) {
    const offset = (page - 1) * limit;

    const whereCat = buildCategoryWhere(documentType);
    const whereDoc = buildDocumentWhere(search);

    // Đếm tổng
    const totalItems = await Document.count({
        where: whereDoc,
        include: [{ model: Category, attributes: [], where: whereCat, required: true }],
        distinct: true,
        col: 'documentId'
    });

    // Lấy rows
    const rows = await Document.findAll({
        where: whereDoc,
        attributes: [
            'documentId', 'categoryId', 'publisherId', 'title',
            'language', 'publicationYear', 'coverPrice',
            'coverPhoto', 'ebookUrl', 'numberOfCopy'
        ],
        include: [
            // Category (bắt buộc)
            { model: Category, attributes: ['categoryId', 'name'], where: whereCat, required: true },

            // Publisher (tuỳ chọn)
            { model: Publisher, attributes: ['publisherId', 'name'], required: false, where: { deleted: false } },

            // Authors (N-N)
            {
                model: Author,
                as: 'authors',
                attributes: ['authorId', 'fullName'],
                through: { model: DocumentAuthorMap, attributes: ['role', 'ord'], where: { deleted: false } },
                where: { deleted: false },
                required: false
            },

            // Subtypes (tuỳ chọn)
            { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'], where: { deleted: false }, required: false },
            { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'], where: { deleted: false }, required: false },
            { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'], where: { deleted: false }, required: false }
        ],
        order: [['documentId', 'DESC']],
        limit,
        offset,
        distinct: true,
        subQuery: false
    });

    const items = rows.map(mapItem);
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

function toNumberOrNull(x) {
    const v = parseFloat(x);
    return Number.isNaN(v) ? null : v;
}

function computeDeposit({ coverPrice, depositRate, qualityPercent }) {
    const cp = Number(coverPrice) || 0;
    const dr = Number(depositRate) || 0;
    const q = Number(qualityPercent) || 0;
    if (!(cp > 0 && dr > 0 && q > 0)) return null;
    // làm tròn gần nhất để dễ hiển thị/thu tiền
    return Math.round(cp * dr * (q / 100));
}

/**
 * Lấy toàn bộ copies của một document và tính tiền cọc cho từng copy
 */
async function getDocumentCopiesWithDeposit(documentId) {
    // 1) Lấy Document + Category (để có coverPrice, deposit_rate)
    const doc = await Document.findOne({
        where: { documentId, deleted: false },
        attributes: ['documentId', 'categoryId', 'coverPrice'],
        include: [{
            model: Category,
            attributes: ['categoryId', 'name', 'deposit_rate'],
            where: { deleted: false },
            required: true
        }]
    });
    if (!doc) return null;

    const coverPrice = Number(doc.coverPrice) || 0;
    const depositRate = Number(doc.Category?.deposit_rate) || 0;

    // 2) Lấy tất cả copies (không phân trang theo yêu cầu)
    const copies = await DocumentCopy.findAll({
        where: { deleted: false, documentId },
        attributes: ['documentCopyId', 'barCode', 'status', 'conditionNote', 'entryDate'],
        order: [['documentCopyId', 'ASC']]
    });

    // 3) Tính cọc cho từng copy
    const mapped = copies.map(c => {
        const quality = toNumberOrNull(c.conditionNote); // “chất lượng” %
        const deposit = computeDeposit({ coverPrice, depositRate, qualityPercent: quality });
        return {
            documentCopyId: c.documentCopyId,
            barCode: c.barCode,
            status: c.status,
            conditionNote: c.conditionNote,
            entryDate: c.entryDate,
            deposit
        };
    });

    // 4) Tổng hợp nhanh min/max/avg (chỉ tính các copy có deposit hợp lệ)
    const deposits = mapped.map(x => x.deposit).filter(v => typeof v === 'number' && v >= 0);
    const summary = deposits.length
        ? {
            minDeposit: Math.min(...deposits),
            maxDeposit: Math.max(...deposits),
            avgDeposit: Math.round(deposits.reduce((a, b) => a + b, 0) / deposits.length)
        }
        : { minDeposit: null, maxDeposit: null, avgDeposit: null };

    return {
        documentId: doc.documentId,
        coverPrice,
        depositRate,
        copies: mapped,
        summary
    };
}

/** Shortcut helpers */
const getBooksBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'book' });
const getMagazinesBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'magazine' });
const getNewspapersBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'newspaper' });

/* ============================================================
 *                       CREATE HELPERS
 * ==========================================================*/

// Chuẩn hoá type -> where của Category (không thêm/sửa/xoá Category)
async function resolveCategoryIdOrThrow(documentType) {
    const whereCat = buildCategoryWhere(documentType);
    const cat = await Category.findOne({ where: whereCat, attributes: ['categoryId'] });
    if (!cat) {
        throw new Error(`Category cho loại "${documentType}" chưa tồn tại trong DB`);
    }
    return cat.categoryId;
}

// Tìm/khôi phục soft-delete hoặc tạo mới (Publisher/Author/Genre)
async function findOrCreateUndelete(Model, where, defaults = {}, t) {
    const found = await Model.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (found) {
        if (found.deleted) {
            await found.update({ deleted: false }, { transaction: t });
        }
        return found;
    }
    return await Model.create({ ...where, ...defaults, deleted: false }, { transaction: t });
}

async function ensureGenres(genreNames = [], t) {
    if (!Array.isArray(genreNames) || genreNames.length === 0) return [];
    const names = [...new Set(genreNames.map(s => String(s).trim()).filter(Boolean))];
    const out = [];
    for (const name of names) {
        const g = await findOrCreateUndelete(Genre, { name }, {}, t);
        out.push(g);
    }
    return out;
}

async function ensureAuthors(authorInputs = [], t) {
    if (!Array.isArray(authorInputs) || authorInputs.length === 0) return [];
    const uniq = [];
    const seen = new Set();
    for (const a of authorInputs) {
        const fullName = String(a.fullName || '').trim();
        if (!fullName) continue;
        const role = a.role || 'main';
        const ord = Number.isFinite(+a.ord) ? +a.ord : 1;
        const key = `${fullName}::${role}::${ord}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniq.push({ fullName, role, ord });
        }
    }
    const out = [];
    for (const u of uniq) {
        const rec = await findOrCreateUndelete(Author, { fullName: u.fullName }, {}, t);
        out.push({ author: rec, role: u.role, ord: u.ord });
    }
    return out;
}

async function ensurePublisher(publisherName, t) {
    if (!publisherName) return null;
    const name = String(publisherName).trim();
    if (!name) return null;
    return await findOrCreateUndelete(Publisher, { name }, {}, t);
}

async function upsertDocAuthorMap(documentId, authorId, role = 'main', ord = 1, t) {
    const where = { documentId, authorId };
    const ex = await DocumentAuthorMap.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (ex) {
        await ex.update({ deleted: false, role, ord }, { transaction: t });
    } else {
        await DocumentAuthorMap.create({ ...where, role, ord, deleted: false }, { transaction: t });
    }
}
async function upsertDocGenreMap(documentId, genreId, t) {
    const where = { documentId, genreId };
    const ex = await DocumentGenreMap.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (ex) {
        await ex.update({ deleted: false }, { transaction: t });
    } else {
        await DocumentGenreMap.create({ ...where, deleted: false }, { transaction: t });
    }
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
    const conditionNote = x.conditionNote != null ? String(x.conditionNote).trim() : null; // ví dụ "100"
    const entryDate = x.entryDate ? new Date(x.entryDate) : new Date();
    const barCode = x.barCode ? String(x.barCode).trim() : null;
    return { barCode, status, conditionNote, entryDate, _idx: idx };
}
async function generateBarcodesIfMissing(documentId, items, t) {
    const countExisting = await DocumentCopy.count({
        where: { deleted: false, documentId }, transaction: t, lock: t.LOCK.UPDATE
    });
    let seq = countExisting + 1;
    return items.map(it => it.barCode ? it : {
        ...it, barCode: `DOC${documentId}-${String(seq++).padStart(4, '0')}`
    });
}
async function createDocumentCopies(documentId, copies = [], t) {
    if (!Array.isArray(copies) || copies.length === 0) return [];

    const inputs = copies.map((x, i) => normalizeCopyInput(x, i));
    const withCodes = await generateBarcodesIfMissing(documentId, inputs, t);

    const seen = new Set();
    const unique = [];
    for (const c of withCodes) {
        if (seen.has(c.barCode)) continue;
        seen.add(c.barCode);
        unique.push(c);
    }

    const created = [];
    for (const c of unique) {
        try {
            const row = await DocumentCopy.create({
                documentId,
                barCode: c.barCode,
                status: c.status,
                conditionNote: c.conditionNote,
                entryDate: c.entryDate,
                deleted: false
            }, { transaction: t });
            created.push(row);
        } catch (e) {
            if (e instanceof UniqueConstraintError) {
                const err = new Error(`Barcode đã tồn tại: ${c.barCode}`);
                err.status = 409;
                throw err;
            }
            throw e;
        }
    }

    const total = await DocumentCopy.count({
        where: { deleted: false, documentId }, transaction: t, lock: t.LOCK.UPDATE
    });
    await Document.update({ numberOfCopy: total }, { where: { documentId }, transaction: t });

    return created;
}

/* ============================================================
 *                     CREATE * FUNCTIONS
 * ==========================================================*/

async function createBook({
    title, language, publicationYear, coverPrice, description, shelfLocation,
    publisherName, authors, genres,
    // CHẤP NHẬN: multipart (coverFile, ebookFile) HOẶC url (coverUrl, ebookViewUrl)
    coverFile, ebookFile, coverUrl, ebookViewUrl,
    bookData = {},
    initialCopies = [],
    initialCopiesCount = 0
}) {
    return await sequelize.transaction(async (tOuter) => {
        const { coverUrl: coverFinal, ebookViewUrl: ebookFinal } =
            await ensureCoverAndEbookUrls({ coverFile, ebookFile, coverUrl, ebookViewUrl });

        const categoryId = await resolveCategoryIdOrThrow('book');
        const pub = await ensurePublisher(publisherName, tOuter);

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
        }, { transaction: tOuter });

        const ensuredAuthors = await ensureAuthors(authors, tOuter);
        for (const a of ensuredAuthors) {
            await upsertDocAuthorMap(doc.documentId, a.author.authorId, a.role, a.ord, tOuter);
        }
        const ensuredGenres = await ensureGenres(genres, tOuter);
        for (const g of ensuredGenres) {
            await upsertDocGenreMap(doc.documentId, g.genreId, tOuter);
        }

        await Book.create({
            documentId: doc.documentId,
            isbn: bookData.isbn || null,
            edition: Number.isFinite(+bookData.edition) ? +bookData.edition : null,
            pageCount: Number.isFinite(+bookData.pageCount) ? +bookData.pageCount : null,
            deleted: false
        }, { transaction: tOuter });

        const copiesPayload =
            Array.isArray(initialCopies) && initialCopies.length > 0
                ? initialCopies
                : (Number.isFinite(+initialCopiesCount) && +initialCopiesCount > 0
                    ? Array.from({ length: +initialCopiesCount }, () => ({ status: 'available', conditionNote: '100' }))
                    : []);
        await createDocumentCopies(doc.documentId, copiesPayload, tOuter);

        const full = await Document.findOne({
            where: { documentId: doc.documentId },
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
                { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'] },
                { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'], required: false },
                { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'], required: false }
            ],
            transaction: tOuter
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
        for (const a of ensuredAuthors) {
            await upsertDocAuthorMap(doc.documentId, a.author.authorId, a.role, a.ord, t);
        }
        const ensuredGenres = await ensureGenres(genres, t);
        for (const g of ensuredGenres) {
            await upsertDocGenreMap(doc.documentId, g.genreId, t);
        }

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
        await createDocumentCopies(doc.documentId, copiesPayload, t);

        const full = await Document.findOne({
            where: { documentId: doc.documentId },
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
                { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'], required: false },
                { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'] },
                { model: Newspaper, as: 'newspaper', attributes: ['issn', 'issueDate', 'issueNumber'], required: false }
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
        for (const a of ensuredAuthors) {
            await upsertDocAuthorMap(doc.documentId, a.author.authorId, a.role, a.ord, t);
        }
        const ensuredGenres = await ensureGenres(genres, t);
        for (const g of ensuredGenres) {
            await upsertDocGenreMap(doc.documentId, g.genreId, t);
        }

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
        await createDocumentCopies(doc.documentId, copiesPayload, t);

        const full = await Document.findOne({
            where: { documentId: doc.documentId },
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
                { model: Book, as: 'book', attributes: ['isbn', 'edition', 'pageCount'], required: false },
                { model: Magazine, as: 'magazine', attributes: ['issn', 'volume', 'issue', 'period', 'coverDate'], required: false },
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
        // kiểm tra document còn tồn tại & chưa xoá
        const doc = await Document.findOne({
            where: { documentId, deleted: false },
            attributes: ['documentId'],
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (!doc) {
            const err = new Error('Document không tồn tại');
            err.status = 404;
            throw err;
        }

        const created = await createDocumentCopies(documentId, copies, t);
        // lấy summary mới
        const total = await DocumentCopy.count({ where: { deleted: false, documentId }, transaction: t });
        return { createdCount: created.length, numberOfCopy: total };
    });
}

const getBooksBasicFn = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'book' });
const getMagazinesBasicFn = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'magazine' });
const getNewspapersBasicFn = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'newspaper' });

module.exports = {
    // list & deposit
    getBasicDocumentsByCategory,
    getBooksBasic: getBooksBasicFn,
    getMagazinesBasic: getMagazinesBasicFn,
    getNewspapersBasic: getNewspapersBasicFn,
    getDocumentCopiesWithDeposit,

    // create & copies
    createBook,
    createMagazine,
    createNewspaper,
    addCopies
};
