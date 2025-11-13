// ================================
// File: /controller/documentAdminController.js (Optimized)
// ================================

const {
  getBasicDocumentsByCategoryFast,
  getBooksBasic,
  getMagazinesBasic,
  getNewspapersBasic,
  getDocumentCopies,
  getDocumentCopy,
  getDocumentCopyAndDoc,
  createBook,
  createMagazine,
  createNewspaper,
  addCopies,
  updateBook,
  updateMagazine,
  updateNewspaper,
  softDeleteDocument,
  softDeleteCopy,
  updateCopy
} = require('../service/documentAdminService');

function parseJSONSafe(s, fallback) {
  try {
    if (typeof s === 'string') return JSON.parse(s);
    if (s == null) return fallback;
    return s;
  } catch {
    return fallback;
  }
}

// Parse & chuẩn hoá query params (bổ sung flags tối ưu)
function parseQuery(req) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const search = String(req.query.search || '').trim();
  const documentType = (req.query.documentType || 'all').toLowerCase(); // all | book | magazine | newspaper
  const searchMode = (req.query.searchMode || 'auto').toLowerCase(); // auto | fulltext | like
  const withAuthors = req.query.withAuthors !== '0';
  const withSubtype = req.query.withSubtype !== '0';
  return { page, limit, search, documentType, searchMode, withAuthors, withSubtype };
}

