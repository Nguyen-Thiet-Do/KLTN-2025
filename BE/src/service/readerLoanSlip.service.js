// src/service/readerLoanSlip.service.js
const { Op } = require('sequelize');
const {
  LoanSlip,
  LoanDetail,
  Reader,
  Librarian,
  DocumentCopy,
  Document,
} = require('../model');

async function getMyLoanHistoryService(user, query) {
  const { accountId } = user;
  const {
    page = 1,
    limit = 10,
    status,
    fromDate,
    toDate,
    sortBy = 'loanDate',
    sortDir = 'DESC',
  } = query;

  // Tìm reader
  const reader = await Reader.findOne({
    where: { accountId, deleted: false },
    attributes: ['readerId', 'fullName'],
  });

  if (!reader) {
    const err = new Error('Không tìm thấy tài khoản độc giả');
    err.statusCode = 404;
    throw err;
  }

  const where = { deleted: false, readerId: reader.readerId };
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.loanDate = {};
    if (fromDate) where.loanDate[Op.gte] = fromDate;
    if (toDate) where.loanDate[Op.lte] = toDate;
  }

  const offset = (Number(page) - 1) * Number(limit);

  // ============================
  // QUERY GỐC — include DocumentCopy → Document
  // ============================
  const result = await LoanSlip.findAndCountAll({
    where,
    limit: Number(limit),
    offset,
    order: [[sortBy, sortDir]],
    include: [
      { model: Librarian, attributes: ['librarianId', 'fullName'] },
      {
        model: LoanDetail,
        as: 'details',
        attributes: [
          'loanDetailId',
          'documentCopyId',
          'returnDate',
          'status',
          'fineAmount',
          'renewalCount',
          'note',
        ],
        include: [
          {
            model: DocumentCopy,
            required: false,
            attributes: ['documentCopyId', 'barCode', 'status'],
            include: [
              {
                model: Document,
                required: false,
                attributes: [
                  'documentId',
                  'title',
                  'shelfLocation',
                  'coverPhoto',
                  'ebookUrl'
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  // ============================
  // XỬ LÝ ĐỂ PENDING LẤY DOCUMENT TỪ NOTE
  // ============================
  const rows = await Promise.all(
    result.rows.map(async (slip) => {
      const newDetails = await Promise.all(
        slip.details.map(async (d) => {
          let doc = null;

          // TH1: Đã duyệt → lấy Document từ DocumentCopy
          if (d.DocumentCopy && d.DocumentCopy.Document) {
            doc = d.DocumentCopy.Document;
          }

         // TH2: PENDING → DocumentCopy = null → lấy documentId từ note
if (!doc && d.status === 'PENDING') {
  let docId = null;

  if (d.note) {
    // JSON
    if (d.note.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(d.note);
        docId = parsed.requestDocumentId || parsed.documentId || null;
      } catch {}
    }

    // TEXT dạng REQUEST_DOCUMENT_ID=xxxx
    if (!docId && d.note.includes("REQUEST_DOCUMENT_ID")) {
      const parts = d.note.split("=");
      if (parts.length === 2) {
        docId = Number(parts[1]);
      }
    }
  }

  if (docId) {
    doc = await Document.findByPk(docId, {
      attributes: ['documentId', 'title', 'coverPhoto', 'shelfLocation', 'ebookUrl'],
    });
  }
}


          // Chuẩn hoá output bookInfo
          const bookInfo = doc
            ? {
                documentId: doc.documentId,
                title: doc.title,
                coverPhoto: doc.coverPhoto,
                shelfLocation: doc.shelfLocation,
                ebookUrl: doc.ebookUrl,
              }
            : null;

          return {
            ...d.toJSON(),
            bookInfo,
          };
        })
      );

      return {
        ...slip.toJSON(),
        details: newDetails,
      };
    })
  );

  return {
    reader: { readerId: reader.readerId, fullName: reader.fullName },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.count,
      totalPages: Math.ceil(result.count / Number(limit)),
    },
    data: rows,
  };
}

module.exports = { getMyLoanHistoryService };
