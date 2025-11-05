// src/service/readerReserveLoan.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database'); // Sequelize instance của bạn
const {
  LoanSlip,
  LoanDetail,
  Reader,
  DocumentCopy,
  Violation,
} = require('../model');

const { getDocumentDetailWithDeposit } = require('./documentService');

// Đếm tổng sách đang mượn (chưa trả) của 1 reader
async function countBorrowingBooks(readerId) {
  const rows = await LoanDetail.findAll({
    include: [{
      model: LoanSlip,
      required: true,
      where: {
        readerId,
        deleted: false,
        status: { [Op.ne]: 'CANCELLED' }, // loại phiếu bị hủy
      },
      attributes: [],
    }],
    where: { returnDate: { [Op.is]: null } }, // chưa trả
    attributes: ['loanDetailId'],
  });
  return rows.length;
}

// Có vi phạm chưa xử lý? -> chỉ cần paymentStatus != 'PAID'
async function hasUnresolvedViolation(readerId) {
  const v = await Violation.findOne({
    where: {
      readerId,
      deleted: false,
      paymentStatus: { [Op.ne]: 'PAID' },
    },
  });
  return !!v;
}

/**
 * Đặt mượn trước (Reader)
 * - KHÔNG truyền quantity
 * - Mỗi documentId chỉ được đặt 1 bản (trùng -> 400)
 *
 * @param {object} user - req.user (JWT), yêu cầu roleId = 3
 * @param {object} payload - { items: Array<number | { documentId: number }>, note?: string }
 */
