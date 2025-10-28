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
 * @param {object} user - req.user (JWT), yêu cầu roleId = 3
 * @param {object} payload - { items: [{ documentId: number, quantity?: number }], note?: string }
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

    // Chuẩn hoá items (gộp theo documentId)
    const itemsIn = Array.isArray(payload?.items) ? payload.items : [];
    if (!itemsIn.length) {
      const e = new Error('Danh sách sách mượn trống');
      e.statusCode = 400;
      throw e;
    }
    const merged = new Map();
    for (const it of itemsIn) {
      const id = Number(it.documentId);
      const qty = Math.max(1, Number(it.quantity || 1));
      if (!id || qty <= 0) continue;
      merged.set(id, (merged.get(id) || 0) + qty);
    }
    const items = [...merged.entries()].map(([documentId, quantity]) => ({ documentId, quantity }));

    // Hạn mức mượn
    const currentlyBorrowing = await countBorrowingBooks(reader.readerId);
    if (currentlyBorrowing >= 3) {
      const e = new Error('Bạn đã mượn đủ số lượng tối đa (3).');
      e.statusCode = 400;
      throw e;
    }
    const remaining = 3 - currentlyBorrowing;
    const requestedTotal = items.reduce((s, x) => s + x.quantity, 0);
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
      //    (LoanDetail chưa gán documentCopyId, cùng documentId — mình tag bằng note)
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
      if (effectiveAvailable < it.quantity) {
        const e = new Error(`"${detail.title}" chỉ còn ${effectiveAvailable} bản khả dụng để đặt trước.`);
        e.statusCode = 400;
        throw e;
      }
      // ====== END SOFT-HOLD ======

      const minPerOne = detail.deposit?.minDeposit ?? null;
      const maxPerOne = detail.deposit?.maxDeposit ?? null;

      detailPreview.push({
        documentId: detail.documentId,
        title: detail.title,
        quantity: it.quantity,
        depositMin: minPerOne,
        depositMax: maxPerOne,
      });

      if (minPerOne != null) totalDepositMin += minPerOne * it.quantity;
      if (maxPerOne != null) totalDepositMax += maxPerOne * it.quantity;
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

    // Tạo LoanDetail: chưa chọn bản sao -> documentCopyId = null
    for (const it of detailPreview) {
      for (let i = 0; i < it.quantity; i++) {
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
