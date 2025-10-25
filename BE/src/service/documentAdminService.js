// src/service/documentBasicByCategoryService.js
const {
    Document, Category, Publisher,
    Author, DocumentAuthorMap,
    Book, Magazine, Newspaper, DocumentCopy
} = require('../model');
const { Op } = require('sequelize');

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

/**
 * Lấy danh sách thông tin cơ bản theo category (book/magazine/newspaper/all)
 * @param {Object} params
 * @param {'all'|'book'|'magazine'|'newspaper'} params.documentType
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.search - tìm theo title (LIKE)
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
 * @param {number} documentId
 * @returns {{
 *  documentId:number,
 *  coverPrice:number,
 *  depositRate:number,
 *  copies:Array<{
 *    documentCopyId:number,
 *    barCode:string|null,
 *    status:string,
 *    conditionNote:string|null, // % chất lượng (vd "80")
 *    entryDate:string|Date|null,
 *    deposit:number|null        // tiền cọc đã tính
 *  }>,
 *  summary:{ minDeposit:number|null, maxDeposit:number|null, avgDeposit:number|null }
 * }}
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

/** Shortcut helpers nếu bạn muốn gọi nhanh theo từng loại */
const getBooksBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'book' });
const getMagazinesBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'magazine' });
const getNewspapersBasic = (opts = {}) => getBasicDocumentsByCategory({ ...opts, documentType: 'newspaper' });

module.exports = {
    getBasicDocumentsByCategory,
    getBooksBasic,
    getMagazinesBasic,
    getNewspapersBasic,
    getDocumentCopiesWithDeposit
};