async function reserveLoanForReaderService(user, payload) {
  const t = await sequelize.transaction();
  try {
    if (!user || user.roleId !== 3) {
      const e = new Error('Chỉ độc giả mới được đặt mượn trước');
      e.statusCode = 403;
      throw e;
    }

    // Map account -> reader
    const reader = await Reader.findOne({
      where: { accountId: user.accountId, deleted: false },
      attributes: ['readerId', 'fullName'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!reader) {
      const e = new Error('Không tìm thấy tài khoản độc giả');
      e.statusCode = 404;
      throw e;
    }

    // --- Chuẩn hoá items: KHÔNG quantity, KHÔNG CHO PHÉP TRÙNG ---
    // Chấp nhận: [1, 2, 5] hoặc [{documentId:1}, {documentId:2}, {documentId:5}]
    const itemsIn = Array.isArray(payload?.items) ? payload.items : [];
    if (!itemsIn.length) {
      const e = new Error('Danh sách sách mượn trống');
      e.statusCode = 400;
      throw e;
    }

    const seen = new Set();
    const items = [];
    for (const raw of itemsIn) {
      const id = Number(typeof raw === 'object' ? raw?.documentId : raw);
      if (!id) continue;

      if (seen.has(id)) {
        const e = new Error(`Tài liệu #${id} xuất hiện nhiều lần. Mỗi tài liệu chỉ được đặt 1 bản.`);
        e.statusCode = 400;
        throw e;
      }
      seen.add(id);
      items.push({ documentId: id }); // luôn 1 bản
    }

    if (items.length === 0) {
      const e = new Error('Danh sách sách mượn không hợp lệ');
      e.statusCode = 400;
      throw e;
    }

    // Hạn mức mượn
    const currentlyBorrowing = await countBorrowingBooks(reader.readerId);
    if (currentlyBorrowing >= 3) {
      const e = new Error('Bạn đã mượn đủ số lượng tối đa (3).');
      e.statusCode = 400;
      throw e;
    }
    const remaining = 3 - currentlyBorrowing;
    const requestedTotal = items.length; // mỗi item = 1 bản
    if (requestedTotal > remaining) {
      const e = new Error(`Số sách yêu cầu (${requestedTotal}) vượt quá số còn được mượn (${remaining}).`);
      e.statusCode = 400;
      throw e;
    }

    // Vi phạm?
    if (await hasUnresolvedViolation(reader.readerId)) {
      const e = new Error('Tài khoản có vi phạm chưa xử lý. Không thể đặt mượn.');
      e.statusCode = 400;
      throw e;
    }

    // Kiểm tra từng tài liệu & tính cọc theo documentService
    const detailPreview = [];
    let totalDepositMin = 0;
    let totalDepositMax = 0;

    for (const it of items) {
      const detail = await getDocumentDetailWithDeposit(it.documentId);
      if (!detail) {
        const e = new Error(`Không tìm thấy tài liệu #${it.documentId}`);
        e.statusCode = 404;
        throw e;
      }

      // ====== SOFT-HOLD: kiểm tra tồn kho hiệu dụng (AVAILABLE - PENDING holds) ======
      // 1) Đếm AVAILABLE (lock)
      const available = await DocumentCopy.count({
        where: { documentId: it.documentId, deleted: false, status: 'AVAILABLE' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 2) Đếm số lượng đang "giữ chỗ mềm" từ các phiếu PENDING
      //    (LoanDetail chưa gán documentCopyId, cùng documentId — tag qua note)
      const pendingHolds = await LoanDetail.count({
        include: [{
          model: LoanSlip,
          required: true,
          where: { deleted: false, status: 'PENDING' },
          attributes: [],
        }],
        where: {
          documentCopyId: { [Op.is]: null },
          note: `REQUEST_DOCUMENT_ID=${it.documentId}`,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const effectiveAvailable = available - pendingHolds;
      if (effectiveAvailable < 1) {
        const e = new Error(`"${detail.title}" hiện không còn bản khả dụng để đặt trước.`);
        e.statusCode = 400;
        throw e;
      }
      // ====== END SOFT-HOLD ======

      const minPerOne = detail.deposit?.minDeposit ?? null;
      const maxPerOne = detail.deposit?.maxDeposit ?? null;

      detailPreview.push({
        documentId: detail.documentId,
        title: detail.title,
        quantity: 1,            // luôn 1
        depositMin: minPerOne,
        depositMax: maxPerOne,
      });

      if (minPerOne != null) totalDepositMin += minPerOne;
      if (maxPerOne != null) totalDepositMax += maxPerOne;
    }

    // Tạo LoanSlip ở trạng thái PENDING
    // (yêu cầu schema cho phép NULL cho librarianId, dueDate)
    const slip = await LoanSlip.create(
      {
        readerId: reader.readerId,
        librarianId: null,         // sẽ set khi duyệt
        loanDate: new Date(),
        dueDate: null,             // sẽ set khi duyệt
        status: 'PENDING',         // chờ duyệt
        borrowForm: 'RESERVATION', // kiểu đặt mượn
        addressForm: null,
        note: payload?.note || null,
        deleted: false,
      },
      { transaction: t }
    );

    // Tạo LoanDetail: mỗi tài liệu 1 dòng
    for (const it of detailPreview) {
      await LoanDetail.create(
        {
          loanSlipId: slip.loanSlipId,
          documentCopyId: null, // sẽ gán khi thủ thư duyệt
          returnDate: null,
          status: 'PENDING',
          depositAmount: null,  // sẽ chốt khi duyệt
          fineAmount: 0,
          renewalCount: 0,
          note: `REQUEST_DOCUMENT_ID=${it.documentId}`, // tag để tính pendingHolds
        },
        { transaction: t }
      );
    }

    await t.commit();

    return {
      slip: {
        loanSlipId: slip.loanSlipId,
        status: slip.status,
        reader: { readerId: reader.readerId, fullName: reader.fullName },
      },
      items: detailPreview,
      depositRange: {
        totalMin: totalDepositMin || null,
        totalMax: totalDepositMax || null,
      },
      summary: {
        currentlyBorrowing,
        requestedTotal,
        remainingAfterReserve: remaining - requestedTotal,
      },
      message: 'Đặt mượn thành công. Phiếu đang chờ thủ thư duyệt; tiền cọc sẽ được chốt khi duyệt.',
    };
  } catch (err) {
    await t.rollback();
    if (err.statusCode) throw err;
    const e = new Error(err.message || 'Không thể đặt mượn trước');
    e.statusCode = 500;
    throw e;
  }
}

module.exports = { reserveLoanForReaderService };
