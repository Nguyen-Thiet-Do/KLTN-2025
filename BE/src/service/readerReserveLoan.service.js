// src/service/readerReserveLoan.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  LoanSlip,
  LoanDetail,
  Reader,
  DocumentCopy,
  Violation,
  Payment,
  MemberCard,
  CardType,
  Account,
  Notification,

} = require('../model');
const { cancelReservationService } = require('./adminLoanSlip.service');

const { emitToUser } = require('../config/socket');
const mailService = require('./mailService');
const { getDocumentDetailWithDeposit } = require('./documentService');

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
 * Snapshot tình trạng mượn của độc giả
 */
async function getReaderBorrowSnapshot(readerId, t) {
  const today = fmtToday();

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
 * Helper kiểm tra quota mượn sách
 */
async function ensureReaderBorrowQuota({
  readerId,
  cardType,
  transaction: t,
  extraRequested = 0,
  checkOverdueAndViolation = false,
  context = ''
}) {
  if (!cardType) {
    const e = new Error('Không tìm thấy loại thẻ độc giả');
    e.status = 500;
    throw e;
  }

  const maxBorrowLimit = Number(cardType.maxBorrowLimit) || 0;
  if (maxBorrowLimit <= 0) {
    const e = new Error('Bạn cần có thẻ thư viện để mượn sách');
    e.status = 403;
    throw e;
  }

  const snap = await getReaderBorrowSnapshot(readerId, t);

  const currentTotal =
    (snap.pendingApprovalCount || 0) +
    (snap.waitingForPickupCount || 0) +
    (snap.borrowingCount || 0);

  const requested = Number(extraRequested) || 0;
  const remaining = maxBorrowLimit - currentTotal;

  const blockingReasons = [];

  if (checkOverdueAndViolation) {
    if (snap.overdueCount > 0) {
      blockingReasons.push(`Có ${snap.overdueCount} quyển trễ hạn chưa trả`);
    }
    if (snap.unresolvedViolationCount > 0) {
      blockingReasons.push(`Có ${snap.unresolvedViolationCount} vi phạm/chứng từ phạt chưa giải quyết`);
    }
  }

  if (blockingReasons.length) {
    const e = new Error('Độc giả chưa đủ điều kiện mượn');
    e.status = 409;
    e.details = {
      message: 'Độc giả chưa đủ điều kiện mượn',
      context,
      breakdown: {
        maxBorrowLimit,
        pendingApprovalCount: snap.pendingApprovalCount,
        waitingForPickupCount: snap.waitingForPickupCount,
        borrowingCount: snap.borrowingCount,
        overdueCount: snap.overdueCount,
        unresolvedViolationCount: snap.unresolvedViolationCount,
        quota: {
          max: maxBorrowLimit,
          using: currentTotal,
          remaining: Math.max(0, remaining),
          requested
        }
      },
      reasons: blockingReasons
    };
    throw e;
  }

  if (requested > 0) {
    if (remaining <= 0 || requested > remaining) {
      const e = new Error('Vượt quá hạn mức mượn');
      e.status = 409;
      e.details = {
        message: 'Vượt quá hạn mức mượn',
        context,
        breakdown: {
          maxBorrowLimit,
          pendingApprovalCount: snap.pendingApprovalCount,
          waitingForPickupCount: snap.waitingForPickupCount,
          borrowingCount: snap.borrowingCount,
          overdueCount: snap.overdueCount,
          unresolvedViolationCount: snap.unresolvedViolationCount,
          quota: {
            max: maxBorrowLimit,
            using: currentTotal,
            remaining: Math.max(0, remaining),
            requested
          }
        },
        hint: `Bạn chỉ có thể mượn thêm tối đa ${Math.max(0, remaining)} tài liệu.`
      };
      throw e;
    }
  } else {
    if (currentTotal > maxBorrowLimit) {
      const e = new Error('Vượt quá số sách tối đa cho phép theo loại thẻ');
      e.status = 409;
      e.details = {
        message: 'Vượt quá số sách tối đa cho phép',
        context,
        breakdown: {
          maxBorrowLimit,
          pendingApprovalCount: snap.pendingApprovalCount,
          waitingForPickupCount: snap.waitingForPickupCount,
          borrowingCount: snap.borrowingCount,
          overdueCount: snap.overdueCount,
          unresolvedViolationCount: snap.unresolvedViolationCount,
          totalUsing: currentTotal
        }
      };
      throw e;
    }
  }

  return { snap, maxBorrowLimit, currentTotal, remaining };
}

/**
 * Helper: Kiểm tra các tài liệu đã có trong phiếu mượn hiện tại của độc giả
 * Trả về: { duplicates: Array<{ documentId, title, slipId, status, statusText }> }
 */
async function checkExistingDocuments(readerId, documentIds, transaction) {
  const duplicates = [];

  // Lấy tất cả phiếu mượn đang active (PENDING, WAITING_FOR_PICKUP, BORROWING)
  const activeSlips = await LoanSlip.findAll({
    where: {
      readerId,
      deleted: false,
      status: { [Op.in]: ['PENDING', 'WAITING_FOR_PICKUP', 'BORROWING'] } // ✅
    },
    attributes: ['loanSlipId', 'status'],
    include: [{
      model: LoanDetail,
      as: 'details',   // ✅ ĐÚNG alias với model/index.js
      where: {
        status: { [Op.in]: ['PENDING', 'WAITING_FOR_PICKUP', 'BORROWED'] } // ✅
      },
      attributes: ['loanDetailId', 'documentCopyId', 'note', 'status'],
      required: true
    }],
    transaction
  });

  if (!activeSlips.length) {
    return { duplicates };
  }

  const statusTextMap = {
    PENDING: 'đang chờ duyệt',
    WAITING_FOR_PICKUP: 'đang chờ bạn đến lấy',
    BORROWED: 'đang mượn'
  };

  const slipStatusTextMap = {
    PENDING: 'đang chờ duyệt',
    WAITING_FOR_PICKUP: 'đang chờ đến lấy',
    BORROWING: 'đang mượn'
  };

  const checkDocIds = new Set(documentIds.map(id => Number(id)));

  for (const slip of activeSlips) {
    for (const detail of slip.details || []) {   // ✅ dùng đúng alias 'details'
      let docId = null;

      if (detail.documentCopyId) {
        const copy = await DocumentCopy.findByPk(detail.documentCopyId, {
          attributes: ['documentId'],
          transaction
        });
        if (copy) docId = copy.documentId;
      }

      if (!docId && detail.note) {
        const match = detail.note.match(/REQUEST_DOCUMENT_ID=(\d+)/);
        if (match) docId = Number(match[1]);
      }

      if (docId && checkDocIds.has(docId)) {
        let title = `Tài liệu #${docId}`;
        try {
          const doc = await getDocumentDetailWithDeposit(docId);
          if (doc && doc.title) title = doc.title;
        } catch (e) {
          // ignore
        }

        duplicates.push({
          documentId: docId,
          title,
          slipId: slip.loanSlipId,
          status: slip.status,
          statusText: slipStatusTextMap[slip.status] || slip.status,
          detailStatus: detail.status,
          detailStatusText: statusTextMap[detail.status] || detail.status
        });
      }
    }
  }

  return { duplicates };
}


/**
 * Đặt mượn trước (Reader)
 */
async function reserveLoanForReaderService(user, payload) {
  const t = await sequelize.transaction();

  let quotaSnap = null;
  let quotaRemaining = 0;
  let quotaCurrentTotal = 0;
  let quotaMaxBorrowLimit = 0;
  let requestedTotal = 0;

  try {
    if (!user || user.roleId !== 3) {
      const e = new Error('Chỉ độc giả mới được đặt mượn trước');
      e.statusCode = 403;
      throw e;
    }

    const reader = await Reader.findOne({
      where: { accountId: user.accountId, deleted: false },
      attributes: ['readerId', 'fullName', 'accountId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!reader) {
      const e = new Error('Không tìm thấy tài khoản độc giả');
      e.statusCode = 404;
      throw e;
    }

    // Chuẩn hoá items
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
      items.push({ documentId: id });
    }

    if (items.length === 0) {
      const e = new Error('Danh sách sách mượn không hợp lệ');
      e.statusCode = 400;
      throw e;
    }

    requestedTotal = items.length;

    // ========== KIỂM TRA TÀI LIỆU ĐÃ TỒN TẠI TRONG PHIẾU HIỆN TẠI ==========
    const documentIds = items.map(it => it.documentId);
    const { duplicates } = await checkExistingDocuments(reader.readerId, documentIds, t);

    if (duplicates.length > 0) {
      // Tạo thông báo chi tiết cho từng tài liệu trùng
      const duplicateMessages = duplicates.map(dup =>
        `"${dup.title}" đã có trong phiếu #${dup.slipId} (${dup.statusText})`
      );

      const e = new Error('Một số tài liệu đã có trong phiếu mượn hiện tại của bạn');
      e.statusCode = 400;
      e.details = {
        message: 'Các tài liệu sau đã có trong phiếu mượn của bạn',
        duplicates: duplicates,
        messages: duplicateMessages
      };
      throw e;
    }
    // ========================================================================

    // LẤY THẺ
    const memberCard = await MemberCard.findOne({
      where: { readerId: reader.readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!memberCard) {
      const e = new Error('Độc giả chưa có thẻ hội viên hợp lệ (MemberCard).');
      e.status = 403;
      throw e;
    }

    // Check expiry
    if (memberCard.expiryDate) {
      if (!parseDateOnly(memberCard.expiryDate)) {
        const e = new Error('Ngày hết hạn trên thẻ không hợp lệ');
        e.status = 403;
        throw e;
      }
      const today = fmtToday();
      if (daysDiff(today, memberCard.expiryDate) < 0) {
        const e = new Error('Thẻ hội viên đã hết hạn, không được mượn.');
        e.status = 403;
        throw e;
      }
    }

    const cardTypeId = memberCard.cardTypeId || null;
    const cardType = cardTypeId ? await CardType.findByPk(cardTypeId, { transaction: t }) : null;

    if (!cardType || Number(cardType.canBorrowHome) !== 1) {
      const e = new Error('Loại thẻ độc giả hiện tại không cho phép mượn về');
      e.status = 403;
      throw e;
    }

    const maxBorrowLimit = Number(cardType.maxBorrowLimit) || 0;
    const borrowDuration = Number(cardType.borrowDuration) || 0;

    if (maxBorrowLimit <= 0 || borrowDuration <= 0) {
      const e = new Error('Loại thẻ này không có quyền mượn');
      e.status = 403;
      throw e;
    }

    // SNAPSHOT + QUOTA
    const quotaInfo = await ensureReaderBorrowQuota({
      readerId: reader.readerId,
      cardType,
      transaction: t,
      extraRequested: requestedTotal,
      checkOverdueAndViolation: true,
      context: 'reserveLoanForReaderService'
    });

    quotaSnap = quotaInfo.snap;
    quotaRemaining = quotaInfo.remaining;
    quotaCurrentTotal = quotaInfo.currentTotal;
    quotaMaxBorrowLimit = quotaInfo.maxBorrowLimit;

    // Check từng tài liệu (đủ bản AVAILABLE)
    const detailPreview = [];
    for (const it of items) {
      const detail = await getDocumentDetailWithDeposit(it.documentId);
      if (!detail) {
        const e = new Error(`Không tìm thấy tài liệu #${it.documentId}`);
        e.statusCode = 404;
        throw e;
      }

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

      detailPreview.push({
        documentId: detail.documentId,
        title: detail.title,
        quantity: 1
      });
    }

    // Tạo LoanSlip
    const slip = await LoanSlip.create(
      {
        readerId: reader.readerId,
        librarianId: null,
        loanDate: new Date(),
        dueDate: null,
        status: 'PENDING',
        borrowForm: 'RESERVATION',
        addressForm: null,
        note: payload?.note || null,
        deleted: false,
      },
      { transaction: t }
    );

    // Tạo LoanDetail
    for (const it of detailPreview) {
      await LoanDetail.create(
        {
          loanSlipId: slip.loanSlipId,
          documentCopyId: null,
          returnDate: null,
          status: 'PENDING',
          fineAmount: 0,
          renewalCount: 0,
          note: `REQUEST_DOCUMENT_ID=${it.documentId}`,
        },
        { transaction: t }
      );
    }

    await t.commit();

    // TẠO NOTIFICATION
    let createdNotification = null;
    try {
      const notifTitle = `Đặt mượn thành công — Phiếu #${slip.loanSlipId}`;
      const notifContent = `Phiếu đặt mượn #${slip.loanSlipId} của bạn đã được tạo và chờ thủ thư duyệt. Số lượng: ${detailPreview.length}.`;
      createdNotification = await Notification.create({
        readerId: reader.readerId,
        type: 'reservation',
        title: notifTitle,
        content: notifContent,
        priority: 'normal',
        link: `/loan/${slip.loanSlipId}`,
        isRead: 0,
        emailAt: null,
        deleted: false,
      });
    } catch (err) {
      console.error('❌ Failed to create Notification record:', err.message || err);
    }

    // EMIT SOCKET
    try {
      if (createdNotification && createdNotification.notificationID) {
        emitToUser(reader.readerId, "notification:new", {
          notificationID: createdNotification.notificationID,
          title: createdNotification.title,
          content: createdNotification.content,
        });
      }
    } catch (err) {
      console.error("❌ Socket emit failed:", err);
    }

    // GỬI EMAIL
    setImmediate(async () => {
      try {
        let readerEmail = null;

        try {
          if (reader.accountId) {
            const account = await Account.findByPk(reader.accountId);
            if (account && account.email) readerEmail = account.email;
          }
        } catch { }

        if (!readerEmail) {
          const r2 = await Reader.findByPk(reader.readerId);
          if (r2 && r2.accountId) {
            const a2 = await Account.findByPk(r2.accountId);
            if (a2 && a2.email) readerEmail = a2.email;
          }
        }

        if (!readerEmail) {
          console.warn('⚠️ Reader email not found — skipping reservation confirmation email.');
          return;
        }

        const mailItems = detailPreview.map(d => ({ documentId: d.documentId, title: d.title }));

        const remainingAfterReserveMail = Math.max(
          0,
          quotaMaxBorrowLimit - (quotaCurrentTotal + requestedTotal)
        );

        const mailData = {
          fullName: reader.fullName || '',
          slipId: slip.loanSlipId,
          items: mailItems,
          requestedTotal: detailPreview.length,
          remainingAfterReserve: remainingAfterReserveMail,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@booktechv2.net',
          supportPhone: process.env.SUPPORT_PHONE || '0123-456-789',
          year: new Date().getFullYear()
        };

        await mailService.sendReservationConfirmationEmail(readerEmail, mailData);

        try {
          if (createdNotification && createdNotification.notificationID) {
            await Notification.update(
              { emailAt: new Date() },
              { where: { notificationID: createdNotification.notificationID } }
            );
          }
        } catch (updErr) {
          console.error('❌ Failed to update Notification.emailAt:', updErr.message || updErr);
        }

      } catch (err) {
        console.error('❌ Failed to send reservation email:', err.message || err);
      }
    });

    const remainingAfterReserve = quotaRemaining - requestedTotal;

    return {
      slip: {
        loanSlipId: slip.loanSlipId,
        status: slip.status,
        reader: { readerId: reader.readerId, fullName: reader.fullName },
      },
      items: detailPreview,
      summary: {
        currentlyBorrowing: quotaSnap ? quotaSnap.borrowingCount : 0,
        requestedTotal,
        remainingAfterReserve,
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

/**
 * Độc giả gửi yêu cầu huỷ phiếu / huỷ 1 dòng trong phiếu
 * - PENDING:
 *      + Không có loanDetailId  -> huỷ thẳng cả phiếu (dùng cancelReservationService)
 *      + Có loanDetailId        -> huỷ 1 LoanDetail PENDING; nếu phiếu rỗng thì huỷ luôn phiếu
 * - WAITING_FOR_PICKUP:
 *      + Không có loanDetailId  -> chỉ ghi yêu cầu huỷ vào slip.note
 *      + Có loanDetailId        -> ghi yêu cầu huỷ vào cả LoanDetail.note và slip.note
 */
async function readerRequestCancelLoanSlipService(user, payload) {
  const { loanSlipId, reason, loanDetailId } = payload || {};

  // Chỉ cho độc giả (roleId = 3)
  if (!user || user.roleId !== 3) {
    const e = new Error('Chỉ độc giả mới được gửi yêu cầu huỷ phiếu');
    e.status = 403;
    throw e;
  }

  const slipId = Number(loanSlipId);
  if (!slipId) {
    const e = new Error('loanSlipId không hợp lệ');
    e.status = 400;
    throw e;
  }

  const detailId = loanDetailId ? Number(loanDetailId) : null;

  // Tìm reader theo account
  const reader = await Reader.findOne({
    where: { accountId: user.accountId, deleted: false },
    attributes: ['readerId', 'fullName', 'accountId'],
  });

  if (!reader) {
    const e = new Error('Không tìm thấy tài khoản độc giả');
    e.status = 404;
    throw e;
  }

  // Tìm phiếu thuộc về reader này
  const slip = await LoanSlip.findOne({
    where: { loanSlipId: slipId, readerId: reader.readerId, deleted: false },
    attributes: ['loanSlipId', 'status', 'note'],
  });

  if (!slip) {
    const e = new Error('Không tìm thấy phiếu mượn của bạn');
    e.status = 404;
    throw e;
  }

  const status = String(slip.status || '').toUpperCase();
  const reasonText = (reason || '').trim();

  // ======================
  // CASE 1: PENDING
  // ======================
  if (status === 'PENDING') {
    // ----- 1A. Có loanDetailId -> huỷ 1 dòng trong phiếu -----
    if (detailId) {
      return await sequelize.transaction(async (t) => {
        // Load lại slip trong transaction (lock)
        const txSlip = await LoanSlip.findOne({
          where: { loanSlipId: slipId, readerId: reader.readerId, deleted: false },
          attributes: ['loanSlipId', 'note'],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!txSlip) {
          const e = new Error('Không tìm thấy phiếu mượn của bạn (trong transaction)');
          e.status = 404;
          throw e;
        }

        // Tìm LoanDetail cần huỷ (PENDING & chưa gán copy)
        const detail = await LoanDetail.findOne({
          where: {
            loanSlipId: txSlip.loanSlipId,
            loanDetailId: detailId,
            status: 'PENDING',
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!detail) {
          const e = new Error('Không tìm thấy dòng mượn PENDING phù hợp để huỷ');
          e.status = 404;
          throw e;
        }

        // Xoá detail
        await detail.destroy({ transaction: t });

        // Đếm lại số detail còn lại
        const remainingCount = await LoanDetail.count({
          where: { loanSlipId: txSlip.loanSlipId },
          transaction: t,
        });

        // Nếu không còn chi tiết nào -> huỷ luôn phiếu (dùng cancelReservationService)
        if (remainingCount === 0) {
          const finalReason =
            reasonText ||
            `Độc giả huỷ chi tiết cuối cùng #${detailId}, phiếu được huỷ toàn bộ.`;

          // Gọi lại service admin (ngoài transaction hiện tại để tránh nested tx phức tạp)
          await t.commit();

          const result = await cancelReservationService({
            loanSlipId: txSlip.loanSlipId,
            reason: finalReason,
            librarianId: null, // huỷ do độc giả
          });

          return {
            success: true,
            cancelled: true,
            slipId: txSlip.loanSlipId,
            removedLoanDetailId: detailId,
            mode: 'AUTO_CANCEL_PENDING_AFTER_LAST_DETAIL_REMOVED',
            message:
              result?.message ||
              'Đã huỷ chi tiết cuối cùng và huỷ luôn phiếu đặt trước.',
          };
        }

        // Nếu vẫn còn chi tiết -> chỉ huỷ 1 dòng, ghi note vào LoanSlip
        const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const prefix = `[READER_CANCEL_DETAIL ${stamp}]`;

        const newNote =
          (txSlip.note ? txSlip.note + '\n' : '') +
          `${prefix} loanDetailId=${detailId}; ${reasonText || '(không ghi lý do)'}`;

        await LoanSlip.update(
          { note: newNote },
          { where: { loanSlipId: txSlip.loanSlipId }, transaction: t }
        );

        return {
          success: true,
          cancelled: false,
          slipId: txSlip.loanSlipId,
          removedLoanDetailId: detailId,
          mode: 'REMOVE_DETAIL_PENDING',
          message: 'Đã huỷ 1 tài liệu khỏi phiếu đặt trước.',
        };
      });
    }

    // ----- 1B. Không có loanDetailId -> huỷ thẳng cả phiếu (giống cũ) -----
    const finalReason =
      reasonText || 'Độc giả yêu cầu huỷ phiếu đặt trước.';

    const result = await cancelReservationService({
      loanSlipId: slip.loanSlipId,
      reason: finalReason,
      librarianId: null, // huỷ do độc giả
    });

    return {
      success: true,
      cancelled: true,
      slipId: slip.loanSlipId,
      mode: 'AUTO_CANCEL_PENDING',
      message: result?.message || 'Phiếu đặt trước đã được huỷ thành công.',
    };
  }

  // ==========================================
  // CASE 2: WAITING_FOR_PICKUP -> CHỈ GHI NOTE
  // ==========================================
  if (status === 'WAITING_FOR_PICKUP') {
    return await sequelize.transaction(async (t) => {
      const txSlip = await LoanSlip.findOne({
        where: { loanSlipId: slipId, readerId: reader.readerId, deleted: false },
        attributes: ['loanSlipId', 'note'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!txSlip) {
        const e = new Error('Không tìm thấy phiếu mượn của bạn (trong transaction)');
        e.status = 404;
        throw e;
      }

      const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Nếu có loanDetailId -> ghi yêu cầu huỷ riêng cho 1 dòng
      if (detailId) {
        const detail = await LoanDetail.findOne({
          where: {
            loanSlipId: txSlip.loanSlipId,
            loanDetailId: detailId,
            status: 'WAITING_FOR_PICKUP',
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!detail) {
          const e = new Error(
            'Không tìm thấy dòng mượn đang chờ đến lấy để yêu cầu huỷ.'
          );
          e.status = 404;
          throw e;
        }

        const detailPrefix = `[READER_CANCEL_REQUEST ${stamp}]`;
        const newDetailNote =
          (detail.note ? detail.note + '\n' : '') +
          `${detailPrefix} ${reasonText || '(không ghi lý do)'}`;

        await LoanDetail.update(
          { note: newDetailNote },
          { where: { loanDetailId: detail.loanDetailId }, transaction: t }
        );

        const slipPrefix = `[READER_CANCEL_DETAIL_REQUEST ${stamp}]`;
        const slipNoteLine =
          `${slipPrefix} loanDetailId=${detailId}; ${reasonText || '(không ghi lý do)'}`;

        const newSlipNote =
          (txSlip.note ? txSlip.note + '\n' : '') + slipNoteLine;

        await LoanSlip.update(
          { note: newSlipNote },
          { where: { loanSlipId: txSlip.loanSlipId }, transaction: t }
        );

        return {
          success: true,
          cancelled: false,
          slipId: txSlip.loanSlipId,
          requestedLoanDetailId: detailId,
          mode: 'REQUEST_CANCEL_DETAIL_WAITING_FOR_PICKUP',
          message:
            'Đã ghi nhận yêu cầu huỷ 1 tài liệu trong phiếu chờ đến lấy. Thủ thư sẽ xem xét và xử lý.',
        };
      }

      // Không có loanDetailId -> yêu cầu huỷ cả phiếu (nhưng chỉ ở mức request)
      const prefix = `[READER_CANCEL_REQUEST ${stamp}]`;
      const newNote =
        (txSlip.note ? txSlip.note + '\n' : '') +
        `${prefix} ${reasonText || '(không ghi lý do)'}`;

      await LoanSlip.update(
        { note: newNote },
        { where: { loanSlipId: txSlip.loanSlipId }, transaction: t }
      );

      return {
        success: true,
        cancelled: false,
        slipId: txSlip.loanSlipId,
        mode: 'REQUEST_ONLY_WAITING_FOR_PICKUP',
        message:
          'Phiếu đang chờ đến lấy, bạn không thể tự huỷ trực tiếp. ' +
          'Yêu cầu huỷ đã được ghi lại, thủ thư sẽ xem xét và xử lý.',
      };
    });
  }

  // ======================
  // CÁC TRẠNG THÁI KHÁC
  // ======================
  if (status === 'BORROWING') {
    const e = new Error(
      'Phiếu đang trong trạng thái đang mượn, không thể huỷ. Vui lòng trả sách nếu không còn nhu cầu.'
    );
    e.status = 409;
    throw e;
  }

  if (status === 'RETURNED') {
    const e = new Error('Phiếu đã hoàn tất, không cần huỷ.');
    e.status = 409;
    throw e;
  }

  if (status === 'CANCELLED') {
    const e = new Error('Phiếu này đã bị huỷ trước đó.');
    e.status = 409;
    throw e;
  }

  const e = new Error(
    `Không hỗ trợ huỷ phiếu ở trạng thái hiện tại: ${slip.status}`
  );
  e.status = 409;
  throw e;
}


module.exports = {
  reserveLoanForReaderService,
  getReaderBorrowSnapshot,
  checkExistingDocuments, // export để có thể dùng ở nơi khác nếu cần
  readerRequestCancelLoanSlipService
};