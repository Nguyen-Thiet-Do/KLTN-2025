// src/service/readerReserveLoan.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database'); // Sequelize instance của bạn
const {
  LoanSlip,
  LoanDetail,
  Reader,
  DocumentCopy,
  Violation,
  Payment,
  MemberCard,
  CardType,
  LoanSlip: LoanSlipModel,
} = require('../model');

const { getDocumentDetailWithDeposit } = require('./documentService'); // nếu bạn đã đổi tên, thay lại cho khớp

/** Helpers: xử lý ngày (giống admin service) */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function parseDateOnly(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str || ''))) return null;
  const d = new Date(`${str}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtToday() {
  return new Date().toISOString().slice(0, 10);
}
function daysDiff(a, b) {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return NaN;
  return Math.round((db.getTime() - da.getTime()) / ONE_DAY_MS);
}

/**
 * Snapshot tình trạng mượn của độc giả (để kiểm tra điều kiện/ quota)
 * Trả về object giống admin service: { pendingApprovalCount, waitingForPickupCount, borrowingCount, overdueCount, unresolvedViolationCount, activeCount }
 */
async function getReaderBorrowSnapshot(readerId, t) {
  const today = fmtToday();

  // pending slips/details
  const pendingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: 'PENDING' },
    attributes: ['loanSlipId'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const pendingSlipIds = pendingSlips.map(s => s.loanSlipId);
  const pendingApprovalCount = pendingSlipIds.length
    ? await LoanDetail.count({ where: { loanSlipId: pendingSlipIds, status: 'PENDING' }, transaction: t })
    : 0;

  // waiting for pickup
  const waitingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: ['WAITING_FOR_PICKUP'] },
    attributes: ['loanSlipId'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const waitingSlipIds = waitingSlips.map(s => s.loanSlipId);
  const waitingForPickupCount = waitingSlipIds.length
    ? await LoanDetail.count({ where: { loanSlipId: waitingSlipIds, status: 'WAITING_FOR_PICKUP' }, transaction: t })
    : 0;

  // borrowing (active)
  const borrowingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: 'BORROWING' },
    attributes: ['loanSlipId', 'dueDate'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const borrowingSlipIds = borrowingSlips.map(s => s.loanSlipId);
  const borrowingCount = borrowingSlipIds.length
    ? await LoanDetail.count({ where: { loanSlipId: borrowingSlipIds, status: 'BORROWED' }, transaction: t })
    : 0;

  // overdue: borrowings with slip.dueDate < today and LoanDetail status BORROWED and returnDate IS NULL
  let overdueCount = 0;
  if (borrowingSlipIds.length) {
    const overdueSlipIds = borrowingSlips
      .filter(s => daysDiff(today, s.dueDate) < 0)
      .map(s => s.loanSlipId);

    overdueCount = overdueSlipIds.length
      ? await LoanDetail.count({
        where: { loanSlipId: overdueSlipIds, status: 'BORROWED', returnDate: { [Op.is]: null } },
        transaction: t
      })
      : 0;
  }

  // unresolved violations/payments: giống admin - check Payment pending (non DEPOSIT) and Violation paymentStatus != PAID
  const unresolvedPayments = await Payment.count({
    where: { readerId, status: 'PENDING', paymentType: { [Op.not]: 'DEPOSIT' } },
    transaction: t
  });
  const unresolvedViolations = await Violation.count({
    where: { readerId, deleted: false, paymentStatus: { [Op.ne]: 'PAID' } },
    transaction: t
  });
  const unresolvedViolationCount = Math.max(unresolvedPayments, unresolvedViolations) || unresolvedPayments + unresolvedViolations;

  const activeCount = waitingForPickupCount + borrowingCount;

  return {
    pendingApprovalCount,
    waitingForPickupCount,
    borrowingCount,
    overdueCount,
    unresolvedViolationCount,
    activeCount,
  };
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
      attributes: ['readerId', 'fullName', 'memberCardId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!reader) {
      const e = new Error('Không tìm thấy tài khoản độc giả');
      e.statusCode = 404;
      throw e;
    }

    // --- Chuẩn hoá items: KHÔNG quantity, KHÔNG CHO PHÉP TRÙNG ---
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

    // --- LẤY THẺ (MemberCard) CỦA ĐỘC GIẢ -> RỒI LẤY CardType ---
    const memberCard = await MemberCard.findOne({
      where: { readerId: reader.readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!memberCard) {
      const e = new Error('Độc giả chưa có thẻ hội viên hợp lệ (MemberCard).');
      e.status = 403; throw e;
    }

    // Kiểm expiry
    if (memberCard.expiryDate) {
      if (!parseDateOnly(memberCard.expiryDate)) {
        const e = new Error('Ngày hết hạn trên thẻ không hợp lệ');
        e.status = 403; throw e;
      }
      const today = fmtToday();
      if (daysDiff(today, memberCard.expiryDate) < 0) {
        const e = new Error('Thẻ hội viên đã hết hạn, không được mượn.');
        e.status = 403; throw e;
      }
    }

    const cardTypeId = memberCard.cardTypeId || null;
    const cardType = cardTypeId ? await CardType.findByPk(cardTypeId, { transaction: t }) : null;

    if (!cardType || Number(cardType.canBorrowHome) !== 1) {
      const e = new Error('Loại thẻ độc giả hiện tại không cho phép mượn về (thẻ không hợp lệ hoặc không có quyền mượn)');
      e.status = 403; throw e;
    }

    const maxBorrowLimit = Number(cardType.maxBorrowLimit) || 0;
    const borrowDuration = Number(cardType.borrowDuration) || 0;

    if (maxBorrowLimit <= 0 || borrowDuration <= 0) {
      const e = new Error('Loại thẻ này không có quyền mượn (maxBorrowLimit hoặc borrowDuration không hợp lệ)');
      e.status = 403; throw e;
    }

    // --- Kiểm tra quota & điều kiện độc giả (chi tiết) ---
    const snap = await getReaderBorrowSnapshot(reader.readerId, t);
    const remaining = maxBorrowLimit - snap.activeCount;
    const requestedTotal = items.length;

    const blockingReasons = [];
    if (snap.overdueCount > 0) blockingReasons.push(`Có ${snap.overdueCount} quyển trễ hạn chưa trả`);
    if (snap.unresolvedViolationCount > 0) blockingReasons.push(`Có ${snap.unresolvedViolationCount} vi phạm/chứng từ phạt chưa giải quyết`);

    if (blockingReasons.length) {
      const e = new Error('Độc giả chưa đủ điều kiện mượn');
      e.status = 409;
      e.details = {
        message: 'Độc giả chưa đủ điều kiện mượn',
        breakdown: {
          pendingApprovalCount: snap.pendingApprovalCount,
          waitingForPickupCount: snap.waitingForPickupCount,
          borrowingCount: snap.borrowingCount,
          overdueCount: snap.overdueCount,
          unresolvedViolationCount: snap.unresolvedViolationCount,
          quota: { max: maxBorrowLimit, using: snap.activeCount, remaining: Math.max(0, remaining), requested: requestedTotal }
        },
        reasons: blockingReasons
      };
      throw e;
    }

    if (remaining <= 0 || requestedTotal > remaining) {
      const e = new Error('Vượt quá hạn mức mượn');
      e.status = 409;
      e.details = {
        message: 'Vượt quá hạn mức mượn',
        breakdown: {
          pendingApprovalCount: snap.pendingApprovalCount,
          waitingForPickupCount: snap.waitingForPickupCount,
          borrowingCount: snap.borrowingCount,
          overdueCount: snap.overdueCount,
          unresolvedViolationCount: snap.unresolvedViolationCount,
          quota: { max: maxBorrowLimit, using: snap.activeCount, remaining: Math.max(0, remaining), requested: requestedTotal }
        },
        hint: `Bạn chỉ có thể mượn thêm tối đa ${Math.max(0, remaining)} tài liệu.`
      };
      throw e;
    }

    // Kiểm tra từng tài liệu (bỏ hoàn toàn logic deposit)
    const detailPreview = [];

    for (const it of items) {
      const detail = await getDocumentDetailWithDeposit(it.documentId);
      if (!detail) {
        const e = new Error(`Không tìm thấy tài liệu #${it.documentId}`);
        e.statusCode = 404;
        throw e;
      }

      // ====== SOFT-HOLD: kiểm tra tồn kho hiệu dụng (AVAILABLE - PENDING holds) ======
      const available = await DocumentCopy.count({
        where: { documentId: it.documentId, deleted: false, status: 'AVAILABLE' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

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

      detailPreview.push({
        documentId: detail.documentId,
        title: detail.title,
        quantity: 1, // luôn 1
      });
    }

    // Tạo LoanSlip ở trạng thái PENDING
    const slip = await LoanSlip.create(
      {
        readerId: reader.readerId,
        librarianId: null, // sẽ set khi duyệt
        loanDate: new Date(),
        dueDate: null, // sẽ set khi duyệt
        status: 'PENDING', // chờ duyệt
        borrowForm: 'RESERVATION', // kiểu đặt mượn
        addressForm: null,
        note: payload?.note || null,
        deleted: false,
      },
      { transaction: t }
    );

    // Tạo LoanDetail: mỗi tài liệu 1 dòng (tag REQUEST_DOCUMENT_ID để soft-hold tiếp theo)
    for (const it of detailPreview) {
      await LoanDetail.create(
        {
          loanSlipId: slip.loanSlipId,
          documentCopyId: null, // sẽ gán khi thủ thư duyệt
          returnDate: null,
          status: 'PENDING',
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
      summary: {
        currentlyBorrowing: snap.borrowingCount,
        requestedTotal,
        remainingAfterReserve: remaining - requestedTotal,
      },
      message: 'Đặt mượn thành công. Phiếu đang chờ thủ thư duyệt.'
    };
  } catch (err) {
    await t.rollback();
    if (err.statusCode || err.status) throw err;
    const e = new Error(err.message || 'Không thể đặt mượn trước');
    e.statusCode = 500;
    throw e;
  }
}

module.exports = { reserveLoanForReaderService };
