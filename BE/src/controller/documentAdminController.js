const {
    getBasicDocumentsByCategory,
    getBooksBasic,
    getMagazinesBasic,
    getNewspapersBasic,
    getDocumentCopiesWithDeposit
} = require('../service/documentAdminService');

// Parse và chuẩn hoá query params
function parseQuery(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100); // giới hạn 100
    const search = String(req.query.search || '').trim();
    const documentType = (req.query.documentType || 'all').toLowerCase(); // all | book | magazine | newspaper
    return { page, limit, search, documentType };
}

// GET /documents/basic?documentType=book|magazine|newspaper|all&search=&page=&limit=
async function getBasicList(req, res) {
    try {
        const { page, limit, search, documentType } = parseQuery(req);

        if (!['all', 'book', 'magazine', 'newspaper'].includes(documentType)) {
            return res.status(400).json({ message: 'documentType không hợp lệ (all|book|magazine|newspaper)' });
        }

        const data = await getBasicDocumentsByCategory({ page, limit, search, documentType });
        return res.status(200).json(data);
    } catch (err) {
        console.error('getBasicList error:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
}

// GET /documents/books?search=&page=&limit=
async function getBooks(req, res) {
    try {
        const { page, limit, search } = parseQuery(req);
        const data = await getBooksBasic({ page, limit, search });
        return res.status(200).json(data);
    } catch (err) {
        console.error('getBooks error:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
}

// GET /documents/magazines?search=&page=&limit=
async function getMagazines(req, res) {
    try {
        const { page, limit, search } = parseQuery(req);
        const data = await getMagazinesBasic({ page, limit, search });
        return res.status(200).json(data);
    } catch (err) {
        console.error('getMagazines error:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
}

// GET /documents/newspapers?search=&page=&limit=
async function getNewspapers(req, res) {
    try {
        const { page, limit, search } = parseQuery(req);
        const data = await getNewspapersBasic({ page, limit, search });
        return res.status(200).json(data);
    } catch (err) {
        console.error('getNewspapers error:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
}

async function getCopiesWithDeposit(req, res) {
    try {
        const documentId = Number(req.params.id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({ message: 'documentId không hợp lệ' });
        }

        const data = await getDocumentCopiesWithDeposit(documentId);
        if (!data) {
            return res.status(404).json({ message: 'Không tìm thấy tài liệu hoặc đã bị xoá' });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error('getCopiesWithDeposit error:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
}

module.exports = {
    getBasicList,
    getBooks,
    getMagazines,
    getNewspapers,
    getCopiesWithDeposit
};