// GET /documents/basic?documentType=book|magazine|newspaper|all&search=&page=&limit=&searchMode=&withAuthors=0|1&withSubtype=0|1
async function getBasicList(req, res) {
  try {
    const { page, limit, search, documentType, searchMode, withAuthors, withSubtype } = parseQuery(req);

    if (!['all', 'book', 'magazine', 'newspaper'].includes(documentType)) {
      return res.status(400).json({ message: 'documentType không hợp lệ (all|book|magazine|newspaper)' });
    }

    const data = await getBasicDocumentsByCategoryFast({ page, limit, search, documentType, searchMode, withAuthors, withSubtype });
    return res.status(200).json(data);
  } catch (err) {
    console.error('getBasicList error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

// GET /documents/books?search=&page=&limit=&searchMode=&withAuthors=&withSubtype=
async function getBooks(req, res) {
  try {
    const { page, limit, search, searchMode, withAuthors, withSubtype } = parseQuery(req);
    const data = await getBooksBasic({ page, limit, search, searchMode, withAuthors, withSubtype });
    return res.status(200).json(data);
  } catch (err) {
    console.error('getBooks error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

// GET /documents/magazines?search=&page=&limit=&searchMode=&withAuthors=&withSubtype=
async function getMagazines(req, res) {
  try {
    const { page, limit, search, searchMode, withAuthors, withSubtype } = parseQuery(req);
    const data = await getMagazinesBasic({ page, limit, search, searchMode, withAuthors, withSubtype });
    return res.status(200).json(data);
  } catch (err) {
    console.error('getMagazines error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

// GET /documents/newspapers?search=&page=&limit=&searchMode=&withAuthors=&withSubtype=
async function getNewspapers(req, res) {
  try {
    const { page, limit, search, searchMode, withAuthors, withSubtype } = parseQuery(req);
    const data = await getNewspapersBasic({ page, limit, search, searchMode, withAuthors, withSubtype });
    return res.status(200).json(data);
  } catch (err) {
    console.error('getNewspapers error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

async function getCopiesWithDepositCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ message: 'documentId không hợp lệ' });
    }

    const { status } = req.query; // optional
    const data = await getDocumentCopies(documentId, { status });
    if (!data) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu hoặc đã bị xoá' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('getCopiesWithDeposit error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

// POST /documents/book
// - Hỗ trợ multipart (files: cover, ebook) hoặc JSON (coverUrl, ebookViewUrl)
async function createBookCtrl(req, res) {
  try {
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await createBook({
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: parseJSONSafe(b.authors, []),            // [{ fullName, role?, ord? }]
      genres: parseJSONSafe(b.genres, []),              // ["Khoa học", ...]
      coverUrl: b.coverUrl,                             // nếu không gửi file thì gửi url
      ebookViewUrl: b.ebookViewUrl,                     // tuỳ chọn
      bookData: parseJSONSafe(b.bookData, {}),          // { isbn, edition, pageCount }
      initialCopies: parseJSONSafe(b.initialCopies, []),
      initialCopiesCount: Number(b.initialCopiesCount || 0),
      ...files
    });

    return res.status(201).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// POST /documents/magazine
async function createMagazineCtrl(req, res) {
  try {
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await createMagazine({
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: parseJSONSafe(b.authors, []),
      genres: parseJSONSafe(b.genres, []),
      coverUrl: b.coverUrl,
      ebookViewUrl: b.ebookViewUrl,
      magazineData: parseJSONSafe(b.magazineData, {}),  // { issn, volume, issue, period, coverDate }
      initialCopies: parseJSONSafe(b.initialCopies, []),
      initialCopiesCount: Number(b.initialCopiesCount || 0),
      ...files
    });

    return res.status(201).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// POST /documents/newspaper
async function createNewspaperCtrl(req, res) {
  try {
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await createNewspaper({
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: parseJSONSafe(b.authors, []),
      genres: parseJSONSafe(b.genres, []),
      coverUrl: b.coverUrl,
      ebookViewUrl: b.ebookViewUrl,
      newspaperData: parseJSONSafe(b.newspaperData, {}), // { issn, issueDate, issueNumber }
      initialCopies: parseJSONSafe(b.initialCopies, []),
      initialCopiesCount: Number(b.initialCopiesCount || 0),
      ...files
    });

    return res.status(201).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// POST /documents/:id/copies
// Body: [{ barCode?, status?, conditionNote?, entryDate? }, ...]
async function addCopiesCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentId không hợp lệ' });
    }

    const copies = Array.isArray(req.body) ? req.body : [];
    const result = await addCopies(documentId, copies);
    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}


async function getCopyWithDepositSingleCtrl(req, res) {
  try {
    const copyId = Number(req.params.copyId);
    if (!Number.isInteger(copyId) || copyId <= 0) {
      return res.status(400).json({ message: 'documentCopyId không hợp lệ' });
    }

    // Query flags: ?withDoc=1&withAuthors=1&withSubtype=1
    const withDoc = req.query.withDoc !== '0';          // mặc định: có document
    const withAuthors = req.query.withAuthors !== '0';  // mặc định: có authors
    const withSubtype = req.query.withSubtype !== '0';  // mặc định: có subtype

    if (!withDoc) {
      // Hành vi cũ: chỉ trả copy + deposit
      const data = await getDocumentCopy(copyId);
      if (!data) return res.status(404).json({ message: 'Không tìm thấy bản sao hoặc đã bị xoá' });
      return res.status(200).json(data);
    }

    // Hành vi mới: trả cả document cơ bản
    const data = await getDocumentCopyAndDoc(copyId, { withAuthors, withSubtype });
    if (!data) return res.status(404).json({ message: 'Không tìm thấy bản sao hoặc đã bị xoá' });
    return res.status(200).json(data);
  } catch (err) {
    console.error('getCopyWithDepositSingle error:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
}

// PUT /documents/book/:id  (multipart hoặc json)
async function updateBookCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentId không hợp lệ' });
    }
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await updateBook({
      documentId,
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: (b.authors !== undefined) ? parseJSONSafe(b.authors, []) : undefined,
      genres: (b.genres !== undefined) ? parseJSONSafe(b.genres, []) : undefined,
      coverUrl: b.coverUrl,
      ebookViewUrl: b.ebookViewUrl,
      bookData: (b.bookData !== undefined) ? parseJSONSafe(b.bookData, {}) : undefined,
      ...files
    });

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// PUT /documents/magazine/:id
async function updateMagazineCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentId không hợp lệ' });
    }
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await updateMagazine({
      documentId,
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: (b.authors !== undefined) ? parseJSONSafe(b.authors, []) : undefined,
      genres: (b.genres !== undefined) ? parseJSONSafe(b.genres, []) : undefined,
      coverUrl: b.coverUrl,
      ebookViewUrl: b.ebookViewUrl,
      magazineData: (b.magazineData !== undefined) ? parseJSONSafe(b.magazineData, {}) : undefined,
      ...files
    });

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// PUT /documents/newspaper/:id
async function updateNewspaperCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentId không hợp lệ' });
    }
    const files = {
      coverFile: req.files?.cover?.[0],
      ebookFile: req.files?.ebook?.[0]
    };
    const b = req.body;

    const data = await updateNewspaper({
      documentId,
      title: b.title,
      language: b.language,
      publicationYear: b.publicationYear,
      coverPrice: b.coverPrice,
      description: b.description,
      shelfLocation: b.shelfLocation,
      publisherName: b.publisherName,
      authors: (b.authors !== undefined) ? parseJSONSafe(b.authors, []) : undefined,
      genres: (b.genres !== undefined) ? parseJSONSafe(b.genres, []) : undefined,
      coverUrl: b.coverUrl,
      ebookViewUrl: b.ebookViewUrl,
      newspaperData: (b.newspaperData !== undefined) ? parseJSONSafe(b.newspaperData, {}) : undefined,
      ...files
    });

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// DELETE /documents/:id  (?cascadeSubtype=1&cascadeCopies=0&cascadeMaps=0)
async function deleteDocumentCtrl(req, res) {
  try {
    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentId không hợp lệ' });
    }

    const cascadeSubtype = req.query.cascadeSubtype !== '0'; // default true
    const cascadeCopies = req.query.cascadeCopies === '1';   // default false
    const cascadeMaps = req.query.cascadeMaps === '1';       // default false

    const data = await softDeleteDocument(documentId, { cascadeSubtype, cascadeCopies, cascadeMaps });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// DELETE /documents/copies/:copyId
async function deleteCopyCtrl(req, res) {
  try {
    const copyId = Number(req.params.copyId);
    if (!Number.isInteger(copyId) || copyId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentCopyId không hợp lệ' });
    }
    const data = await softDeleteCopy(copyId);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

// PUT /documents/copies/:copyId
// Body: { barCode?, status?, conditionNote?, entryDate? }
async function updateCopyCtrl(req, res) {
  try {
    const copyId = Number(req.params.copyId);
    if (!Number.isInteger(copyId) || copyId <= 0) {
      return res.status(400).json({ ok: false, message: 'documentCopyId không hợp lệ' });
    }

    const { barCode, status, conditionNote, entryDate } = req.body || {};
    const result = await updateCopy(copyId, { barCode, status, conditionNote, entryDate });

    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message });
  }
}

module.exports = {
  getBasicList,
  getBooks,
  getMagazines,
  getNewspapers,
  getCopiesWithDeposit: getCopiesWithDepositCtrl,
  createBookCtrl,
  createMagazineCtrl,
  createNewspaperCtrl,
  addCopiesCtrl,
  getCopyWithDepositSingleCtrl,
  updateBookCtrl,
  updateMagazineCtrl,
  updateNewspaperCtrl,
  updateCopyCtrl,
  deleteDocumentCtrl,
  deleteCopyCtrl
};
