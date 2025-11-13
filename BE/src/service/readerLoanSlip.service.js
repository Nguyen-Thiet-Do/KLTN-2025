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

  // Map accountId -> readerId
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
            attributes: ['documentCopyId', 'barCode', 'status'],
            include: [
              {
                model: Document,
                attributes: ['documentId', 'title', 'shelfLocation'],
              },
            ],
          },
        ],
      },
    ],
  });

  return {
    reader: { readerId: reader.readerId, fullName: reader.fullName },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.count,
      totalPages: Math.ceil(result.count / Number(limit)),
    },
    data: result.rows,
  };
}

module.exports = { getMyLoanHistoryService };
