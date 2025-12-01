// src/service/adminLoanSlip.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const mailService = require('./mailService');
const { emitToUser } = require('../config/socket');
const payosService = require('./payosService');

const {
  LoanSlip,
  LoanDetail,
  Reader,
  Librarian,
  DocumentCopy,
  Document,
  Payment,
  CardType,
  MemberCard,
  Notification,
  Account,
  Violation
} = require('../model');

const MAX_ITEMS_PER_SLIP = 3;

/** Helpers: xử lý ngày */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str || ''))) return null;
  const d = new Date(`${str}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtToday() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysDateOnly(dateStr, days) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  const nd = new Date(d.getTime() + days * ONE_DAY_MS);
  return nd.toISOString().slice(0, 10);
}
function daysDiff(a, b) {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return NaN;
  return Math.round((db.getTime() - da.getTime()) / ONE_DAY_MS);
}
function sanitizeBorrowCondition(s) {
  if (s == null) return null;
  const v = String(s).trim();
  if (!v) return null;
  if (v.length > 100) {
    const e = new Error('conditionBorrow quá dài (tối đa 100 ký tự)');
    e.status = 400; throw e;
  }
  return v;
}

/**
 * Snapshot tình trạng mượn của độc giả (để kiểm tra điều kiện/ quota)
 * - "waitingForPickupCount" đếm LoanDetail.status === 'WAITING_FOR_PICKUP'
 */
async function getReaderBorrowSnapshot(readerId, t) {
  const today = fmtToday();

  // 1) Đếm "chờ duyệt" (slip PENDING, detail PENDING - chưa được gán bản sao)
  const pendingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: 'PENDING' },
    attributes: ['loanSlipId'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const pendingSlipIds = pendingSlips.map(s => s.loanSlipId);

  const pendingApprovalCount = pendingSlipIds.length
    ? await LoanDetail.count({
      where: { loanSlipId: pendingSlipIds, status: 'PENDING' },
      transaction: t
    })
    : 0;

  // 2) Đếm "chờ độc giả đến lấy" (slip WAITING_FOR_PICKUP, detail WAITING_FOR_PICKUP)
  const waitingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: ['WAITING_FOR_PICKUP'] },
    attributes: ['loanSlipId'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const waitingSlipIds = waitingSlips.map(s => s.loanSlipId);

  const waitingForPickupCount = waitingSlipIds.length
    ? await LoanDetail.count({
      where: { loanSlipId: waitingSlipIds, status: 'WAITING_FOR_PICKUP' },
      transaction: t
    })
    : 0;

  // 3) Đếm "đang mượn" (slip BORROWING, detail BORROWED)
  const borrowingSlips = await LoanSlip.findAll({
    where: { readerId, deleted: false, status: 'BORROWING' },
    attributes: ['loanSlipId', 'dueDate'],
    transaction: t,
    lock: t?.LOCK?.UPDATE
  });
  const borrowingSlipIds = borrowingSlips.map(s => s.loanSlipId);

  const borrowingCount = borrowingSlipIds.length
    ? await LoanDetail.count({
      where: { loanSlipId: borrowingSlipIds, status: 'BORROWED' },
      transaction: t
    })
    : 0;

  // 4) Trễ hạn: slip.dueDate < today & LoanDetail BORROWED & returnDate IS NULL
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

  // 5) Vi phạm chưa giải quyết: lấy từ Violation, chỉ tính bản ghi chưa xử lý
  const unresolvedViolationCount = await Violation.count({
    where: {
      readerId,
      deleted: false,
      paymentStatus: { [Op.ne]: 'PAID' }   // ❗ nếu đã PAID thì không tính là vi phạm
    },
    transaction: t
  });


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
 * Helper kiểm tra quota mượn sách theo loại thẻ của độc giả.
 *
 * - Luôn dùng snapshot: pendingApprovalCount + waitingForPickupCount + borrowingCount
 * - Nếu extraRequested > 0: kiểm tra tổng hiện tại + số mượn thêm
 * - Nếu extraRequested = 0: chỉ kiểm tra tổng hiện tại không vượt maxBorrowLimit
 * - Nếu checkOverdueAndViolation = true: chặn khi còn sách trễ hạn / vi phạm chưa xử lý
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

  // Lấy snapshot hiện tại
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

  // Nếu chặn do trễ hạn / vi phạm
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

  // Nếu có mượn thêm
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
    // Không mượn thêm, chỉ check tổng hiện tại
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

  // Không lỗi thì trả về thông tin cho ai cần dùng tiếp
  return { snap, maxBorrowLimit, currentTotal, remaining };
}

// ==============================
// HELPER: Chuẩn hóa librarianId (có thể là librarianId hoặc accountId)
// ==============================
async function resolveLibrarianIdFlexible(rawLibrarianId, t) {
  // Không truyền thì thôi, giữ nguyên hành vi cũ: để null
  if (!rawLibrarianId) return null;

  const idNum = Number(rawLibrarianId);
  if (!idNum) return null;

  // 1) Thử coi đây là librarianId thật
  let librarian = await Librarian.findByPk(idNum, {
    transaction: t
  });
  if (librarian) return librarian.librarianId;

  // 2) Nếu không có, coi là accountId, tìm librarian theo accountId
  librarian = await Librarian.findOne({
    where: { accountId: idNum, deleted: false },
    transaction: t
  });
  if (librarian) return librarian.librarianId;

  // 3) Không tìm được thì trả null (hoặc nếu bạn muốn chặt chẽ hơn có thể throw lỗi)
  return null;
}

/**
 * Lấy danh sách phiếu mượn
 */
async function getAllLoanSlipsService(query) {
  const {
    page = 1,
    limit = 10,
    status,
    readerId,
    librarianId,
    fromDate,
    toDate,
    sortBy = "updated_at", // sắp xếp theo ngày tạo mới nhất
    sortDir = "DESC",
  } = query;

  const where = { deleted: false };
  if (status) where.status = status;
  if (readerId) where.readerId = Number(readerId);
  if (librarianId) where.librarianId = Number(librarianId);

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
      { model: Reader, attributes: ["readerId", "fullName"] },
      { model: Librarian, attributes: ["librarianId", "fullName"] },

      {
        model: LoanDetail,
        as: "details",
        attributes: [
          "loanDetailId",
          "documentCopyId",
          "returnDate",
          "status",
          "fineAmount",
          "conditionBorrow",
          "conditionReturn",
          "renewalCount",
          "note",
        ],
        include: [
          {
            model: DocumentCopy,
            attributes: ["documentCopyId", "barCode"],
            include: [
              {
                model: Document,
                attributes: ["documentId", "title", "coverPhoto"],
              },
            ],
          },

          // 🔥 THÊM VI PHẠM CỦA MỖI BẢN GHI TRẢ
          {
            model: Violation,
            required: false,
            where: { deleted: false },
            attributes: [
              "violationId",
              "type",
              "severity",
              "violationDescription",
              "fineAmount",
              "paymentStatus",
              "created_at"
            ]
          },
        ],
      },
    ],
  });

  return {
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.count,
      totalPages: Math.ceil(result.count / Number(limit)),
    },
    data: result.rows,
  };
}


/**
 * Tạo notification một cách an toàn.
 * Nếu 'transaction' được truyền, nó sẽ thử tạo trong transaction nhưng sẽ không throw nếu lỗi.
 * Trả về object notification nếu tạo thành công, hoặc null nếu thất bại.
 *
 * data: { readerId, type, title, content, priority, link, extra }
 */
async function createNotificationSafe(data = {}, transaction = null) {
  if (!Notification) {
    console.warn('Notification model not available - skipping creating notification.');
    return null;
  }

  const payload = {
    readerId: data.readerId || null,
    type: data.type || 'INFO',
    title: data.title || '',
    content: data.content || '',
    priority: data.priority || 'NORMAL',
    link: data.link || null,
    isRead: data.isRead ? 1 : 0,
    // thêm các trường khác nếu DB của bạn có (emailAt, meta, etc.)
  };

  try {
    if (transaction) {
      // cố gắng tạo trong cùng transaction, nhưng bắt lỗi và trả null nếu fail
      const notif = await Notification.create(payload, { transaction });
      return notif;
    } else {
      const notif = await Notification.create(payload);
      return notif;
    }
  } catch (err) {
    // Bắt mọi lỗi, log để debug, nhưng không throw -> không rollback chính transaction
    console.warn('⚠️ createNotificationSafe failed:', err?.message || err);
    return null;
  }
}

/**
 * Gửi email thông báo mượn và cập nhật notification.emailAt nếu cần.
 * Không throw nếu gửi email lỗi — chỉ log.
 *
 * params:
 *  - to: email recipient
 *  - mailData: dữ liệu cho mailService.sendLoanIssuedEmail
 *  - notificationId: nếu có, cập nhật emailAt cho notification tương ứng
 */
async function safeSendLoanEmail(to, mailData = {}, notificationId = null) {
  if (!to) {
    console.warn('safeSendLoanEmail: no recipient provided, skipping email.');
    return { ok: false, reason: 'no-recipient' };
  }

  try {
    await mailService.sendLoanIssuedEmail(to, mailData);
    // nếu có notificationId, cập nhật trường emailAt (bắt lỗi cũng không throw)
    if (notificationId && Notification) {
      try {
        // Tùy tên khoá chính trong model của bạn (notificationID hoặc id)
        const pk = Notification.primaryKeyAttribute || 'notificationID';
        const where = {};
        where[pk] = notificationId;
        await Notification.update({ emailAt: new Date() }, { where });
      } catch (updErr) {
        console.warn('⚠️ safeSendLoanEmail: cannot update notification.emailAt', updErr?.message || updErr);
      }
    }
    return { ok: true };
  } catch (err) {
    console.error('❌ safeSendLoanEmail: send email failed:', err?.message || err);
    return { ok: false, reason: err?.message || 'send-failed' };
  }
}


// -----------------------
// FCM helper (paste vào cùng file)
// -----------------------
/**
 * NOTE:
 * - This helper lazy-requires fcm.service so you don't need to change top-level imports.
 * - All data values will be stringified because FCM requires string values in the data payload.
 */

function stringifyDataValuesForFcm(data = {}) {
  const out = {};
  for (const k of Object.keys(data || {})) {
    try {
      out[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
    } catch (e) {
      out[k] = String(data[k]);
    }
  }
  return out;
}

function buildFcmPayload({ title, body, data = {} } = {}) {
  const payload = {};
  if (title || body) payload.notification = { title: title || '', body: body || '' };
  const dataStr = stringifyDataValuesForFcm(data);
  if (Object.keys(dataStr).length) payload.data = dataStr;
  return payload;
}

/**
 * Send FCM to a list of accountIds.
 * Uses fcm.service.sendToAccounts which already implements "group by token and only latest owner" logic.
 * Returns the fcmService response object or an error object in the same shape: { success, results? | error? }.
 */
async function sendFcmToAccountIds(accountIds = [], payload = {}) {
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return { success: false, error: new Error('No accountIds provided') };
  }

  // lazy require to avoid top-level change
  let fcmService;
  try {
    fcmService = require('./fcm.service');
  } catch (e) {
    console.error('[FCM Helper] cannot require fcm.service:', e?.message || e);
    return { success: false, error: e };
  }

  try {
    const resp = await fcmService.sendToAccounts(accountIds, payload);
    return resp || { success: false, error: new Error('No response from fcmService') };
  } catch (err) {
    console.error('[FCM Helper] sendFcmToAccountIds error:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Send FCM to a readerId.
 * - Attempt to read reader.accountId first.
 * - If not present, try to find Account by readerId (fallback).
 * - If no accountId found, returns { success: false, message: 'NO_ACCOUNT_FOR_READER' }.
 *
 * Returns whatever sendFcmToAccountIds returns.
 */
async function sendFcmToReader(readerId, payload = {}) {
  if (!readerId) return { success: false, error: new Error('Missing readerId') };

  try {
    // Reader model is available in this file's scope
    const reader = await Reader.findByPk(readerId, { attributes: ['readerId', 'accountId'] });

    let accountId = reader?.accountId || null;

    // fallback: try find Account by readerId if your schema supports account.readerId relation
    if (!accountId) {
      try {
        const { Account } = require('../model');
        const acct = await Account.findOne({ where: { readerId }, attributes: ['accountId'] });
        accountId = acct?.accountId || null;
      } catch (e) {
        // ignore fallback errors
        console.warn('[FCM Helper] fallback Account lookup failed:', e?.message || e);
      }
    }

    if (!accountId) {
      console.warn(`[FCM Helper] No accountId found for readerId=${readerId} — skipping FCM`);
      return { success: false, message: 'NO_ACCOUNT_FOR_READER' };
    }

    // ensure payload.data values are strings (caller may pass already-built payload)
    if (payload && payload.data) {
      payload.data = stringifyDataValuesForFcm(payload.data);
    }

    const resp = await sendFcmToAccountIds([accountId], payload);
    return resp;
  } catch (err) {
    console.error('[FCM Helper] sendFcmToReader error:', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * HELPER: Tạo description cho Violation
 * - chỉ ghi những phần có phạt > 0
 */
function buildViolationDescription({ overdueDays, overdueFine, damageFine, lostFine }) {
  const parts = [];

  if (overdueFine > 0) {
    if (overdueDays && overdueDays > 0) {
      parts.push(`Muộn ${overdueDays} ngày: ${Number(overdueFine).toLocaleString('vi-VN')} VND`);
    } else {
      parts.push(`Phạt trễ: ${Number(overdueFine).toLocaleString('vi-VN')} VND`);
    }
  }

  if (damageFine > 0) {
    parts.push(`Hư hỏng: ${Number(damageFine).toLocaleString('vi-VN')} VND`);
  }

  if (lostFine > 0) {
    parts.push(`Mất sách: ${Number(lostFine).toLocaleString('vi-VN')} VND`);
  }

  return parts.join(', ');
}


/**
 * Tạo phiếu mượn -> TRỰC TIẾP BORROWING (mượn luôn)
 */

async function createLoanSlipService(body) {
  const {
    readerId,
    librarianId,
    loanDate,
    dueDate,
    items = [],
  } = body || {};

  if (!readerId || !librarianId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('Thiếu dữ liệu: readerId, librarianId, items');
    e.status = 400; throw e;
  }

  if (items.length > MAX_ITEMS_PER_SLIP) {
    const e = new Error(`Mỗi phiếu chỉ được mượn tối đa ${MAX_ITEMS_PER_SLIP} tài liệu`);
    e.status = 400; throw e;
  }

  const loanDateStr = loanDate || fmtToday();
  const loanD = parseDateOnly(loanDateStr);
  if (!loanD) {
    const e = new Error('Định dạng ngày hẹn trả không hợp lệ');
    e.status = 400; throw e;
  }

  const requestedCopyIds = items.map(i => Number(i.documentCopyId));
  const uniqueRequestedCopyIds = new Set(requestedCopyIds);
  if (uniqueRequestedCopyIds.size !== items.length) {
    const e = new Error('Danh sách tài liệu không được trùng lặp bản sao');
    e.status = 400; throw e;
  }

  // Kết quả tạm sau transaction
  let txResult = null;
  let createdNotification = null;

  // Transaction: tạo slip + loanDetail + update DocumentCopy -> BORROWED
  txResult = await sequelize.transaction(async (t) => {
    // load reader & librarian
    const [reader, librarian] = await Promise.all([
      Reader.findByPk(readerId, { transaction: t }),
      Librarian.findByPk(librarianId, { transaction: t }),
    ]);
    if (!reader) { const e = new Error('Không tìm thấy độc giả'); e.status = 404; throw e; }
    if (!librarian) { const e = new Error('Không tìm thấy thủ thư'); e.status = 404; throw e; }

    // memberCard
    const memberCard = await MemberCard.findOne({
      where: { readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!memberCard) {
      const e = new Error('Độc giả chưa có thẻ hội viên hợp lệ.');
      e.status = 403; throw e;
    }

    // kiểm tra expiry
    if (memberCard.expiryDate) {
      const expiry = parseDateOnly(memberCard.expiryDate);
      if (!expiry) {
        const e = new Error('Ngày hết hạn trên thẻ không hợp lệ');
        e.status = 403; throw e;
      }
      if (daysDiff(fmtToday(), memberCard.expiryDate) < 0) {
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
      const e = new Error('Loại thẻ này không có quyền mượn');
      e.status = 403; throw e;
    }

    // ====== CHECK QUOTA DÙNG HELPER ======
    // Rule: pendingApproval + waitingForPickup + borrowing + items.length <= maxBorrowLimit
    await ensureReaderBorrowQuota({
      readerId,
      cardType,
      transaction: t,
      extraRequested: items.length,
      checkOverdueAndViolation: true, // mượn trực tiếp phải sạch nợ
      context: 'createLoanSlipService',
    });
    // =====================================

    // load copies (phải AVAILABLE)
    const copyIds = requestedCopyIds;
    const copies = await DocumentCopy.findAll({
      where: { documentCopyId: copyIds },
      attributes: ['documentCopyId', 'documentId', 'status', 'conditionGrade', 'conditionNote'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (copies.length !== items.length) {
      const e = new Error('Có bản sao tài liệu không tồn tại');
      e.status = 400; throw e;
    }

    for (const c of copies) {
      const st = String(c.status || '').toUpperCase();
      if (st !== 'AVAILABLE') {
        const e = new Error(`Bản sao #${c.documentCopyId} không sẵn sàng (status="${c.status}")`);
        e.status = 400; throw e;
      }
    }

    // không cho mượn 2 bản sao cùng đầu sách
    const docIds = copies.map(c => Number(c.documentId));
    const uniqueDocIds = new Set(docIds);
    if (uniqueDocIds.size !== copies.length) {
      const e = new Error('Không được mượn 2 bản sao của cùng một đầu sách');
      e.status = 400; throw e;
    }

    // dueDate mặc định từ cardType nếu không truyền
    let finalDueDate = dueDate || addDaysDateOnly(loanDateStr, borrowDuration);
    const dueD = parseDateOnly(finalDueDate);
    if (!dueD) { const e = new Error('Định dạng ngày hẹn trả không hợp lệ'); e.status = 400; throw e; }
    const dd = daysDiff(loanDateStr, finalDueDate);
    if (!(dd > 0)) {
      const e = new Error('Hạn trả phải sau ngày mượn');
      e.status = 400; throw e;
    }

    // Tạo LoanSlip
    const slip = await LoanSlip.create({
      readerId,
      librarianId,
      loanDate: loanDateStr,
      dueDate: finalDueDate,
      status: 'BORROWING',
      deleted: false,
    }, { transaction: t });

    // Tạo LoanDetail + update DocumentCopy -> BORROWED
    for (const it of items) {
      const copyId = Number(it.documentCopyId);
      const condBorrow = sanitizeBorrowCondition(it.conditionBorrow);

      await LoanDetail.create({
        loanSlipId: slip.loanSlipId,
        documentCopyId: copyId,
        status: 'BORROWED',
        conditionBorrow: condBorrow,
        conditionReturn: null,
        returnDate: null,
        depositAmount: 0,
        fineAmount: 0,
      }, { transaction: t });

      await DocumentCopy.update(
        { status: 'BORROWED' },
        { where: { documentCopyId: copyId }, transaction: t }
      );
    }

    // Notification trong transaction (nếu fail => null)
    try {
      const notifData = {
        readerId,
        type: 'LOAN_ISSUED',
        title: `Phiếu mượn #${slip.loanSlipId} — Đã mượn`,
        content: `Phiếu mượn #${slip.loanSlipId} đã được tạo. Số lượng: ${items.length}. Hạn trả: ${finalDueDate}.`,
        priority: 'NORMAL',
        link: `/loan/${slip.loanSlipId}`,
        isRead: 0
      };
      createdNotification = await createNotificationSafe(notifData, t);
    } catch (err) {
      console.warn('⚠️ createLoanSlipService: createNotificationSafe failed', err?.message || err);
    }

    // lấy email độc giả (nếu có account)
    let readerEmail = null;
    try {
      if (reader.accountId) {
        const acct = await Account.findByPk(reader.accountId, {
          attributes: ['email'],
          transaction: t
        });
        readerEmail = acct?.email || null;
      }
    } catch (errEmail) {
      console.warn('⚠️ createLoanSlipService: cannot read reader email', errEmail?.message || errEmail);
    }

    return {
      loanSlip: slip,
      items,
      payment: null,
      message: 'Phiếu mượn được tạo và kích hoạt (BORROWING).',
      readerEmail,
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  }); // end transaction

  // Sau transaction
  const result = txResult;

  // nếu notification không tạo được trong tx, thử tạo lại ngoài tx (không throw)
  if (!result.notificationId) {
    try {
      const retryNotif = await createNotificationSafe({
        readerId,
        type: 'LOAN_ISSUED',
        title: `Phiếu mượn #${result.loanSlip.loanSlipId} — Đã mượn`,
        content: `Phiếu mượn #${result.loanSlip.loanSlipId} đã được tạo. Số lượng: ${items.length}. Hạn trả: ${result.loanSlip.dueDate}.`,
        priority: 'NORMAL',
        link: `/loan/${result.loanSlip.loanSlipId}`,
        isRead: 0
      }, null);
      if (retryNotif) {
        result.notificationId = retryNotif.notificationID || retryNotif.id || null;
      }
    } catch (errRetry) {
      console.warn('⚠️ createLoanSlipService: retry create notification failed', errRetry?.message || errRetry);
    }
  }

  // EMAIL
  try {
    const finalEmail = result.readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
    if (finalEmail) {
      let readerName = 'Độc giả';
      try {
        const r = await Reader.findByPk(readerId, { attributes: ['fullName'] });
        readerName = r?.fullName || readerName;
      } catch (e) { /* ignore */ }

      let itemsForMail = [];
      try {
        const loanDetails = await LoanDetail.findAll({
          where: { loanSlipId: result.loanSlip.loanSlipId },
          include: [
            {
              model: DocumentCopy,
              attributes: ['documentCopyId'],
              include: [{ model: Document, attributes: ['documentId', 'title'] }]
            }
          ]
        });

        itemsForMail = loanDetails.map(d => ({
          title: d.DocumentCopy?.Document?.title || null,
          documentId: d.DocumentCopy?.Document?.documentId || null,
          documentCopyId: d.documentCopyId || d.DocumentCopy?.documentCopyId || null
        }));
      } catch (errLd) {
        console.warn('⚠️ createLoanSlipService: cannot build itemsForMail', errLd?.message || errLd);
        itemsForMail = items.map(it => ({ title: null, documentId: null, documentCopyId: it.documentCopyId }));
      }

      await safeSendLoanEmail(finalEmail, {
        fullName: readerName,
        slipId: result.loanSlip.loanSlipId,
        items: itemsForMail,
        loanDate: loanDateStr,
        dueDate: result.loanSlip.dueDate,
        pickUpLocation: process.env.LIBRARY_ADDRESS,
        supportEmail: process.env.SUPPORT_EMAIL,
        supportPhone: process.env.SUPPORT_PHONE,
        libraryName: process.env.LIBRARY_NAME
      }, result.notificationId);
      console.log('✅ createLoanSlipService: attempted to send loan email to', finalEmail);
    } else {
      console.warn('⚠️ createLoanSlipService: no email available to notify', result.loanSlip.loanSlipId);
    }
  } catch (err) {
    console.error('❌ createLoanSlipService: unexpected error when sending email', err?.message || err);
  }

  // FCM
  try {
    const payload = buildFcmPayload({
      title: `Phiếu mượn #${result.loanSlip.loanSlipId} đã được tạo`,
      body: `Số lượng ${items.length}. Hạn trả: ${result.loanSlip.dueDate}.`,
      data: {
        type: 'LOAN_ISSUED',
        slipId: String(result.loanSlip.loanSlipId),
        dueDate: String(result.loanSlip.dueDate),
        itemsCount: String(items.length),
        notificationId: result.notificationId ? String(result.notificationId) : '',
        link: `/loan/${result.loanSlip.loanSlipId}`
      }
    });

    const fcmResp = await sendFcmToReader(readerId, payload);

    if (fcmResp && fcmResp.success) {
      console.log('✅ createLoanSlipService: FCM sent to reader', { readerId, respSummary: Array.isArray(fcmResp.results) ? fcmResp.results.length : true });
    } else {
      console.warn('⚠️ createLoanSlipService: FCM send failed or no tokens', { readerId, fcmResp });
    }
  } catch (fcmErr) {
    console.error('❌ createLoanSlipService: unexpected error when sending FCM', fcmErr?.message || fcmErr);
  }

  return {
    loanSlip: result.loanSlip,
    message: result.message,
    readerEmail: result.readerEmail || null,
    notificationId: result.notificationId || null
  };
}





/**
 * Duyệt phiếu đặt trước -> chuyển sang WAITING_FOR_PICKUP
 * (gán bản sao, đặt ON_HOLD; không có deposit)
 */
async function approveReservationService(payload) {
  const {
    loanSlipId,
    librarianId,
    dueDate,
    pricingMode = 'AUTO_MIN',
    assignments = [],
    conditions = [],
  } = payload || {};

  if (!loanSlipId || !librarianId) {
    const e = new Error('Thiếu loanSlipId hoặc librarianId');
    e.status = 400; throw e;
  }

  const parseRequestedDocId = (note) => {
    const m = String(note || '').match(/REQUEST_DOCUMENT_ID=(\d+)/);
    return m ? Number(m[1]) : null;
  };

  // prepare maps
  const assignMap = new Map(assignments.map(a => [Number(a.loanDetailId), Number(a.documentCopyId)]));
  const condMap = new Map(conditions.map(c => [Number(c.loanDetailId), sanitizeBorrowCondition(c.conditionBorrow)]));

  let txResult = null;
  let createdNotification = null;

  txResult = await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(Number(loanSlipId), { transaction: t, lock: t.LOCK.UPDATE });
    if (!slip) { const e = new Error('Không tìm thấy phiếu'); e.status = 404; throw e; }

    const status = String(slip.status || '').toUpperCase();
    if (status !== 'PENDING') {
      const e = new Error('Chỉ duyệt phiếu đang ở trạng thái PENDING');
      e.status = 409; throw e;
    }

    const pendingDetails = await LoanDetail.findAll({
      where: { loanSlipId: slip.loanSlipId, status: 'PENDING', documentCopyId: { [Op.is]: null } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!pendingDetails.length) {
      const e = new Error('Không có dòng mượn PENDING để gán bản sao');
      e.status = 400; throw e;
    }

    // Lấy reader để kiểm tra thẻ & email
    const reader = await Reader.findByPk(slip.readerId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!reader) {
      const e = new Error('Không tìm thấy độc giả');
      e.status = 404; throw e;
    }

    const memberCard = await MemberCard.findOne({
      where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
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
      const e = new Error('Loại thẻ độc giả không cho phép mượn về');
      e.status = 403; throw e;
    }

    const maxBorrowLimit = Number(cardType.maxBorrowLimit) || 0;
    const borrowDuration = Number(cardType.borrowDuration) || 0;

    if (maxBorrowLimit <= 0 || borrowDuration <= 0) {
      const e = new Error('Loại thẻ này không có quyền mượn');
      e.status = 403; throw e;
    }

    // ====== CHECK QUOTA DÙNG HELPER ======
    // Ở bước duyệt, số sách trong slip đã nằm trong snapshot (PENDING),
    // nên chỉ cần kiểm tra tổng (pending + waiting + borrowing) <= maxBorrowLimit
    await ensureReaderBorrowQuota({
      readerId: slip.readerId,
      cardType,
      transaction: t,
      extraRequested: 0,
      checkOverdueAndViolation: false, // nếu muốn chặn luôn khi trễ hạn thì đổi thành true
      context: 'approveReservationService',
    });
    // =====================================

    // Lấy email (nếu có)
    let readerEmail = null;
    if (reader.accountId) {
      const acc = await Account.findByPk(reader.accountId, { attributes: ['email'], transaction: t });
      readerEmail = acc?.email || null;
    }

    // Group pendingDetails theo requested documentId
    const groups = new Map(); // documentId -> LoanDetail[]
    for (const d of pendingDetails) {
      const docId = parseRequestedDocId(d.note);
      if (!docId) {
        const e = new Error(`LoanDetail #${d.loanDetailId} thiếu REQUEST_DOCUMENT_ID trong note`);
        e.status = 400; throw e;
      }
      if (!groups.has(docId)) groups.set(docId, []);
      groups.get(docId).push(d);
    }

    // Gán bản sao
    const chosenCopyIds = new Map(); // loanDetailId -> documentCopyId

    for (const [documentId, details] of groups.entries()) {
      // preset từ assignments
      const preset = details
        .filter(d => assignMap.has(d.loanDetailId))
        .map(d => ({ loanDetailId: d.loanDetailId, documentCopyId: assignMap.get(d.loanDetailId) }));

      if (preset.length) {
        const presetCopyIds = preset.map(x => x.documentCopyId);
        const presetCopies = await DocumentCopy.findAll({
          where: { documentCopyId: presetCopyIds, documentId, deleted: false },
          attributes: ['documentCopyId', 'status'],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (presetCopies.length !== preset.length) {
          const e = new Error(`Có DocumentCopyId không thuộc document #${documentId} hoặc không tồn tại`);
          e.status = 400; throw e;
        }
        for (const c of presetCopies) {
          if (String(c.status || '').toUpperCase() !== 'AVAILABLE') {
            const e = new Error(`Bản sao #${c.documentCopyId} không AVAILABLE`);
            e.status = 409; throw e;
          }
        }
        for (const p of preset) chosenCopyIds.set(p.loanDetailId, p.documentCopyId);
      }

      // tự chọn thêm nếu còn thiếu
      const needCount = details.length - preset.length;
      if (needCount > 0) {
        const excludeCopyIds = Array.from(chosenCopyIds.values());
        const availCopies = await DocumentCopy.findAll({
          where: {
            documentId,
            deleted: false,
            status: 'AVAILABLE',
            ...(excludeCopyIds.length ? { documentCopyId: { [Op.notIn]: excludeCopyIds } } : {})
          },
          order: [['documentCopyId', 'ASC']],
          limit: needCount,
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (availCopies.length < needCount) {
          const e = new Error(`Không đủ bản sao AVAILABLE cho tài liệu #${documentId}`);
          e.status = 409; throw e;
        }
        for (let i = 0; i < availCopies.length; i++) {
          const d = details[preset.length + i];
          chosenCopyIds.set(d.loanDetailId, availCopies[i].documentCopyId);
        }
      }
    }

    // dueDate: nếu không truyền => today + borrowDuration
    const today = fmtToday();
    let newDueDate = dueDate || addDaysDateOnly(today, borrowDuration);
    const dd = parseDateOnly(newDueDate);
    if (!dd) {
      const e = new Error('dueDate không hợp lệ (YYYY-MM-DD)');
      e.status = 400; throw e;
    }
    if (!(daysDiff(today, newDueDate) > 0)) {
      const e = new Error('Hạn trả phải sau ngày duyệt (today)');
      e.status = 400; throw e;
    }

    // Update LoanDetails & DocumentCopy
    for (const d of pendingDetails) {
      const copyId = chosenCopyIds.get(d.loanDetailId);
      if (!copyId) {
        const e = new Error(`Không tìm thấy bản sao gán cho LoanDetail #${d.loanDetailId}`);
        e.status = 500; throw e;
      }

      d.documentCopyId = copyId;
      d.status = 'WAITING_FOR_PICKUP';
      d.conditionBorrow = condMap.get(d.loanDetailId) || d.conditionBorrow || null;
      await d.save({ transaction: t });

      await DocumentCopy.update(
        { status: 'ON_HOLD' },
        { where: { documentCopyId: copyId }, transaction: t }
      );
    }

    slip.status = 'WAITING_FOR_PICKUP';
    slip.dueDate = newDueDate;
    slip.librarianId = librarianId;
    await slip.save({ transaction: t });

    // Notification trong tx
    const pickupDeadline = addDaysDateOnly(fmtToday(), 3);
    try {
      createdNotification = await createNotificationSafe({
        readerId: slip.readerId,
        type: 'RESERVATION_APPROVED',
        title: `Phiếu #${slip.loanSlipId} — Đã được duyệt, vui lòng đến nhận`,
        content: `Phiếu #${slip.loanSlipId} đã được duyệt. Vui lòng đến lấy trong vòng 3 ngày. Hạn nhận: ${pickupDeadline}.`,
        priority: 'NORMAL',
        link: `/loan/${slip.loanSlipId}`,
        isRead: 0
      }, t);
    } catch (err) {
      console.warn('⚠️ approveReservationService: createNotificationSafe failed', err?.message || err);
    }

    return {
      loanSlipId: slip.loanSlipId,
      readerId: slip.readerId,
      readerEmail,
      dueDate: newDueDate,
      assignedCopyMap: Array.from(chosenCopyIds.entries()).map(([loanDetailId, documentCopyId]) => ({ loanDetailId, documentCopyId })),
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  }); // end transaction

  // Nếu không có notification, thử tạo lại ngoài tx (không throw)
  if (!txResult.notificationId) {
    try {
      const pickupDeadline = addDaysDateOnly(fmtToday(), 3);
      const retryNotif = await createNotificationSafe({
        readerId: txResult.readerId,
        type: 'RESERVATION_APPROVED',
        title: `Phiếu #${txResult.loanSlipId} — Đã được duyệt, vui lòng đến nhận`,
        content: `Phiếu #${txResult.loanSlipId} đã được duyệt. Vui lòng đến lấy trong vòng 3 ngày. Hạn nhận: ${pickupDeadline}.`,
        priority: 'NORMAL',
        link: `/loan/${txResult.loanSlipId}`,
        isRead: 0
      }, null);
      if (retryNotif) {
        txResult.notificationId = retryNotif.notificationID || retryNotif.id || null;
      }
    } catch (errRetry) {
      console.warn('⚠️ approveReservationService: retry create notification failed', errRetry?.message || errRetry);
    }
  }

  // Gửi email
  try {
    const readerEmail = txResult.readerEmail;
    const finalEmail = readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;

    if (finalEmail) {
      const loanDetails = await LoanDetail.findAll({
        where: { loanSlipId: txResult.loanSlipId },
        include: [
          {
            model: DocumentCopy,
            attributes: ['documentCopyId'],
            include: [{ model: Document, attributes: ['documentId', 'title'] }]
          }
        ]
      });

      const items = loanDetails.map(d => ({
        loanDetailId: d.loanDetailId,
        documentId: d.DocumentCopy?.Document?.documentId || null,
        title: d.DocumentCopy?.Document?.title || null,
        documentCopyId: d.documentCopyId || d.DocumentCopy?.documentCopyId || null
      }));

      const pickupDeadline = addDaysDateOnly(fmtToday(), 3);

      let readerName = 'Độc giả';
      try {
        const rr = await Reader.findByPk(txResult.readerId, { attributes: ['fullName'] });
        readerName = rr?.fullName || readerName;
      } catch (e) { /* ignore */ }

      console.log(`📤 Sending reservation approval email for slip=${txResult.loanSlipId} to=${finalEmail}`);
      await mailService.sendReservationApprovedEmail(finalEmail, {
        fullName: readerName,
        slipId: txResult.loanSlipId,
        items,
        pickupDeadline,
        pickUpLocation: process.env.LIBRARY_ADDRESS || 'Thư viện',
        supportEmail: process.env.SUPPORT_EMAIL,
        supportPhone: process.env.SUPPORT_PHONE,
        libraryName: process.env.LIBRARY_NAME
      }, txResult.notificationId);
    } else {
      console.warn('⚠️ No email available to send reservation approval for loanSlipId', txResult.loanSlipId);
    }
  } catch (mailErr) {
    console.error('❌ Failed to send reservation approval email for loanSlipId', txResult.loanSlipId, mailErr?.message || mailErr);
  }

  // FCM
  try {
    const pickupDeadline = addDaysDateOnly(fmtToday(), 3);
    const payload = buildFcmPayload({
      title: `Phiếu #${txResult.loanSlipId} — Đã được duyệt, vui lòng đến nhận`,
      body: `Vui lòng đến lấy trong vòng 3 ngày. Hạn nhận: ${pickupDeadline}.`,
      data: {
        type: 'RESERVATION_APPROVED',
        slipId: String(txResult.loanSlipId),
        pickupDeadline,
        itemsCount: String((txResult.assignedCopyMap || []).length),
        notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
        link: `/loan/${txResult.loanSlipId}`
      }
    });

    const fcmResp = await sendFcmToReader(txResult.readerId, payload);
    if (fcmResp && fcmResp.success) {
      console.log('✅ approveReservationService: FCM sent to reader', { readerId: txResult.readerId });
    } else {
      console.warn('⚠️ approveReservationService: FCM send failed or no tokens', { readerId: txResult.readerId, fcmResp });
    }
  } catch (fcmErr) {
    console.error('❌ approveReservationService: unexpected error when sending FCM', fcmErr?.message || fcmErr);
  }

  // Socket
  try {
    let targetUserId = txResult.readerId;
    try {
      const acctRow = await Reader.findByPk(txResult.readerId, { attributes: ['accountId'] });
      if (acctRow?.accountId) targetUserId = acctRow.accountId;
    } catch (e) { /* ignore */ }

    const pickupDeadline = addDaysDateOnly(fmtToday(), 3);

    const socketData = {
      type: 'RESERVATION_APPROVED',
      slipId: String(txResult.loanSlipId),
      pickupDeadline,
      dueDate: txResult.dueDate,
      itemsCount: String((txResult.assignedCopyMap || []).length),
      notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
      link: `/loan/${txResult.loanSlipId}`
    };

    if (typeof emitToUser === 'function') {
      emitToUser(targetUserId, 'reservationApproved', socketData);
      console.log('✅ approveReservationService: Socket emitted to user', { targetUserId, socketData });
    } else {
      console.warn('⚠️ approveReservationService: emitToUser không khả dụng, bỏ qua emit socket');
    }
  } catch (socketErr) {
    console.error('❌ approveReservationService: failed to emit socket', socketErr?.message || socketErr);
  }

  return {
    message: 'Duyệt phiếu thành công. Phiếu đã chuyển sang WAITING_FOR_PICKUP (chờ độc giả đến lấy).',
    loanSlipId: txResult.loanSlipId,
    slipStatus: 'WAITING_FOR_PICKUP',
    notificationId: txResult.notificationId || null
  };
}






/** ---------------------------------------------
 *  Lấy danh sách bản sao có thể mượn (AVAILABLE)
 * --------------------------------------------- */
async function getBorrowableCopiesService(documentId, options = {}) {
  const docId = Number(documentId);
  if (!docId) { const e = new Error('documentId không hợp lệ'); e.status = 400; throw e; }

  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 20)));
  const offset = (page - 1) * limit;
  const { q, excludeCopyIds } = options;

  // Xác thực document tồn tại
  const doc = await Document.findByPk(docId, { attributes: ['documentId', 'deleted'] });
  if (!doc || doc.deleted) { const e = new Error('Không tìm thấy tài liệu'); e.status = 404; throw e; }

  const where = { documentId: docId, deleted: false, status: 'AVAILABLE' };

  if (Array.isArray(excludeCopyIds) && excludeCopyIds.length) {
    where.documentCopyId = { [Op.notIn]: excludeCopyIds.map(Number) };
  }
  if (q && String(q).trim()) {
    where.barCode = { [Op.like]: `%${q.trim()}%` };
  }

  const result = await DocumentCopy.findAndCountAll({
    where,
    limit,
    offset,
    order: [['documentCopyId', 'ASC']],
    attributes: ['documentCopyId', 'documentId', 'barCode', 'status'],
  });

  return {
    pagination: {
      page,
      limit,
      total: result.count,
      totalPages: Math.ceil(result.count / limit),
    },
    data: result.rows,
  };
}

/**
 * HELPERS: Tính tiền phạt trễ hạn
 */
function calculateOverdueFine(dueDate, returnDate) {
  const dueDateObj = parseDateOnly(dueDate);
  const returnDateObj = parseDateOnly(returnDate);

  if (!dueDateObj || !returnDateObj) return 0;

  const overdueDays = daysDiff(dueDate, returnDate);
  if (overdueDays <= 0) return 0;

  let fine = 0;

  if (overdueDays <= 7) {
    fine = overdueDays * 2000;
  } else if (overdueDays <= 15) {
    fine = 7 * 2000 + (overdueDays - 7) * 3000;
  } else {
    fine = 7 * 2000 + 8 * 3000 + (overdueDays - 15) * 5000;
  }

  return Math.min(fine, 50000);
}

// ==============================
// HELPER: Tính tiền phạt hư hỏng chỉ khi > 30%
// ==============================
function calculateDamageFine(conditionBorrow, conditionReturn, coverPrice) {
  const borrow = Number(conditionBorrow) || 100;
  const ret = Number(conditionReturn) || 100;
  const price = Number(coverPrice) || 0;

  // không hư hỏng
  if (ret >= borrow) return 0;

  const degradation = borrow - ret; // % giảm chất lượng

  // chỉ tính phạt khi giảm > 30%
  if (degradation <= 30) return 0;

  // tiền phạt = (degradation%) * giá bìa
  return Math.round((degradation / 100) * price);
}


/**
 * HELPER: Tính tiền bồi thường mất sách
 */
function calculateLostFine(coverPrice) {
  return Number(coverPrice) || 0;
}


/**
 * TRẢ TỪNG QUYỂN
 * - Dùng lại logic của returnBulkItemsService để:
 *   + Tính phạt (trễ, hư, mất)
 *   + Tạo Violation
 *   + Trừ thẻ / tạo QR PayOS
 * - Sau đó:
 *   + Nếu KHÔNG có QR (phạt đã xử xong, thường là trừ thẻ / không phạt):
 *       -> gửi notification LOAN_RETURNED + email biên nhận + FCM + socket loanReturned
 *   + Nếu CÓ QR PENDING:
 *       -> gửi email + FCM + socket VIOLATION (yêu cầu thanh toán phạt)
 *
 * body: { loanDetailId, returnDate, conditionReturn, isLost = false, note? }
 * rawLibrarianId: có thể là librarianId hoặc accountId (giống bulk)
 */
async function returnSingleItemService(body, rawLibrarianId) {
  const {
    loanDetailId,
    returnDate,
    conditionReturn,
    isLost = false,
    note
  } = body || {};

  if (!loanDetailId || !returnDate) {
    const e = new Error('Thiếu loanDetailId hoặc returnDate');
    e.status = 400;
    throw e;
  }

  const returnDateObj = parseDateOnly(returnDate);
  if (!returnDateObj) {
    const e = new Error('returnDate không đúng định dạng YYYY-MM-DD');
    e.status = 400;
    throw e;
  }

  // Nếu không mất sách thì bắt buộc conditionReturn 0-100
  if (!isLost) {
    const conditionNum = Number(conditionReturn);
    if (isNaN(conditionNum) || conditionNum < 0 || conditionNum > 100) {
      const e = new Error('conditionReturn phải là số từ 0-100');
      e.status = 400;
      throw e;
    }
  }

  // Lấy loanSlipId từ LoanDetail
  const detail = await LoanDetail.findByPk(loanDetailId, {
    attributes: ['loanDetailId', 'loanSlipId'],
    raw: true
  });

  if (!detail) {
    const e = new Error('Không tìm thấy LoanDetail');
    e.status = 404;
    throw e;
  }

  const loanSlipId = detail.loanSlipId;

  // 1) Gọi lại returnBulkItemsService với 1 item
  const result = await returnBulkItemsService(
    {
      loanSlipId,
      returnDate,
      items: [
        {
          loanDetailId,
          conditionReturn,
          isLost,
          note
        }
      ]
    },
    rawLibrarianId
  );

  // ==========================
  // 2) GỬI THÔNG BÁO / MAIL / FCM / SOCKET
  // ==========================

  try {
    const finalResult = result || {};
    const processedItems = finalResult.processedItems || [];
    const itemsCount = processedItems.length || 1;

    const fines = finalResult.fines || {};
    const totalFineNum = Number(fines.totalFine || 0);
    const overdueFineNum = Number(fines.totalOverdueFine || 0);
    const damageFineNum = Number(fines.totalDamageFine || 0);
    const lostFineNum = Number(fines.totalLostFine || 0);
    const deductedFromCard = Number(finalResult.deductedFromCard || 0);
    const qrPaymentRecord = finalResult.qrPaymentRecord || null;

    const money = (v) => Number(v || 0).toLocaleString('vi-VN');

    // Lấy slip + độc giả + email / accountId
    const slip = await LoanSlip.findByPk(loanSlipId, {
      include: [
        {
          model: Reader,
          as: 'Reader',
          include: [
            {
              model: Account,
              attributes: ['email', 'accountId']
            }
          ]
        }
      ]
    });

    if (!slip) return result;

    const readerId = slip.readerId;
    const readerName = slip.Reader?.fullName || 'Độc giả';
    const readerEmail =
      slip?.Reader?.Account?.email ||
      slip?.Reader?.account?.email ||
      null;

    // ========== CASE 1: KHÔNG CÓ QR -> TRẢ XONG HOÀN TOÀN ==========
    if (!qrPaymentRecord) {
      const title = `Phiếu #${loanSlipId} — Đã trả`;
      const content =
        totalFineNum > 0
          ? deductedFromCard > 0
            ? `Bạn đã trả tài liệu. Tổng tiền phạt: ${money(
              totalFineNum
            )}đ, trong đó đã khấu trừ ${money(
              deductedFromCard
            )}đ từ số dư thẻ.`
            : `Bạn đã trả tài liệu. Tổng tiền phạt: ${money(
              totalFineNum
            )}đ.`
          : `Bạn đã trả tài liệu, không phát sinh tiền phạt.`;

      // 1) Notification
      let notificationId = null;
      try {
        const notif = await createNotificationSafe(
          {
            readerId,
            type: 'LOAN_RETURNED',
            title,
            content,
            priority: totalFineNum > 0 ? 'HIGH' : 'NORMAL',
            link: `/loan/${loanSlipId}`,
            isRead: 0
          },
          null
        );
        if (notif) {
          notificationId = notif.notificationID || notif.id || null;
        }
      } catch (nerr) {
        console.warn(
          'returnSingleItemService: create LOAN_RETURNED notification failed',
          nerr?.message || nerr
        );
      }

      // 2) EMAIL biên nhận trả
      try {
        const finalEmail =
          readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
        if (finalEmail && mailService && typeof mailService.sendReturnReceiptEmail === 'function') {
          const firstTitle =
            processedItems.length === 1
              ? processedItems[0].title
              : processedItems.length > 1
                ? `${processedItems.length} tài liệu`
                : 'Tài liệu';

          await mailService.sendReturnReceiptEmail(finalEmail, {
            fullName: readerName,
            slipId: loanSlipId,
            title: firstTitle,
            returnDate,
            overdueFine: overdueFineNum,
            damageFine: damageFineNum,
            lostFine: lostFineNum,
            totalFine: totalFineNum,
            deductedFromCard,
            libraryName: process.env.LIBRARY_NAME || 'Thư viện'
          });

          if (notificationId && Notification) {
            const pk = Notification.primaryKeyAttribute || 'notificationID';
            const where = {};
            where[pk] = notificationId;
            try {
              await Notification.update(
                { emailAt: new Date() },
                { where }
              );
            } catch (updErr) {
              console.warn(
                'returnSingleItemService: cannot update notification.emailAt',
                updErr?.message || updErr
              );
            }
          }
        }
      } catch (mailErr) {
        console.error(
          'returnSingleItemService: sendReturnReceiptEmail failed',
          mailErr?.message || mailErr
        );
      }

      // 3) FCM
      try {
        if (readerId && typeof sendFcmToReader === 'function') {
          const payload = buildFcmPayload({
            title,
            body: content,
            data: {
              type: 'LOAN_RETURNED',
              slipId: String(loanSlipId),
              itemsCount: String(itemsCount),
              totalFine: String(totalFineNum),
              deductedFromCard: String(deductedFromCard),
              notificationId: notificationId ? String(notificationId) : '',
              link: `/loan/${loanSlipId}`
            }
          });
          await sendFcmToReader(readerId, payload);
        }
      } catch (fcmErr) {
        console.error(
          'returnSingleItemService: send FCM failed',
          fcmErr?.message || fcmErr
        );
      }

      // 4) SOCKET.IO
      try {
        let targetUserId = readerId;
        try {
          const rr = await Reader.findByPk(readerId, {
            attributes: ['accountId']
          });
          if (rr?.accountId) targetUserId = rr.accountId;
        } catch (e) {
          // ignore
        }

        const socketData = {
          type: 'LOAN_RETURNED',
          slipId: String(loanSlipId),
          itemsCount: String(itemsCount),
          totalFine: String(totalFineNum),
          deductedFromCard: String(deductedFromCard),
          notificationId: notificationId ? String(notificationId) : '',
          link: `/loan/${loanSlipId}`
        };

        if (typeof emitToUser === 'function') {
          emitToUser(targetUserId, 'loanReturned', socketData);
          console.log(
            '✅ returnSingleItemService: Socket loanReturned emitted',
            { targetUserId, socketData }
          );
        }
      } catch (socketErr) {
        console.error(
          'returnSingleItemService: send socket failed',
          socketErr?.message || socketErr
        );
      }

      return result;
    }

    // ========== CASE 2: CÓ QR PENDING -> GỬI THÔNG BÁO VIOLATION ==========
    const amount = Number(qrPaymentRecord.amount || 0);
    const checkoutUrl = qrPaymentRecord.checkoutUrl || qrPaymentRecord.qrCode || null;

    const title = `Phiếu #${loanSlipId} — Cần thanh toán tiền phạt`;
    const content = `Bạn cần thanh toán ${money(
      amount
    )}đ để hoàn tất trả tài liệu.`;

    // Notification (đoạn tạo notification chính cho QR đã làm trong returnBulkItemsService,
    // ở đây chủ yếu lo mail + FCM + socket, nên KHÔNG tạo thêm để tránh trùng)
    let notificationId = null;

    // EMAIL
    try {
      const finalEmail =
        readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;

      if (finalEmail && mailService && typeof mailService.sendEmail === 'function') {
        const libraryName = process.env.LIBRARY_NAME || 'Thư viện';
        const supportEmail =
          process.env.SUPPORT_EMAIL ||
          process.env.SMTP_FROM ||
          'support@example.com';
        const supportPhone = process.env.SUPPORT_PHONE || '0000 000 000';
        const year = new Date().getFullYear();

        const subject = `[${libraryName}] Thanh toán tiền phạt — Phiếu #${loanSlipId}`;

        const textLines = [
          `Kính gửi ${readerName},`,
          '',
          `Hệ thống đã ghi nhận việc trả tài liệu thuộc phiếu #${loanSlipId}.`,
          `Tuy nhiên bạn cần thanh toán thêm ${money(amount)}đ tiền phạt.`,
          checkoutUrl ? `Bạn có thể thanh toán qua đường dẫn: ${checkoutUrl}` : '',
          '',
          `Nếu bạn đã thanh toán, vui lòng bỏ qua email này hoặc liên hệ thư viện để được hỗ trợ.`,
          '',
          `Trân trọng,`,
          libraryName,
          `Email hỗ trợ: ${supportEmail}`,
          `Số điện thoại: ${supportPhone}`
        ];
        const text = textLines.join('\n');

        const html = `
          <p>Kính gửi ${readerName},</p>
          <p>Hệ thống đã ghi nhận việc trả tài liệu thuộc phiếu <b>#${loanSlipId}</b>.</p>
          <p>Bạn cần thanh toán thêm <b>${money(
          amount
        )}đ</b> tiền phạt để hoàn tất.</p>
          ${checkoutUrl
            ? `<p>Vui lòng thanh toán tại đường dẫn sau: <a href="${checkoutUrl}" target="_blank">${checkoutUrl}</a></p>`
            : ''
          }
          <p>Nếu bạn đã thanh toán, vui lòng bỏ qua email này hoặc liên hệ thư viện để được hỗ trợ.</p>
          <p>Trân trọng,<br/>${libraryName}</p>
          <hr/>
          <p>Email hỗ trợ: ${supportEmail}<br/>Số điện thoại: ${supportPhone}<br/>&copy; ${year} ${libraryName}</p>
        `;

        await mailService.sendEmail(finalEmail, subject, html, text);
      }
    } catch (mailErr) {
      console.error(
        'returnSingleItemService[QR]: send fine email failed',
        mailErr?.message || mailErr
      );
    }

    // FCM
    try {
      if (readerId && typeof sendFcmToReader === 'function') {
        const payload = buildFcmPayload({
          title,
          body: content,
          data: {
            type: 'VIOLATION',
            slipId: String(loanSlipId),
            amount: String(amount),
            notificationId: notificationId ? String(notificationId) : '',
            link: checkoutUrl || ''
          }
        });
        await sendFcmToReader(readerId, payload);
      }
    } catch (fcmErr) {
      console.error(
        'returnSingleItemService[QR]: send FCM failed',
        fcmErr?.message || fcmErr
      );
    }

    // SOCKET
    try {
      let targetUserId = readerId;
      try {
        const rr = await Reader.findByPk(readerId, {
          attributes: ['accountId']
        });
        if (rr?.accountId) targetUserId = rr.accountId;
      } catch (e) {
        // ignore
      }

      if (targetUserId && typeof emitToUser === 'function') {
        const socketData = {
          type: 'VIOLATION',
          slipId: String(loanSlipId),
          amount: String(amount),
          notificationId: notificationId ? String(notificationId) : '',
          link: checkoutUrl || ''
        };

        emitToUser(targetUserId, 'violationPaymentRequired', socketData);
        console.log(
          '✅ returnSingleItemService[QR]: Socket violationPaymentRequired emitted',
          { targetUserId, socketData }
        );
      }
    } catch (socketErr) {
      console.error(
        'returnSingleItemService[QR]: send socket failed',
        socketErr?.message || socketErr
      );
    }
  } catch (outerErr) {
    console.error(
      'returnSingleItemService: post-return notifications failed',
      outerErr?.message || outerErr
    );
  }

  // Giữ nguyên format trả về cho FE
  return result;
}



/**
 * PREVIEW TÍNH PHÍ TRẢ TOÀN BỘ PHIẾU (KHÔNG GHI DB)
 * body: { loanSlipId, returnDate, items: [{ loanDetailId, conditionReturn, isLost? }] }
 */
async function previewBulkReturnFinesService(body) {
  const {
    loanSlipId,
    returnDate,
    items = []
  } = body || {};

  if (!loanSlipId || !returnDate || !items.length) {
    const e = new Error('Thiếu loanSlipId, returnDate hoặc items');
    e.status = 400;
    throw e;
  }

  const returnDateObj = parseDateOnly(returnDate);
  if (!returnDateObj) {
    const e = new Error('returnDate không đúng định dạng YYYY-MM-DD');
    e.status = 400;
    throw e;
  }

  for (const item of items) {
    if (!item.loanDetailId || item.conditionReturn == null) {
      const e = new Error('Mỗi item phải có loanDetailId và conditionReturn');
      e.status = 400;
      throw e;
    }
    const cond = Number(item.conditionReturn);
    if (isNaN(cond) || cond < 0 || cond > 100) {
      const e = new Error('conditionReturn phải là số từ 0-100');
      e.status = 400;
      throw e;
    }
  }

  return await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(loanSlipId, {
      include: [{
        model: LoanDetail,
        as: 'details',   // 👈 THÊM alias đúng như trong association
        include: [{
          model: DocumentCopy,
          include: [{
            model: Document,
            attributes: ['documentId', 'title', 'coverPrice']
          }]
        }]
      }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });


    if (!slip) {
      const e = new Error('Không tìm thấy LoanSlip');
      e.status = 404;
      throw e;
    }

    const slipStatus = String(slip.status || '').toUpperCase();
    if (!['BORROWING', 'OVERDUE'].includes(slipStatus)) {
      const e = new Error(
        `Phiếu mượn không ở trạng thái đang mượn hoặc quá hạn (hiện tại: ${slip.status})`
      );
      e.status = 409;
      throw e;
    }

    const mapItem = new Map(items.map(i => [Number(i.loanDetailId), i]));

    let totalOverdueFine = 0;
    let totalDamageFine = 0;
    let totalLostFine = 0;

    const previewItems = [];

    for (const detail of slip.LoanDetails || slip.details || []) {
      const itemData = mapItem.get(detail.loanDetailId);
      if (!itemData) continue;

      if (String((detail.status || '').toUpperCase()) !== 'BORROWED' || detail.returnDate) {
        continue;
      }

      const copy = detail.DocumentCopy;
      const doc = copy?.Document;
      const coverPrice = doc?.coverPrice || 0;
      const isLost = !!itemData.isLost;
      const condReturn = isLost ? 0 : Number(itemData.conditionReturn);

      const overdueFine = slip.dueDate
        ? calculateOverdueFine(slip.dueDate, returnDate)
        : 0;

      let lostFine = 0;
      let damageFine = 0;
      if (isLost) {
        lostFine = calculateLostFine(coverPrice);
      } else {
        damageFine = calculateDamageFine(
          detail.conditionBorrow,
          condReturn,
          coverPrice
        );
      }

      const itemFine = Number(overdueFine) + Number(damageFine) + Number(lostFine);

      totalOverdueFine += overdueFine;
      totalDamageFine += damageFine;
      totalLostFine += lostFine;

      previewItems.push({
        loanDetailId: detail.loanDetailId,
        documentId: doc?.documentId || null,
        title: doc?.title || null,
        isLost,
        conditionBorrow: detail.conditionBorrow,
        conditionReturn: condReturn,
        overdueFine,
        damageFine,
        lostFine,
        totalFine: itemFine
      });
    }

    const totalFine = totalOverdueFine + totalDamageFine + totalLostFine;

    // Lấy thẻ để tính xem còn bao nhiêu, cần nạp bao nhiêu (KHÔNG trừ, chỉ preview)
    const memberCard = await MemberCard.findOne({
      where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    let cardBalance = 0;
    let canPayFromCard = 0;
    let needExternalPay = 0;

    if (memberCard) {
      cardBalance = Number(memberCard.balance || 0);
      canPayFromCard = Math.min(cardBalance, totalFine);
      needExternalPay = Math.max(0, totalFine - canPayFromCard);
    } else {
      cardBalance = 0;
      canPayFromCard = 0;
      needExternalPay = totalFine;
    }

    return {
      loanSlipId,
      returnDate,
      totals: {
        overdue: totalOverdueFine,
        damage: totalDamageFine,
        lost: totalLostFine,
        total: totalFine
      },
      items: previewItems,
      paymentPreview: {
        hasMemberCard: !!memberCard,
        cardBalance,
        canPayFromCard,
        needExternalPay
      }
    };
  });
}

/**
 * BƯỚC 1: INIT trả phiếu + tạo QR nếu cần
 * - Nếu tổng phạt <= 0: gọi luôn returnBulkItemsService => cập nhật phiếu ngay
 * - Nếu tổng phạt > 0:
 *    + KHÔNG cập nhật LoanSlip / LoanDetail
 *    + Tạo Payment (PENDING) + PayOS link/QR
 *    + Trả về cho FE: needPayment = true, payment + preview
 */

async function initBulkReturnPaymentService(body, rawLibrarianId) {
  const {
    loanSlipId,
    returnDate,
    items = []
  } = body || {};

  if (!loanSlipId || !returnDate || !items.length) {
    const e = new Error('Thiếu loanSlipId, returnDate hoặc items');
    e.status = 400;
    throw e;
  }

  // Dùng preview để tính toàn bộ tiền phạt + số tiền cần trả thêm ngoài thẻ
  const preview = await previewBulkReturnFinesService({ loanSlipId, returnDate, items });

  const totals = preview.totals || {};
  const paymentPreview = preview.paymentPreview || {};

  const totalFine = Number(totals.total || 0);
  const needExternalPay = Number(paymentPreview.needExternalPay || 0);

  // Nếu không có tiền phạt hoặc phần thiếu = 0 -> TRẢ LUÔN, KHÔNG CẦN QR
  // Nếu không có tiền phạt hoặc phần thiếu = 0 -> TRẢ LUÔN, KHÔNG CẦN QR
  if (totalFine <= 0 || needExternalPay <= 0) {
    const finalResult = await returnBulkItemsService(body, rawLibrarianId);

    // ==========================
    // GỬI THÔNG BÁO: TRẢ PHIẾU
    // ==========================
    try {
      // lấy slip + độc giả + email
      const slip = await LoanSlip.findByPk(loanSlipId, {
        include: [
          {
            model: Reader,
            as: 'Reader',
            include: [
              {
                model: Account,
                attributes: ['email']
              }
            ]
          }
        ]
      });

      if (slip) {
        const readerId = slip.readerId;
        const readerName = slip.Reader?.fullName || 'Độc giả';
        const readerEmail =
          slip?.Reader?.Account?.email ||
          slip?.Reader?.account?.email ||
          null;

        const itemsCount = (finalResult?.processedItems || []).length;
        const fineSummary = finalResult?.fines || {};
        const totalFineNum = Number(fineSummary.totalFine || 0);
        const hasFine = totalFineNum > 0;

        const money = (v) => Number(v || 0).toLocaleString('vi-VN');
        const title = `Phiếu #${loanSlipId} — Đã trả`;
        const content = hasFine
          ? `Bạn đã trả ${itemsCount} tài liệu. Tổng tiền phạt: ${money(totalFineNum)}đ.`
          : `Bạn đã trả ${itemsCount} tài liệu, không phát sinh tiền phạt.`;

        // 1) Notification trong DB
        let notificationId = null;
        try {
          const notif = await createNotificationSafe(
            {
              readerId,
              type: 'LOAN_RETURNED',
              title,
              content,
              priority: hasFine ? 'HIGH' : 'NORMAL',
              link: `/loan/${loanSlipId}`,
              isRead: 0
            },
            null
          );
          if (notif) {
            notificationId = notif.notificationID || notif.id || null;
          }
        } catch (nerr) {
          console.warn(
            'initBulkReturnPaymentService: create LOAN_RETURNED notification failed',
            nerr?.message || nerr
          );
        }

        // 2) EMAIL biên nhận trả (có/không có phạt đều gửi được)
        try {
          const finalEmail =
            readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
          if (finalEmail) {
            const processed = finalResult?.processedItems || [];
            const firstTitle =
              processed.length === 1
                ? processed[0].title
                : processed.length > 1
                  ? `${processed.length} tài liệu`
                  : 'Tài liệu';

            await mailService.sendReturnReceiptEmail(finalEmail, {
              fullName: readerName,
              slipId: loanSlipId,
              title: firstTitle,
              returnDate,
              overdueFine: Number(fineSummary.overdueFine || 0),
              damageFine: Number(fineSummary.damageFine || 0),
              lostFine: Number(fineSummary.lostFine || 0),
              totalFine: totalFineNum,
              libraryName: process.env.LIBRARY_NAME || 'Thư viện'
            });

            // cập nhật emailAt cho notification nếu có
            if (notificationId && Notification) {
              const pk = Notification.primaryKeyAttribute || 'notificationID';
              const where = {};
              where[pk] = notificationId;
              try {
                await Notification.update(
                  { emailAt: new Date() },
                  { where }
                );
              } catch (updErr) {
                console.warn(
                  'initBulkReturnPaymentService: cannot update notification.emailAt',
                  updErr?.message || updErr
                );
              }
            }
          }
        } catch (mailErr) {
          console.error(
            'initBulkReturnPaymentService: sendReturnReceiptEmail failed',
            mailErr?.message || mailErr
          );
        }

        // 3) FCM
        try {
          if (readerId && typeof sendFcmToReader === 'function') {
            const payload = buildFcmPayload({
              title,
              body: content,
              data: {
                type: 'LOAN_RETURNED',
                slipId: String(loanSlipId),
                itemsCount: String(itemsCount),
                totalFine: String(totalFineNum),
                notificationId: notificationId ? String(notificationId) : '',
                link: `/loan/${loanSlipId}`
              }
            });
            await sendFcmToReader(readerId, payload);
          }
        } catch (fcmErr) {
          console.error(
            'initBulkReturnPaymentService: send FCM failed',
            fcmErr?.message || fcmErr
          );
        }

        // 4) SOCKET.IO
        try {
          let targetUserId = readerId;
          try {
            const rr = await Reader.findByPk(readerId, {
              attributes: ['accountId']
            });
            if (rr?.accountId) targetUserId = rr.accountId;
          } catch (e) {
            // ignore
          }

          const socketData = {
            type: 'LOAN_RETURNED',
            slipId: String(loanSlipId),
            itemsCount: String(itemsCount),
            totalFine: String(totalFineNum),
            notificationId: notificationId ? String(notificationId) : '',
            link: `/loan/${loanSlipId}`
          };

          if (typeof emitToUser === 'function') {
            // event name: loanReturned (FE nghe event này)
            emitToUser(targetUserId, 'loanReturned', socketData);
            console.log('✅ initBulkReturnPaymentService: Socket loanReturned emitted', {
              targetUserId,
              socketData
            });
          } else {
            console.warn(
              'initBulkReturnPaymentService: emitToUser không khả dụng, bỏ qua socket'
            );
          }
        } catch (socketErr) {
          console.error(
            'initBulkReturnPaymentService: send socket failed',
            socketErr?.message || socketErr
          );
        }
      }
    } catch (notifyErr) {
      console.error(
        'initBulkReturnPaymentService: notifications after bulk return failed',
        notifyErr?.message || notifyErr
      );
    }

    // luôn trả về kết quả cũ cho FE (kể cả nếu gửi thông báo bị lỗi)
    return {
      success: true,
      needPayment: false,
      preview,
      finalResult
    };
  }
  // CÓ PHẦN THIẾU -> tạo Payment PENDING + QR
  // CÓ PHẦN THIẾU -> tạo Payment PENDING + QR + gửi notify/FCM/socket/mail
  const txResult = await sequelize.transaction(async (t) => {
    // Chuẩn hóa librarianId (FE có thể gửi accountId)
    const resolvedLibrarianId = await resolveLibrarianIdFlexible(rawLibrarianId, t);

    const slip = await LoanSlip.findByPk(loanSlipId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
      include: [
        {
          model: Reader,
          as: 'Reader',
          include: [
            {
              model: Account,
              attributes: ['email', 'accountId']
            }
          ]
        }
      ]
    });
    if (!slip) {
      const e = new Error('Không tìm thấy LoanSlip');
      e.status = 404;
      throw e;
    }

    const amount = needExternalPay;
    const money = (v) => Number(v || 0).toLocaleString('vi-VN');

    // Mô tả cho PayOS phải <= 25 ký tự
    let description = `Fine slip #${slip.loanSlipId}`;
    if (description.length > 25) {
      description = description.slice(0, 25);
    }

    // Tạo Payment PENDING trong DB (method = QR, type = VIOLATION)
    const paymentRecord = await Payment.create({
      readerId: slip.readerId,
      librarianId: resolvedLibrarianId || null,
      loanSlipId: slip.loanSlipId,
      amount,
      status: 'PENDING',
      paymentType: 'VIOLATION',
      paymentMethod: 'QR',
      description,
      transactionCode: null,
      externalRef: null,
      checkoutUrl: null,
      rawResponse: null
    }, { transaction: t });

    // Gọi PayOS tạo link/QR
    const payResp = await payosService.createPaymentLink({
      amount,
      description,
      orderCode: `fine_${loanSlipId}_${paymentRecord.paymentId || paymentRecord.id}`,
      returnUrl: process.env.PAY_RETURN_URL,
      cancelUrl: process.env.PAY_CANCEL_URL
    });

    await paymentRecord.update({
      transactionCode: String(payResp.orderCode || ''),
      externalRef: payResp.orderCode || null,
      checkoutUrl: payResp.checkoutUrl || payResp.qrCode || null,
      rawResponse: JSON.stringify(payResp || {})
    }, { transaction: t });

    const notifTitle = `Phiếu #${slip.loanSlipId} — Cần thanh toán tiền phạt`;
    const notifContent = `Bạn cần thanh toán ${money(amount)}đ để hoàn tất trả phiếu #${slip.loanSlipId}.`;

    // Notification trong DB
    let notificationId = null;
    try {
      const notif = await createNotificationSafe({
        readerId: slip.readerId,
        type: 'VIOLATION',
        title: notifTitle,
        content: notifContent,
        priority: 'HIGH',
        link: paymentRecord.checkoutUrl || null,
        isRead: 0
      }, t);
      if (notif) {
        notificationId = notif.notificationID || notif.id || null;
      }
    } catch (nerr) {
      console.warn(
        'initBulkReturnPaymentService[QR]: create VIOLATION notification failed',
        nerr?.message || nerr
      );
    }

    return {
      success: true,
      needPayment: true,
      preview,
      payment: {
        paymentId: paymentRecord.paymentId || paymentRecord.id,
        orderCode: payResp.orderCode,
        amount,
        checkoutUrl: payResp.checkoutUrl,
        qrCode: payResp.qrCode
      },
      notifyMeta: {
        readerId: slip.readerId,
        readerName: slip.Reader?.fullName || 'Độc giả',
        readerEmail:
          slip?.Reader?.Account?.email ||
          slip?.Reader?.account?.email ||
          null,
        notificationId
      }
    };
  });

  // ===== Sau khi transaction commit: gửi MAIL + FCM + SOCKET =====
  const money = (v) => Number(v || 0).toLocaleString('vi-VN');
  const { notifyMeta, payment } = txResult || {};
  const readerId = notifyMeta?.readerId;
  const readerName = notifyMeta?.readerName || 'Độc giả';
  const readerEmail = notifyMeta?.readerEmail || null;
  const notificationId = notifyMeta?.notificationId || null;
  const amount = payment?.amount || needExternalPay;
  const checkoutUrl = payment?.checkoutUrl || null;

  const title = `Phiếu #${loanSlipId} — Cần thanh toán tiền phạt`;
  const content = `Bạn cần thanh toán ${money(amount)}đ để hoàn tất trả phiếu #${loanSlipId}.`;

  // 1) EMAIL: gửi mail yêu cầu thanh toán phạt
  try {
    const finalEmail =
      readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;

    if (finalEmail && mailService && typeof mailService.sendEmail === 'function') {
      const libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech';
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || 'support@example.com';
      const supportPhone = process.env.SUPPORT_PHONE || '0000 000 000';
      const year = new Date().getFullYear();

      const subject = `[${libraryName}] Thanh toán tiền phạt — Phiếu #${loanSlipId}`;

      const textLines = [
        `Kính gửi ${readerName},`,
        '',
        `Bạn đang có khoản tiền phạt cần thanh toán để hoàn tất trả Phiếu mượn #${loanSlipId}.`,
        `Số tiền cần thanh toán: ${money(amount)} đ.`,
        checkoutUrl ? `Link thanh toán: ${checkoutUrl}` : '',
        '',
        'Sau khi thanh toán thành công, hệ thống sẽ tự động xác nhận và hoàn tất việc trả phiếu.',
        '',
        `Nếu có thắc mắc, vui lòng liên hệ: ${supportEmail} — ${supportPhone}`,
        '',
        `Trân trọng,`,
        libraryName
      ];
      const text = textLines.join('\n');

      const html = `
      <!doctype html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:Arial, sans-serif; color:#333;">
        <div style="max-width:720px; margin:12px auto; padding:18px; border:1px solid #eee; border-radius:8px;">
          <h2 style="color:#0b5cff; margin-top:0;">Yêu cầu thanh toán tiền phạt — Phiếu #${loanSlipId}</h2>
          <p>Xin chào <strong>${readerName}</strong>,</p>
          <p>Bạn đang có khoản tiền phạt cần thanh toán để hoàn tất trả phiếu mượn <strong>#${loanSlipId}</strong>.</p>

          <p><strong>Số tiền cần thanh toán:</strong> ${money(amount)} đ</p>
          ${checkoutUrl
          ? `<p>Bạn có thể thanh toán trực tuyến qua liên kết sau:</p>
                 <p><a href="${checkoutUrl}" target="_blank" rel="noopener">${checkoutUrl}</a></p>`
          : ''
        }

          <p>Sau khi thanh toán thành công, hệ thống sẽ tự động xác nhận và cập nhật trạng thái phiếu.</p>

          <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">
          <p style="font-size:13px; color:#555;">Hỗ trợ: ${supportEmail} | ${supportPhone}</p>
          <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} ${libraryName}</p>
        </div>
      </body>
      </html>
      `;

      await mailService.sendEmail(finalEmail, subject, html, text);

      // update emailAt cho notification nếu có
      if (notificationId && Notification) {
        const pk = Notification.primaryKeyAttribute || 'notificationID';
        const where = {};
        where[pk] = notificationId;
        try {
          await Notification.update(
            { emailAt: new Date() },
            { where }
          );
        } catch (updErr) {
          console.warn(
            'initBulkReturnPaymentService[QR]: cannot update notification.emailAt',
            updErr?.message || updErr
          );
        }
      }
    }
  } catch (mailErr) {
    console.error(
      'initBulkReturnPaymentService[QR]: send fine payment email failed',
      mailErr?.message || mailErr
    );
  }

  // 2) FCM
  try {
    if (readerId && typeof sendFcmToReader === 'function') {
      const payload = buildFcmPayload({
        title,
        body: content,
        data: {
          type: 'VIOLATION',
          slipId: String(loanSlipId),
          amount: String(amount),
          notificationId: notificationId ? String(notificationId) : '',
          link: checkoutUrl || ''
        }
      });
      await sendFcmToReader(readerId, payload);
    }
  } catch (fcmErr) {
    console.error(
      'initBulkReturnPaymentService[QR]: send FCM failed',
      fcmErr?.message || fcmErr
    );
  }

  // 3) SOCKET.IO
  try {
    let targetUserId = null;

    if (readerId) {
      try {
        const rr = await Reader.findByPk(readerId, {
          attributes: ['accountId']
        });
        if (rr?.accountId) targetUserId = rr.accountId;
      } catch (e) {
        console.warn(
          'initBulkReturnPaymentService[QR]: cannot load reader.accountId',
          e?.message || e
        );
      }
    }

    if (targetUserId && typeof emitToUser === 'function') {
      const socketData = {
        type: 'VIOLATION',
        slipId: String(loanSlipId),
        amount: String(amount),
        notificationId: notificationId ? String(notificationId) : '',
        link: checkoutUrl || ''
      };

      // FE nghe event này để show popup "Cần thanh toán tiền phạt"
      emitToUser(targetUserId, 'violationPaymentRequired', socketData);
      console.log(
        '✅ initBulkReturnPaymentService[QR]: Socket violationPaymentRequired emitted',
        { targetUserId, socketData }
      );
    } else if (!targetUserId) {
      console.warn('initBulkReturnPaymentService[QR]: no targetUserId to emit socket');
    }
  } catch (socketErr) {
    console.error(
      'initBulkReturnPaymentService[QR]: send socket failed',
      socketErr?.message || socketErr
    );
  }

  // cuối cùng vẫn trả về cho FE đúng y như cũ (thêm notifyMeta FE bỏ qua cũng được)
  return txResult;
}





/**
 * BƯỚC 2: CONFIRM sau khi đã thanh toán QR
 * body: { loanSlipId, returnDate, items, paymentId, orderCode?, librarianId? }
 * rawLibrarianId: id FE gửi lên (có thể là accountId hoặc librarianId)
 *
 * Flow:
 *  - Nếu Payment chưa COMPLETED -> inquiry PayOS để chắc chắn đã thanh toán
 *  - Sau đó:
 *      + update Payment.status = COMPLETED (nếu chưa)
 *      + gọi returnBulkItemsService -> update LoanSlip / LoanDetail / tạo Violation
 *      + đồng bộ Violation.paymentStatus = 'PAID' cho các loanDetailId vừa xử lý
 *  - Cuối cùng: gửi notification + email + FCM + socket cho độc giả
 */
async function confirmBulkReturnAfterPaymentService(body, rawLibrarianId) {
  const {
    loanSlipId,
    returnDate,
    items = [],
    paymentId,
    orderCode
  } = body || {};

  if (!loanSlipId || !returnDate || !items.length || !paymentId) {
    const e = new Error('Thiếu loanSlipId, returnDate, items hoặc paymentId');
    e.status = 400;
    throw e;
  }

  // 1) Lấy Payment từ DB
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    const e = new Error('Không tìm thấy Payment tương ứng');
    e.status = 404;
    throw e;
  }

  if (payment.loanSlipId && Number(payment.loanSlipId) !== Number(loanSlipId)) {
    const e = new Error('Payment không thuộc về LoanSlip này');
    e.status = 400;
    throw e;
  }

  const isAlreadyCompleted =
    String(payment.status || '').toUpperCase() === 'COMPLETED';

  let inquiryResult = null;

  // 2) Nếu chưa COMPLETED thì gọi PayOS inquiry để kiểm tra
  if (!isAlreadyCompleted) {
    try {
      const inquiryCode =
        orderCode || payment.transactionCode || payment.externalRef;
      if (!inquiryCode) {
        const e = new Error('Không có orderCode/transactionCode để kiểm tra PayOS');
        e.status = 400;
        throw e;
      }

      inquiryResult = await payosService.inquiryPayment(inquiryCode);

      const payStatus =
        inquiryResult?.status ||
        inquiryResult?.data?.status ||
        inquiryResult?.code ||
        inquiryResult?.statusCode;

      // Tùy PayOS, thường là 'PAID' hoặc code '00'
      const ok =
        payStatus === 'PAID' ||
        payStatus === 'SUCCEEDED' ||
        payStatus === '00' ||
        payStatus === 0;

      if (!ok) {
        const e = new Error('Thanh toán chưa hoàn tất (PayOS chưa xác nhận PAID)');
        e.status = 409;
        e.details = { payStatus, inquiryResult };
        throw e;
      }
    } catch (err) {
      if (!err.status) err.status = 500;
      throw err;
    }
  }

  // 3) Đến đây coi như THANH TOÁN OK -> update Payment + xử lý trả phiếu + sync Violation
  const txResult = await sequelize.transaction(async (t) => {
    // 3.1) Nếu Payment chưa COMPLETED thì cập nhật
    if (!isAlreadyCompleted) {
      await payment.update(
        {
          status: 'COMPLETED',
          paymentDate: new Date(),
          rawResponse: inquiryResult
            ? JSON.stringify(inquiryResult || {})
            : payment.rawResponse,
        },
        { transaction: t }
      );
    }

    // 3.2) Gọi logic trả phiếu (tính phạt, update LoanSlip / LoanDetail / DocumentCopy / tạo Violation)
    const finalResult = await returnBulkItemsService(
      { loanSlipId, returnDate, items },
      rawLibrarianId
    );

    // 3.3) ĐỒNG BỘ VIOLATION.paymentStatus = 'PAID'
    const processedItems = finalResult?.processedItems || finalResult?.items || [];
    const loanDetailIds = processedItems
      .map((it) => it.loanDetailId)
      .filter((id) => !!id);

    if (loanDetailIds.length) {
      await Violation.update(
        {
          paymentStatus: 'PAID',
          paidAt: new Date(),
        },
        {
          where: {
            loanDetailId: { [Op.in]: loanDetailIds },
            paymentStatus: { [Op.ne]: 'PAID' },
          },
          transaction: t,
        }
      );
    }

    return {
      success: true,
      needPayment: false,
      finalResult,
      payment: {
        paymentId: payment.paymentId || payment.id,
        status: 'COMPLETED',
      },
    };
  });

  // ==========================
  // SAU KHI TRẢ + THANH TOÁN OK
  // ==========================

  const finalResult = txResult?.finalResult || {};
  const processed = finalResult?.processedItems || finalResult?.items || [];
  const itemsCount = processed.length;

  const fineSummary = finalResult?.fines || {};
  const totalFineNum = Number(fineSummary.totalFine || 0);
  const overdueFineNum = Number(fineSummary.totalOverdueFine || 0);
  const damageFineNum = Number(fineSummary.totalDamageFine || 0);
  const lostFineNum = Number(fineSummary.totalLostFine || 0);

  const money = (v) => Number(v || 0).toLocaleString('vi-VN');

  // Lấy thông tin slip + độc giả + account để gửi notify/mail/FCM/socket
  let slip = null;
  try {
    slip = await LoanSlip.findByPk(loanSlipId, {
      include: [
        {
          model: Reader,
          as: 'Reader',
          include: [{ model: Account, attributes: ['email', 'accountId'] }]
        }
      ]
    });
  } catch (err) {
    console.warn(
      '⚠ confirmBulkReturnAfterPaymentService: load LoanSlip failed',
      err?.message || err
    );
  }

  const readerId = slip?.readerId || payment.readerId || null;
  const readerName = slip?.Reader?.fullName || 'Độc giả';
  const readerEmail = slip?.Reader?.Account?.email || null;

  // ========== 3.1 Notification ==========
  let notificationId = null;
  try {
    if (readerId) {
      const notif = await createNotificationSafe({
        readerId,
        type: 'LOAN_RETURNED',
        title: `Phiếu #${loanSlipId} — Đã trả & đã thanh toán`,
        content: totalFineNum > 0
          ? `Bạn đã trả ${itemsCount} tài liệu. Đã thanh toán ${money(totalFineNum)}đ tiền phạt.`
          : `Bạn đã trả ${itemsCount} tài liệu thành công.`,
        priority: totalFineNum > 0 ? 'HIGH' : 'NORMAL',
        link: `/loan/${loanSlipId}`,
        isRead: 0
      });
      if (notif) {
        notificationId = notif.notificationID || notif.id || null;
      }
    }
  } catch (err) {
    console.warn(
      '⚠ confirmBulkReturnAfterPaymentService: create notification failed',
      err?.message || err
    );
  }

  // ========== 3.2 Email biên nhận trả ==========
  try {
    if (readerEmail && mailService && typeof mailService.sendReturnReceiptEmail === 'function') {
      const firstTitle =
        processed.length === 1
          ? processed[0].title
          : processed.length > 1
            ? `${processed.length} tài liệu`
            : 'Tài liệu';

      await mailService.sendReturnReceiptEmail(readerEmail, {
        fullName: readerName,
        slipId: loanSlipId,
        title: firstTitle,
        returnDate,
        overdueFine: overdueFineNum,
        damageFine: damageFineNum,
        lostFine: lostFineNum,
        totalFine: totalFineNum,
        deductedFromCard: 0 // path này thanh toán bằng QR nên khấu trừ thẻ = 0
      });

      // cập nhật emailAt cho notification nếu có
      if (notificationId && Notification) {
        try {
          const pk = Notification.primaryKeyAttribute || 'notificationID';
          const where = {};
          where[pk] = notificationId;
          await Notification.update({ emailAt: new Date() }, { where });
        } catch (updErr) {
          console.warn(
            '⚠ confirmBulkReturnAfterPaymentService: cannot update notification.emailAt',
            updErr?.message || updErr
          );
        }
      }
    }
  } catch (err) {
    console.error(
      '❌ confirmBulkReturnAfterPaymentService: sendReturnReceiptEmail failed',
      err?.message || err
    );
  }

  // ========== 3.3 FCM ==========
  try {
    if (readerId && typeof sendFcmToReader === 'function') {
      const payload = buildFcmPayload({
        title: `Hoàn tất trả phiếu #${loanSlipId}`,
        body: totalFineNum > 0
          ? `Đã trả xong và thanh toán ${money(totalFineNum)}đ tiền phạt.`
          : `Bạn đã trả ${itemsCount} tài liệu thành công.`,
        data: {
          type: 'LOAN_RETURNED',
          slipId: String(loanSlipId),
          totalFine: String(totalFineNum),
          notificationId: notificationId ? String(notificationId) : '',
          link: `/loan/${loanSlipId}`
        }
      });

      await sendFcmToReader(readerId, payload);
    }
  } catch (err) {
    console.error(
      '❌ confirmBulkReturnAfterPaymentService: send FCM failed',
      err?.message || err
    );
  }

  // ========== 3.4 SOCKET.IO ==========
  try {
    let targetUserId = null;
    if (readerId) {
      try {
        const rd = await Reader.findByPk(readerId, {
          attributes: ['accountId']
        });
        if (rd?.accountId) targetUserId = rd.accountId;
      } catch (e) {
        console.warn(
          '⚠ confirmBulkReturnAfterPaymentService: cannot load reader.accountId',
          e?.message || e
        );
      }
    }

    if (targetUserId && typeof emitToUser === 'function') {
      const socketData = {
        type: 'LOAN_RETURNED',
        slipId: String(loanSlipId),
        itemsCount: String(itemsCount),
        totalFine: String(totalFineNum),
        notificationId: notificationId ? String(notificationId) : '',
        link: `/loan/${loanSlipId}`
      };

      emitToUser(targetUserId, 'loanReturned', socketData);
      console.log(
        '✅ confirmBulkReturnAfterPaymentService: Socket loanReturned emitted',
        { targetUserId, socketData }
      );
    } else if (!targetUserId) {
      console.warn(
        '⚠ confirmBulkReturnAfterPaymentService: no targetUserId to emit socket'
      );
    }
  } catch (err) {
    console.error(
      '❌ confirmBulkReturnAfterPaymentService: send socket failed',
      err?.message || err
    );
  }

  // Giữ format trả về như cũ cho FE
  return txResult;
}




/**
 * TRẢ TOÀN BỘ PHIẾU (BULK RETURN – CONFIRM)
 * Flow:
 *  - Tính phạt cho TẤT CẢ item (trễ hạn + hư hỏng + mất)
 *  - Cập nhật LoanDetail:
 *      + Trả thường: status = 'RETURNED'
 *      + Mất sách:  status = 'LOST'
 *  - Cập nhật DocumentCopy:
 *      + isLost => status = 'LOST', conditionGrade = 'C', conditionNote = '0'
 *      + trả, hư hỏng => status: AVAILABLE / DAMAGED, cập nhật conditionGrade
 *  - Nếu TẤT CẢ chi tiết đều LOST => LoanSlip.status = 'LOST'
 *    Nếu tất cả đã trả (RETURNED hoặc LOST) => LoanSlip.status = 'RETURNED'
 *  - Tính tổng tiền phạt:
 *      + Cố gắng trừ tối đa từ MemberCard.balance (không cho âm)
 *      + Nếu không đủ => tạo QR PayOS cho phần còn thiếu
 *  - GHI HẾT vào bảng Payments:
 *      + Nếu trừ từ thẻ: 1 payment COMPLETED, method = 'CARD'
 *      + Nếu còn thiếu: 1 payment PENDING, method = 'QR', lưu checkoutUrl, externalRef,...
 */
// TRẢ TOÀN BỘ PHIẾU (CONFIRM)
async function returnBulkItemsService(body, rawLibrarianId) {
  const {
    loanSlipId,
    returnDate,
    items = []
  } = body || {};

  if (!loanSlipId || !returnDate || !items.length) {
    const e = new Error("Thiếu loanSlipId, returnDate hoặc items");
    e.status = 400;
    throw e;
  }

  const returnDateObj = parseDateOnly(returnDate);
  if (!returnDateObj) {
    const e = new Error("returnDate không đúng định dạng YYYY-MM-DD");
    e.status = 400;
    throw e;
  }

  // helper: tính số ngày trễ
  function calcDaysLate(dueDate, returnDateStr) {
    if (!dueDate || !returnDateStr) return 0;
    const dDue = new Date(dueDate);
    const dRet = new Date(returnDateStr);
    const diffMs = dRet.getTime() - dDue.getTime();
    if (diffMs <= 0) return 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    return Math.round(diffMs / ONE_DAY);
  }

  function fmtMoney(v) {
    return Number(v || 0).toLocaleString("vi-VN");
  }

  // ==========================
  // THÊM 3 HÀM TÍNH TIỀN PHẠT
  // ==========================

  // Tính tiền phạt trả trễ (simple – dùng cho bulk confirm, đã có preview riêng)
  function calcOverdueFine(dueDate, returnDateStr) {
    const daysLate = calcDaysLate(dueDate, returnDateStr);
    if (daysLate <= 0) return 0;

    const DAILY_FINE = 2000; // ví dụ 2.000đ / ngày
    return daysLate * DAILY_FINE;
  }

  // Tính tiền phạt hư hỏng dựa trên phần trăm giảm chất lượng * giá bìa
  function calcDamageFine(condBorrow, condReturn, coverPrice) {
    const from = Number(condBorrow ?? 100);
    const to = Number(condReturn ?? from);
    const price = Number(coverPrice || 0);

    if (!price || to >= from) return 0;

    const damagePercent = (from - to) / 100;
    return Math.round(price * damagePercent);
  }

  // Tính tiền phạt mất sách (bù phần chênh giữa giá bìa và tiền cọc)
  function calcLostFine(coverPrice, depositAmount) {
    const cover = Number(coverPrice || 0);
    const deposit = Number(depositAmount || 0);
    const fine = cover - deposit;
    return fine > 0 ? fine : 0;
  }

  return await sequelize.transaction(async (t) => {
    const resolvedLibrarianId = await resolveLibrarianIdFlexible(rawLibrarianId, t);

    const slip = await LoanSlip.findByPk(loanSlipId, {
      include: [
        {
          model: LoanDetail,
          as: "details",
          include: [
            {
              model: DocumentCopy,
              as: "DocumentCopy",
              include: [
                {
                  model: Document,
                  as: "Document"
                }
              ]
            }
          ]
        },
        {
          model: Reader,
          as: "Reader"
        }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) {
      const e = new Error("Không tìm thấy LoanSlip");
      e.status = 404;
      throw e;
    }

    if (!["BORROWING", "OVERDUE"].includes(String(slip.status).toUpperCase())) {
      const e = new Error("Chỉ được trả phiếu ở trạng thái BORROWING/OVERDUE");
      e.status = 400;
      throw e;
    }

    let totalOverdueFine = 0;
    let totalDamageFine = 0;
    let totalLostFine = 0;

    const processedItems = [];

    for (const itemData of items) {
      const { loanDetailId, conditionReturn, isLost } = itemData;

      const detail = slip.details.find(d => d.loanDetailId === loanDetailId);
      if (!detail) {
        const e = new Error(`Không tìm thấy LoanDetail #${loanDetailId} trong phiếu #${loanSlipId}`);
        e.status = 404;
        throw e;
      }

      if (String(detail.status).toUpperCase() !== "BORROWED") {
        const e = new Error(`LoanDetail #${loanDetailId} không ở trạng thái BORROWED`);
        e.status = 400;
        throw e;
      }

      const copy = detail.DocumentCopy;
      const doc = copy?.Document;

      const depositAmount = Number(detail.depositAmount || 0);
      const coverPrice = Number(doc?.coverPrice || 0);
      const condBorrow = Number(detail.conditionBorrow ?? 100);
      const condReturn = isLost ? 0 : Number(conditionReturn ?? condBorrow);

      // TÍNH TIỀN PHẠT
      const overdueFine = calcOverdueFine(detail.dueDate || slip.dueDate, returnDate);
      const damageFine = isLost ? 0 : calcDamageFine(condBorrow, condReturn, coverPrice);
      const lostFine = isLost ? calcLostFine(coverPrice, depositAmount) : 0;

      const itemFine = overdueFine + damageFine + lostFine;

      totalOverdueFine += overdueFine;
      totalDamageFine += damageFine;
      totalLostFine += lostFine;

      // cập nhật detail
      await LoanDetail.update({
        returnDate,
        conditionReturn: condReturn,
        overdueFine,
        damageFine,
        lostFine,
        fineAmount: itemFine,
        status: isLost ? "LOST" : "RETURNED",
        note: itemData.note || detail.note
      }, {
        where: { loanDetailId: detail.loanDetailId },
        transaction: t
      });

      // update copy
      if (copy) {
        let newStatus = "AVAILABLE";
        let newCondition = condReturn;

        if (isLost) {
          newStatus = "LOST";
          newCondition = 0;
        } else if (newCondition < 50) {
          newStatus = "DAMAGED";
        }

        await DocumentCopy.update({
          status: newStatus,
          conditionNote: String(newCondition),
          conditionGrade:
            newCondition >= 90 ? "A"
              : newCondition >= 70 ? "B"
                : newCondition >= 50 ? "C"
                  : "D"
        }, {
          where: { documentCopyId: copy.documentCopyId },
          transaction: t
        });
      }

      processedItems.push({
        loanDetailId: detail.loanDetailId,
        documentId: doc?.documentId || null,
        title: doc?.title || null,
        isLost,
        overdueFine,
        damageFine,
        lostFine,
        totalFine: itemFine,
        dueDate: detail.dueDate || slip.dueDate
      });
    }

    const totalFine = totalOverdueFine + totalDamageFine + totalLostFine;

    // =======================
    // TẠO BẢN GHI VIOLATIONS
    // =======================
    if (totalFine > 0 && processedItems.length > 0 && resolvedLibrarianId) {
      for (const it of processedItems) {
        const { overdueFine, damageFine, lostFine } = it;
        if (overdueFine <= 0 && damageFine <= 0 && lostFine <= 0) continue;

        const parts = [];

        // Trễ hạn
        if (overdueFine > 0) {
          const daysLate = calcDaysLate(it.dueDate || slip.dueDate, returnDate);
          if (daysLate > 0) {
            parts.push(`Trễ ${daysLate} ngày: ${fmtMoney(overdueFine)} VND`);
          } else {
            parts.push(`Trễ hạn: ${fmtMoney(overdueFine)} VND`);
          }
        }

        // Hư hỏng
        if (damageFine > 0) {
          parts.push(`Hư hỏng: ${fmtMoney(damageFine)} VND`);
        }

        // Mất sách
        if (lostFine > 0) {
          parts.push(`Mất sách: ${fmtMoney(lostFine)} VND`);
        }

        const violationDescription = parts.join(" ; ");
        const itemTotalFine = overdueFine + damageFine + lostFine;

        let type = "OTHER";
        let severity = "LOW";

        if (lostFine > 0) {
          type = "LOST";
          severity = "HIGH";
        } else if (damageFine > 0 && overdueFine > 0) {
          type = "OVERDUE_DAMAGE";
          severity = "MEDIUM";
        } else if (damageFine > 0) {
          type = "DAMAGE";
          severity = "MEDIUM";
        } else if (overdueFine > 0) {
          type = "OVERDUE";
          severity = "LOW";
        }

        await Violation.create({
          readerId: slip.readerId,
          loanDetailId: it.loanDetailId,
          type,
          severity,
          violationDescription,
          fineAmount: itemTotalFine,
          paymentStatus: "UNPAID",
          librarianId: resolvedLibrarianId,
          note: null
        }, { transaction: t });
      }
    }

    // =======================
    // TRỪ TIỀN THẺ + TẠO PAYMENT
    // =======================
    let deductedFromCard = 0;
    let cardPaymentRecord = null;
    let qrPaymentRecord = null;
    let qrPayos = null;

    const memberCard = await MemberCard.findOne({
      where: { readerId: slip.readerId, deleted: false, status: "ACTIVE" },
      order: [["issueDate", "DESC"]],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (totalFine > 0) {
      if (memberCard) {
        const currentCardRow = await MemberCard.findByPk(memberCard.memberCardId, {
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        const currentBalance = Number(currentCardRow.balance || 0);

        if (currentBalance >= totalFine) {
          // THẺ ĐỦ TIỀN: không tạo QR
          await MemberCard.update({
            balance: sequelize.literal(`COALESCE(balance,0) - ${Number(totalFine)}`)
          }, {
            where: { memberCardId: memberCard.memberCardId },
            transaction: t
          });

          deductedFromCard = totalFine;

          cardPaymentRecord = await Payment.create({
            readerId: slip.readerId,
            librarianId: resolvedLibrarianId || null,
            loanSlipId: slip.loanSlipId,
            amount: totalFine,
            status: "COMPLETED",
            paymentType: "VIOLATION",
            paymentMethod: "CARD",
            paymentDate: fmtToday(),
            description: `Thanh toán tiền phạt trả phiếu #${slip.loanSlipId} bằng số dư thẻ`
          }, { transaction: t });

          // 🔴 THÊM: thẻ đã trả đủ -> đánh dấu VIOLATION là PAID
          await Violation.update(
            {
              paymentStatus: "PAID",
              paidAt: new Date()
            },
            {
              where: {
                loanDetailId: {
                  [Op.in]: processedItems.map(it => it.loanDetailId)
                },
                paymentStatus: "UNPAID"
              },
              transaction: t
            }
          );

        } else {
          // KHÔNG ĐỦ TIỀN: trừ hết phần trong thẻ, còn lại tạo QR
          const usedFromCard = Math.max(0, currentBalance);
          const remaining = totalFine - usedFromCard;

          if (usedFromCard > 0) {
            await MemberCard.update({
              balance: sequelize.literal(`COALESCE(balance,0) - ${usedFromCard}`)
            }, {
              where: { memberCardId: memberCard.memberCardId },
              transaction: t
            });

            deductedFromCard = usedFromCard;

            cardPaymentRecord = await Payment.create({
              readerId: slip.readerId,
              librarianId: resolvedLibrarianId || null,
              loanSlipId: slip.loanSlipId,
              amount: usedFromCard,
              status: "COMPLETED",
              paymentType: "VIOLATION",
              paymentMethod: "CARD",
              paymentDate: fmtToday(),
              description: `Đã trừ ${fmtMoney(usedFromCard)}đ từ số dư thẻ cho tiền phạt phiếu #${slip.loanSlipId}`
            }, { transaction: t });
          }

          // phần còn lại => tạo QR PayOS
          if (remaining > 0) {
            const description = `Fine slip #${slip.loanSlipId}`;
            qrPayos = await payosService.createPaymentLink({
              amount: remaining,
              description,
              orderCode: `fine_${slip.loanSlipId}_${Date.now()}`,
              returnUrl: process.env.PAY_RETURN_URL,
              cancelUrl: process.env.PAY_CANCEL_URL
            });

            qrPaymentRecord = await Payment.create({
              readerId: slip.readerId,
              librarianId: resolvedLibrarianId || null,
              loanSlipId: slip.loanSlipId,
              amount: remaining,
              status: "PENDING",
              paymentType: "VIOLATION",
              paymentMethod: "PAYOS_QR",
              description,
              externalRef: qrPayos.orderCode || null,
              checkoutUrl: qrPayos.checkoutUrl || qrPayos.qrCode || null,
              rawResponse: JSON.stringify(qrPayos || {})
            }, { transaction: t });

            await createNotificationSafe({
              readerId: slip.readerId,
              type: "VIOLATION",
              title: "Cần thanh toán thêm tiền phạt",
              content: `Bạn cần thanh toán thêm ${fmtMoney(remaining)}đ cho phiếu #${slip.loanSlipId}.`,
              link: qrPaymentRecord.checkoutUrl || null
            }, t);
          }
        }
      } else {
        // không có thẻ: toàn bộ phạt qua QR
        const description = `Fine slip #${slip.loanSlipId}`;
        qrPayos = await payosService.createPaymentLink({
          amount: totalFine,
          description,
          orderCode: `fine_${slip.loanSlipId}_${Date.now()}`,
          returnUrl: process.env.PAY_RETURN_URL,
          cancelUrl: process.env.PAY_CANCEL_URL
        });

        qrPaymentRecord = await Payment.create({
          readerId: slip.readerId,
          librarianId: resolvedLibrarianId || null,
          loanSlipId: slip.loanSlipId,
          amount: totalFine,
          status: "PENDING",
          paymentType: "VIOLATION",
          paymentMethod: "PAYOS_QR",
          description,
          externalRef: qrPayos.orderCode || null,
          checkoutUrl: qrPayos.checkoutUrl || qrPayos.qrCode || null,
          rawResponse: JSON.stringify(qrPayos || {})
        }, { transaction: t });

        await createNotificationSafe({
          readerId: slip.readerId,
          type: "VIOLATION",
          title: "Cần thanh toán tiền phạt",
          content: `Bạn cần thanh toán ${fmtMoney(totalFine)}đ cho phiếu #${slip.loanSlipId}.`,
          link: qrPaymentRecord.checkoutUrl || null
        }, t);
      }
    }

    // cập nhật trạng thái phiếu
    const remainingBorrowed = await LoanDetail.count({
      where: { loanSlipId: slip.loanSlipId, status: "BORROWED" },
      transaction: t
    });

    slip.status = remainingBorrowed > 0 ? "BORROWING" : "RETURNED";
    slip.returnDate = returnDate;
    await slip.save({ transaction: t });

    return {
      loanSlipId: slip.loanSlipId,
      returnDate,
      fines: {
        totalOverdueFine,
        totalDamageFine,
        totalLostFine,
        totalFine
      },
      deductedFromCard,
      cardPaymentRecord,
      qrPaymentRecord,
      qrPayos,
      processedItems
    };
  });
}







/**
 * PICKUP: Xác nhận độc giả đã đến nhận (WAITING_FOR_PICKUP -> BORROWING)
 * payload = {
 *   loanSlipId,
 *   librarianId,
 *   pickupDate (optional, YYYY-MM-DD) -> nếu không có => fmtToday()
 *   dueDate (optional, YYYY-MM-DD) -> nếu không có => pickupDate + 30 ngày
 *   items (optional array of loanDetailId) -> nếu có chỉ xử lý những dòng này
 *   preserveLoanDate (optional bool) -> nếu true sẽ không overwrite slip.loanDate (mặc định false)
 * }
 */
async function pickupLoanSlipService(payload) {
  const {
    loanSlipId,
    librarianId,
    pickupDate = fmtToday(),
    dueDate = null,
    items = null,
    preserveLoanDate = false
  } = payload || {};

  if (!loanSlipId || !librarianId) {
    const e = new Error('Thiếu loanSlipId hoặc librarianId'); e.status = 400; throw e;
  }

  const pd = parseDateOnly(pickupDate);
  if (!pd) { const e = new Error('pickupDate không hợp lệ (YYYY-MM-DD)'); e.status = 400; throw e; }

  const finalDueDate = dueDate || addDaysDateOnly(pickupDate, 30);
  const dd = parseDateOnly(finalDueDate);
  if (!dd) { const e = new Error('dueDate không hợp lệ (YYYY-MM-DD)'); e.status = 400; throw e; }

  if (!(daysDiff(pickupDate, finalDueDate) > 0)) {
    const e = new Error('Hạn trả (dueDate) phải sau ngày nhận (pickupDate)'); e.status = 400; throw e;
  }

  const txResult = await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(Number(loanSlipId), {
      transaction: t,
      lock: t.LOCK.UPDATE,
      include: [
        { model: Reader, include: [{ model: Account }] },
        { model: LoanDetail, as: 'details', include: [{ model: DocumentCopy, include: [{ model: Document }] }] }
      ]
    });

    if (!slip) { const e = new Error('Không tìm thấy phiếu'); e.status = 404; throw e; }

    if (String((slip.status || '').toUpperCase()) !== 'WAITING_FOR_PICKUP') {
      const e = new Error('Chỉ có thể pickup khi phiếu ở trạng thái WAITING_FOR_PICKUP'); e.status = 409; throw e;
    }

    // ====== CHECK THẺ & QUOTA TRƯỚC KHI PICKUP ======
    const memberCard = await MemberCard.findOne({
      where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!memberCard) {
      const e = new Error('Độc giả chưa có thẻ hội viên hợp lệ (MemberCard).');
      e.status = 403; throw e;
    }

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
      const e = new Error('Loại thẻ độc giả không cho phép mượn về');
      e.status = 403; throw e;
    }

    // Rule: ở bước pickup, số sách trong phiếu đã nằm trong snapshot,
    // nên chỉ cần đảm bảo tổng hiện tại (pending + waiting + borrowing) <= maxBorrowLimit
    await ensureReaderBorrowQuota({
      readerId: slip.readerId,
      cardType,
      transaction: t,
      extraRequested: 0,
      checkOverdueAndViolation: false, // tùy rule, nếu muốn chặn do trễ hạn thì bật true
      context: 'pickupLoanSlipService',
    });
    // ==================================================

    const whereDetails = { loanSlipId: slip.loanSlipId, status: 'WAITING_FOR_PICKUP' };
    if (Array.isArray(items) && items.length) whereDetails.loanDetailId = items.map(Number);

    const waitingDetails = await LoanDetail.findAll({
      where: whereDetails,
      include: [{ model: DocumentCopy, include: [{ model: Document }] }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!waitingDetails.length) {
      const e = new Error('Không có item nào ở trạng thái WAITING_FOR_PICKUP để pickup'); e.status = 400; throw e;
    }

    for (const d of waitingDetails) {
      if (!d.documentCopyId) throw new Error(`LoanDetail #${d.loanDetailId} chưa được gán bản sao`);
      const cp = d.DocumentCopy;
      if (!cp) throw new Error(`Không tìm thấy DocumentCopy #${d.documentCopyId}`);
      if (String((cp.status || '').toUpperCase()) !== 'ON_HOLD') {
        const e = new Error(`Bản sao #${cp.documentCopyId} không ở trạng thái ON_HOLD`);
        e.status = 409; throw e;
      }
    }

    const updateSlipData = {
      librarianId: Number(librarianId),
      dueDate: finalDueDate,
      status: 'BORROWING'
    };
    if (!preserveLoanDate) updateSlipData.loanDate = pickupDate;
    await slip.update(updateSlipData, { transaction: t });

    const processedDetails = [];
    for (const d of waitingDetails) {
      const cp = d.DocumentCopy;
      const borrowCond = sanitizeBorrowCondition(cp?.conditionNote ?? cp?.conditionGrade ?? null);

      await d.update(
        { status: 'BORROWED', conditionBorrow: borrowCond },
        { transaction: t }
      );

      await DocumentCopy.update(
        { status: 'BORROWED' },
        { where: { documentCopyId: d.documentCopyId }, transaction: t }
      );

      processedDetails.push({
        loanDetailId: d.loanDetailId,
        documentCopyId: d.documentCopyId,
        documentId: cp?.Document?.documentId || null,
        title: cp?.Document?.title || null
      });
    }

    // Lấy email reader
    let readerEmail = null;
    try {
      const reader = slip.Reader || (await Reader.findByPk(slip.readerId, { transaction: t }));
      if (reader?.accountId) {
        const account = await Account.findByPk(reader.accountId, { attributes: ['email'], transaction: t });
        readerEmail = account?.email || null;
      }
    } catch {
      readerEmail = null;
    }

    let createdNotification = null;
    try {
      createdNotification = await createNotificationSafe({
        readerId: slip.readerId,
        type: 'PICKUP_CONFIRMED',
        title: `Phiếu #${slip.loanSlipId} — Đã nhận`,
        content: `Bạn đã nhận ${processedDetails.length} tài liệu. Hạn trả: ${finalDueDate}.`,
        priority: 'NORMAL',
        link: `/loan/${slip.loanSlipId}`,
        isRead: 0
      }, t);
    } catch { }

    return {
      loanSlip: slip,
      processedDetails,
      readerEmail,
      loanDate: (!preserveLoanDate ? pickupDate : slip.loanDate),
      dueDate: finalDueDate,
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  });

  // EMAIL
  try {
    const finalEmail = txResult.readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
    if (finalEmail) {
      const reader = await Reader.findByPk(txResult.loanSlip.readerId);
      const readerName = reader?.fullName || 'Độc giả';

      await mailService.sendLoanIssuedEmail(finalEmail, {
        fullName: readerName,
        slipId: txResult.loanSlip.loanSlipId,
        items: txResult.processedDetails,
        loanDate: txResult.loanDate,
        dueDate: txResult.dueDate,
        libraryName: process.env.LIBRARY_NAME
      });
    }
  } catch (err) {
    console.error('pickupLoanSlipService: send email failed', err?.message || err);
  }

  // FCM
  try {
    const itemsCount = (txResult.processedDetails || []).length;
    const payload = buildFcmPayload({
      title: `Xác nhận mượn #${txResult.loanSlip.loanSlipId}`,
      body: `Bạn đã nhận ${itemsCount} tài liệu. Hạn trả: ${txResult.dueDate}.`,
      data: {
        type: 'PICKUP_CONFIRMED',
        slipId: String(txResult.loanSlip.loanSlipId),
        loanDate: String(txResult.loanDate),
        dueDate: String(txResult.dueDate),
        itemsCount: String(itemsCount),
        notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
        link: `/loan/${txResult.loanSlip.loanSlipId}`
      }
    });

    await sendFcmToReader(txResult.loanSlip.readerId, payload);
  } catch (fcmErr) {
    console.error('pickupLoanSlipService: send FCM failed', fcmErr?.message || fcmErr);
  }

  // SOCKET
  try {
    let targetUserId = txResult.loanSlip.readerId;
    try {
      const rr = await Reader.findByPk(txResult.loanSlip.readerId, { attributes: ['accountId'] });
      if (rr?.accountId) targetUserId = rr.accountId;
    } catch { }

    const socketData = {
      type: 'PICKUP_CONFIRMED',
      slipId: String(txResult.loanSlip.loanSlipId),
      loanDate: String(txResult.loanDate),
      dueDate: String(txResult.dueDate),
      itemsCount: String(txResult.processedDetails.length),
      notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
      link: `/loan/${txResult.loanSlip.loanSlipId}`
    };

    emitToUser(targetUserId, 'pickupConfirmed', socketData);
    console.log('✅ Socket emitted →', { targetUserId, event: 'pickupConfirmed', socketData });
  } catch (socketErr) {
    console.error('pickupLoanSlipService: send socket failed', socketErr?.message || socketErr);
  }

  return {
    message: 'Xác nhận độc giả đã đến lấy: các item chuyển sang BORROWED',
    loanSlip: txResult.loanSlip,
    processedDetails: txResult.processedDetails,
    loanDate: txResult.loanDate,
    dueDate: txResult.dueDate
  };
}





// ==========================
// XÓA 1 LOAN DETAIL
// ==========================
// ==========================
// XÓA 1 LOAN DETAIL
// ==========================
async function removeLoanDetailService({ slipId, loanDetailId, reason, librarianId }) {
  if (!slipId || !loanDetailId) {
    const e = new Error('Thiếu slipId hoặc loanDetailId'); e.status = 400; throw e;
  }

  const txResult = await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(slipId, {
      include: [
        { model: Reader, include: [{ model: Account }] },
        { model: LoanDetail, as: 'details', include: [{ model: DocumentCopy, include: [{ model: Document }] }] }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) { const e = new Error('Không tìm thấy phiếu'); e.status = 404; throw e; }

    const slipStatus = String(slip.status || '').toUpperCase(); // 🆕 lưu lại trạng thái phiếu

    const target = (slip.details || []).find(
      (d) => String(d.loanDetailId || d.id) === String(loanDetailId)
    );
    if (!target) { const e = new Error('Không tìm thấy tài liệu trong phiếu'); e.status = 404; throw e; }

    // lưu lý do vào note của LoanDetail (lý do thủ thư xoá)
    target.note = reason || null;
    await target.save({ transaction: t });

    const removedItem = {
      title: target.DocumentCopy?.Document?.title || null,
      documentId: target.DocumentCopy?.Document?.documentId || null,
      documentCopyId: target.documentCopyId || null,
      loanDetailId: target.loanDetailId || target.id || null
    };

    // trả bản sao về AVAILABLE nếu cần
    try {
      if (target.documentCopyId) {
        await DocumentCopy.update(
          { status: 'AVAILABLE' },
          { where: { documentCopyId: target.documentCopyId }, transaction: t }
        );
      }
    } catch (err) {
      console.warn('removeLoanDetailService: cannot set DocumentCopy AVAILABLE', err?.message || err);
    }

    // xoá chi tiết
    await target.destroy({ transaction: t });

    // đếm còn lại
    const remain = await LoanDetail.count({
      where: { loanSlipId: slipId },
      transaction: t
    });

    // ✅ CLEAN LoanSlip.note: bỏ dòng READER_CANCEL_DETAIL_REQUEST của detail này (nếu có)
    if (slip.note) {
      const oldNote = String(slip.note);
      const lines = oldNote.split('\n');

      const idToken = `loanDetailId=${loanDetailId}`;
      const filteredLines = lines.filter((line) => {
        // chỉ xử lý các dòng request huỷ detail
        if (!line.includes('[READER_CANCEL_DETAIL_REQUEST')) return true;

        // nếu dòng không phải của loanDetailId hiện tại thì giữ lại
        if (!line.includes(idToken)) return true;

        // đúng dòng request huỷ của detail này -> loại bỏ
        return false;
      });

      const newNote = filteredLines.join('\n').trim() || null;

      if (newNote !== oldNote) {
        slip.note = newNote;
        await slip.save({ transaction: t });
      }
    }

    // Nếu vẫn còn detail => tạo notification "LOAN_DETAIL_REMOVED" bình thường
    let createdNotification = null;
    if (remain > 0) {
      try {
        createdNotification = await createNotificationSafe({
          readerId: slip.readerId,
          type: 'LOAN_DETAIL_REMOVED',
          title: `Một tài liệu đã bị xoá khỏi phiếu #${slipId}`,
          content: `Tài liệu "${removedItem.title || ''}" đã bị xoá. Lý do: ${reason || '—'}.`,
          priority: 'NORMAL',
          link: `/loan/${slipId}`,
          isRead: 0
        }, t);
      } catch (nerr) {
        createdNotification = null;
      }
    }

    return {
      deletedSlip: remain === 0,
      slipStatus,                         // 🆕 trả ra trạng thái ban đầu của phiếu
      readerId: slip.readerId,
      readerEmail: slip.Reader?.Account?.email || slip.reader?.Account?.email || null,
      fullName: slip.Reader?.fullName || slip.reader?.fullName || 'Độc giả',
      removedItem,
      librarianId,
      notificationId: createdNotification
        ? (createdNotification.notificationID || createdNotification.id || null)
        : null
    };
  }); // end tx

  // Nếu đã xoá hết detail -> tự động HUỶ CẢ PHIẾU tuỳ theo trạng thái
  if (txResult.deletedSlip) {
    const status = String(txResult.slipStatus || '').toUpperCase();
    const finalReason =
      reason ||
      'Xoá mục cuối cùng trong phiếu, hệ thống tự động huỷ toàn bộ phiếu.';

    try {
      if (status === 'PENDING') {
        // Phiếu đặt trước chưa duyệt
        await cancelReservationService({
          loanSlipId: slipId,
          reason: finalReason,
          librarianId
        });
      } else if (status === 'WAITING_FOR_PICKUP') {
        // Phiếu chờ đến lấy
        await cancelLoanSlipService({
          slipId,
          reason: finalReason,
          librarianId
        });
      } else {
        // Các trạng thái khác (BORROWING, ...) hiện tại không auto huỷ,
        // chỉ log lại cho chắc
        console.warn(
          'removeLoanDetailService: deleted last detail but slip in unexpected status =',
          status
        );
      }
    } catch (cancelErr) {
      console.error(
        'removeLoanDetailService: auto cancel slip failed',
        cancelErr?.message || cancelErr
      );
    }
  } else {
    // ✅ Chỉ gửi email/FCM/socket khi CHƯA huỷ cả phiếu
    try {
      const finalEmail = txResult.readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
      if (finalEmail) {
        await mailService.sendLoanDetailRemovedEmail(finalEmail, {
          fullName: txResult.fullName,
          slipId,
          removedItem: txResult.removedItem,
          reason,
          librarianId
        });

        if (txResult.notificationId && Notification) {
          const pk = Notification.primaryKeyAttribute || 'notificationID';
          const where = {}; where[pk] = txResult.notificationId;
          try { await Notification.update({ emailAt: new Date() }, { where }); } catch (err) { /* ignore */ }
        }
      }
    } catch (mailErr) {
      console.error('removeLoanDetailService: send email failed', mailErr?.message || mailErr);
    }

    // FCM
    try {
      const payload = buildFcmPayload({
        title: `Một tài liệu bị xoá khỏi phiếu #${slipId}`,
        body: `Tài liệu "${txResult.removedItem.title || ''}" đã bị xoá. Lý do: ${reason || '—'}.`,
        data: {
          type: 'LOAN_DETAIL_REMOVED',
          slipId: String(slipId),
          loanDetailId: String(txResult.removedItem.loanDetailId || ''),
          notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
          link: `/loan/${slipId}`
        }
      });
      await sendFcmToReader(txResult.readerId, payload);
    } catch (fcmErr) {
      console.error('removeLoanDetailService: send FCM failed', fcmErr?.message || fcmErr);
    }

    // SOCKET.IO EMIT (non-critical)
    try {
      let targetUserId = txResult.readerId;
      try {
        const rr = await Reader.findByPk(txResult.readerId, { attributes: ['accountId'] });
        if (rr?.accountId) targetUserId = rr.accountId;
      } catch (e) {
        // ignore, giữ targetUserId = readerId
      }

      const socketData = {
        type: 'LOAN_DETAIL_REMOVED',
        slipId: String(slipId),
        loanDetailId: String(txResult.removedItem.loanDetailId || ''),
        removedTitle: txResult.removedItem.title || '',
        reason: reason || '',
        notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
        link: `/loan/${slipId}`
      };

      if (typeof emitToUser === 'function') {
        emitToUser(targetUserId, 'loanDetailRemoved', socketData);
        console.log('✅ removeLoanDetailService: Socket emitted to user', { targetUserId, socketData });
      } else {
        console.warn('⚠️ removeLoanDetailService: emitToUser không khả dụng, bỏ qua emit socket');
      }
    } catch (socketErr) {
      console.error('removeLoanDetailService: send socket failed', socketErr?.message || socketErr);
    }
  }

  return {
    deletedSlip: txResult.deletedSlip,
    message: txResult.deletedSlip
      ? 'Đã xoá mục cuối cùng, phiếu đã được huỷ.'
      : 'Đã xoá 1 tài liệu khỏi phiếu',
    slipId,
    notificationId: txResult.notificationId || null
  };
}





// ==========================
// XÓA TOÀN BỘ PHIẾU
// ==========================
async function cancelLoanSlipService({ slipId, reason, librarianId }) {
  if (!slipId) { const e = new Error('Thiếu slipId'); e.status = 400; throw e; }

  const txResult = await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(slipId, {
      include: [
        { model: Reader, include: [{ model: Account }] },
        { model: LoanDetail, as: 'details', include: [{ model: DocumentCopy, include: [{ model: Document }] }] }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) { const e = new Error('Không tìm thấy phiếu'); e.status = 404; throw e; }

    const readerEmail = slip.Reader?.Account?.email || slip.reader?.Account?.email || null;
    const fullName = slip.Reader?.fullName || slip.reader?.fullName || 'Độc giả';
    let librarianName = 'Thủ thư';
    try {
      if (librarianId) {
        const libAcc = await Account.findByPk(librarianId, { transaction: t });
        librarianName = libAcc?.fullName || libAcc?.full_name || librarianName;
      }
    } catch (err) { /* ignore */ }

    // cập nhật note
    slip.note = reason || null;
    await slip.save({ transaction: t });

    // trả các document copy về AVAILABLE nếu cần
    for (const d of slip.details || []) {
      try {
        if (d.documentCopyId) {
          await DocumentCopy.update({ status: 'AVAILABLE' }, { where: { documentCopyId: d.documentCopyId }, transaction: t });
        }
      } catch (err) {
        console.warn('cancelLoanSlipService: cannot set DocumentCopy AVAILABLE', err?.message || err);
      }
    }

    const itemsForEmail = (slip.details || []).map(d => ({
      title: d.DocumentCopy?.Document?.title || null,
      documentId: d.DocumentCopy?.Document?.documentId || null,
      documentCopyId: d.documentCopyId || d.DocumentCopy?.documentCopyId || null
    }));

    // xóa loan details rồi xóa slip
    await LoanDetail.destroy({ where: { loanSlipId: slipId }, transaction: t });
    await slip.destroy({ transaction: t });

    // tạo notification (không throw)
    let createdNotification = null;
    try {
      createdNotification = await createNotificationSafe({
        readerId: slip.readerId,
        type: 'LOAN_SLIP_CANCELLED',
        title: `Phiếu mượn #${slipId} đã bị hủy`,
        content: `Phiếu #${slipId} đã bị hủy bởi ${librarianName}. Lý do: ${reason || '—'}.`,
        priority: 'HIGH',
        link: `/loan/${slipId}`,
        isRead: 0
      }, t);
    } catch (nerr) {
      createdNotification = null;
    }

    return {
      readerId: slip.readerId,
      readerEmail,
      fullName,
      librarianName,
      itemsForEmail,
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  }); // end tx

  // retry notification ngoài tx nếu cần
  try {
    if (!txResult.notificationId) {
      const retry = await createNotificationSafe({
        readerId: txResult.readerId,
        type: 'LOAN_SLIP_CANCELLED',
        title: `Phiếu mượn #${slipId} đã bị hủy`,
        content: `Phiếu #${slipId} đã bị hủy. Lý do: ${reason || '—'}.`,
        priority: 'HIGH',
        link: `/loan/${slipId}`,
        isRead: 0
      }, null);
      if (retry) txResult.notificationId = retry.notificationID || retry.id || null;
    }
  } catch (err) {
    console.warn('cancelLoanSlipService: retry create notification failed', err?.message || err);
  }

  // gửi email (non-critical)
  try {
    const finalEmail = txResult.readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
    if (finalEmail) {
      await mailService.sendLoanSlipCancelledEmail(finalEmail, {
        fullName: txResult.fullName,
        slipId,
        items: txResult.itemsForEmail,
        reason,
        librarianName: txResult.librarianName
      });

      if (txResult.notificationId && Notification) {
        const pk = Notification.primaryKeyAttribute || 'notificationID';
        const where = {}; where[pk] = txResult.notificationId;
        try { await Notification.update({ emailAt: new Date() }, { where }); } catch (err) { /* ignore */ }
      }
    }
  } catch (mailErr) {
    console.error('cancelLoanSlipService: send email failed', mailErr?.message || mailErr);
  }

  // FCM
  try {
    if (txResult.readerId) {
      const payload = buildFcmPayload({
        title: `Phiếu mượn #${slipId} đã bị hủy`,
        body: `Phiếu #${slipId} đã bị hủy. Lý do: ${reason || '—'}.`,
        data: {
          type: 'LOAN_SLIP_CANCELLED',
          slipId: String(slipId),
          itemsCount: String((txResult.itemsForEmail || []).length),
          notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
          link: `/loan/${slipId}`
        }
      });
      await sendFcmToReader(txResult.readerId, payload);
    }
  } catch (fcmErr) {
    console.error('cancelLoanSlipService: send FCM failed', fcmErr?.message || fcmErr);
  }

  // -----------------------------
  // SOCKET.IO EMIT (non-critical)
  // -----------------------------
  try {
    // Lấy targetUserId: ưu tiên accountId nếu có, ngược lại dùng readerId
    let targetUserId = txResult.readerId;
    try {
      const rr = await Reader.findByPk(txResult.readerId, { attributes: ['accountId'] });
      if (rr?.accountId) targetUserId = rr.accountId;
    } catch (e) {
      // ignore
    }

    const socketData = {
      type: 'LOAN_SLIP_CANCELLED',
      slipId: String(slipId),
      reason: reason || '',
      itemsCount: String((txResult.itemsForEmail || []).length),
      notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
      link: `/loan/${slipId}`
    };

    if (typeof emitToUser === 'function') {
      emitToUser(targetUserId, 'loanSlipCancelled', socketData);
      console.log('✅ cancelLoanSlipService: Socket emitted to user', { targetUserId, socketData });
    } else {
      console.warn('⚠️ cancelLoanSlipService: emitToUser không khả dụng, bỏ qua emit socket');
    }
  } catch (socketErr) {
    console.error('cancelLoanSlipService: send socket failed', socketErr?.message || socketErr);
    // Không throw — socket lỗi không ảnh hưởng
  }

  return {
    message: 'Đã hủy phiếu thành công',
    slipId,
    notificationId: txResult.notificationId || null
  };
}




/**
 * HỦY PHIẾU ĐẶT TRƯỚC (PENDING)
 * - Chỉ áp dụng cho phiếu ở trạng thái PENDING (chưa gán documentCopy)
 * - Lý do lưu vào slip.note
 * - Xóa tất cả LoanDetail liên quan (vì là reservation chưa có copy)
 * - Xóa LoanSlip
 * - Gửi email thông báo bằng mailService.sendReservationCancelledEmail
 *
 * payload: { loanSlipId, reason, librarianId }
 */
async function cancelReservationService({ loanSlipId, reason, librarianId }) {
  if (!loanSlipId) { const e = new Error('Thiếu loanSlipId'); e.status = 400; throw e; }

  const txResult = await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(Number(loanSlipId), {
      include: [
        { model: Reader, include: [{ model: Account }] },
        { model: LoanDetail, as: 'details' }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) { const e = new Error('Không tìm thấy phiếu'); e.status = 404; throw e; }

    const status = String((slip.status || '').toUpperCase());
    if (status !== 'PENDING') { const e = new Error('Chỉ có thể hủy phiếu ở trạng thái PENDING'); e.status = 409; throw e; }

    slip.note = reason || null;
    await slip.save({ transaction: t });

    const loanDetails = slip.details || [];
    const itemsForEmail = loanDetails.map(d => ({
      // map sang cấu trúc gần với template mail
      requestedDocumentId: d.loanDetailId || d.id || null,
      title: null, // reservation thường chưa gán Document, để template dùng fallback
      originalNote: d.note || null
    }));

    await LoanDetail.destroy({ where: { loanSlipId: slip.loanSlipId }, transaction: t });
    await slip.destroy({ transaction: t });

    let createdNotification = null;
    try {
      createdNotification = await createNotificationSafe({
        readerId: slip.readerId,
        type: 'RESERVATION_CANCELLED',
        title: `Phiếu đặt trước #${slip.loanSlipId} đã bị hủy`,
        content: `Phiếu #${slip.loanSlipId} đã bị hủy. Lý do: ${reason || '—'}.`,
        priority: 'NORMAL',
        link: `/loan/${slip.loanSlipId}`,
        isRead: 0
      }, t);
    } catch (nerr) {
      createdNotification = null;
    }

    return {
      slipId: slip.loanSlipId,
      readerId: slip.readerId,
      readerEmail: slip.Reader?.Account?.email || slip.reader?.Account?.email || null,
      librarianId,
      itemsForEmail,
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  }); // end tx

  // retry notification nếu cần
  try {
    if (!txResult.notificationId) {
      const retryNotif = await createNotificationSafe({
        readerId: txResult.readerId,
        type: 'RESERVATION_CANCELLED',
        title: `Phiếu đặt trước #${txResult.slipId} đã bị hủy`,
        content: `Phiếu #${txResult.slipId} đã bị hủy. Lý do: ${reason || '—'}.`,
        priority: 'NORMAL',
        link: `/loan/${txResult.slipId}`,
        isRead: 0
      }, null);
      if (retryNotif) txResult.notificationId = retryNotif.notificationID || retryNotif.id || null;
    }
  } catch (err) {
    console.warn('cancelReservationService: retry create notification failed', err?.message || err);
  }

  // gửi email hủy reservation (non-critical) — dùng HẲN sendReservationCancelledEmail
  try {
    const finalEmail = txResult.readerEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null;
    if (finalEmail) {
      const readerName = (await Reader.findByPk(txResult.readerId, { attributes: ['fullName'] }))?.fullName || 'Độc giả';

      await mailService.sendReservationCancelledEmail(finalEmail, {
        fullName: readerName,
        slipId: txResult.slipId,
        items: txResult.itemsForEmail,
        reason,
        librarianName: '', // nếu muốn có tên thủ thư thì sau này tra thêm
      });

      if (txResult.notificationId && Notification) {
        const pk = Notification.primaryKeyAttribute || 'notificationID';
        const where = {}; where[pk] = txResult.notificationId;
        try { await Notification.update({ emailAt: new Date() }, { where }); } catch (err) { /* ignore */ }
      }
    }
  } catch (mailErr) {
    console.error('cancelReservationService: send email failed', mailErr?.message || mailErr);
  }

  // FCM
  try {
    if (txResult.readerId) {
      const payload = buildFcmPayload({
        title: `Phiếu đặt trước #${txResult.slipId} — Đã bị hủy`,
        body: `Phiếu #${txResult.slipId} đã bị hủy. Lý do: ${reason || '—'}.`,
        data: {
          type: 'RESERVATION_CANCELLED',
          slipId: String(txResult.slipId),
          itemsCount: String((txResult.itemsForEmail || []).length),
          notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
          link: `/loan/${txResult.slipId}`
        }
      });
      await sendFcmToReader(txResult.readerId, payload);
    }
  } catch (fcmErr) {
    console.error('cancelReservationService: send FCM failed', fcmErr?.message || fcmErr);
  }

  // -----------------------------
  // SOCKET.IO EMIT (non-critical)
  // -----------------------------
  try {
    // Lấy targetUserId: ưu tiên accountId nếu có, ngược lại dùng readerId
    let targetUserId = txResult.readerId;
    try {
      const rr = await Reader.findByPk(txResult.readerId, { attributes: ['accountId'] });
      if (rr?.accountId) targetUserId = rr.accountId;
    } catch (e) {
      // ignore
    }

    const socketData = {
      type: 'RESERVATION_CANCELLED',
      slipId: String(txResult.slipId),
      reason: reason || '',
      itemsCount: String((txResult.itemsForEmail || []).length),
      notificationId: txResult.notificationId ? String(txResult.notificationId) : '',
      link: `/loan/${txResult.slipId}`
    };

    if (typeof emitToUser === 'function') {
      emitToUser(targetUserId, 'reservationCancelled', socketData);
      console.log('✅ cancelReservationService: Socket emitted to user', { targetUserId, socketData });
    } else {
      console.warn('⚠️ cancelReservationService: emitToUser không khả dụng, bỏ qua emit socket');
    }
  } catch (socketErr) {
    console.error('cancelReservationService: send socket failed', socketErr?.message || socketErr);
    // Không throw — socket lỗi không ảnh hưởng
  }

  return { message: 'Đã hủy phiếu đặt trước thành công', slipId: txResult.slipId, notificationId: txResult.notificationId || null };
}


async function calculateDamageOnly({ conditionBorrow, conditionReturn, coverPrice }) {
  // validate
  const borrow = Number(conditionBorrow) || 100;
  const ret = Number(conditionReturn);
  if (isNaN(ret) || ret < 0 || ret > 100) {
    const e = new Error('conditionReturn phải là số 0-100');
    e.status = 400; throw e;
  }
  const price = Number(coverPrice) || 0;

  // reuse helper
  const damageFine = calculateDamageFine(borrow, ret, price);
  return { damageFine };
}

// đặt trong adminLoanSlip.service.js
async function computeReturnFines({ loanDetailId, dueDate, returnDate, conditionBorrow, conditionReturn, coverPrice, isLost = false }) {
  // nếu loanDetailId có thì load dữ liệu cần thiết
  let due = dueDate;
  let borrowCond = conditionBorrow;
  let price = coverPrice;
  if (loanDetailId) {
    const detail = await LoanDetail.findByPk(loanDetailId, {
      include: [{ model: LoanSlip, attributes: ['dueDate'] }, { model: DocumentCopy, include: [{ model: Document, attributes: ['coverPrice'] }] }]
    });
    if (!detail) { const e = new Error('Không tìm thấy LoanDetail'); e.status = 404; throw e; }
    due = due || detail.LoanSlip?.dueDate;
    borrowCond = borrowCond ?? detail.conditionBorrow;
    price = price ?? detail.DocumentCopy?.Document?.coverPrice;
  }

  if (!returnDate) { const e = new Error('Thiếu returnDate'); e.status = 400; throw e; }

  const overdueFine = due ? calculateOverdueFine(due, returnDate) : 0;
  const lostFine = isLost ? calculateLostFine(price) : 0;
  const damageFine = isLost ? 0 : calculateDamageFine(borrowCond, Number(conditionReturn), price);

  const total = Number(overdueFine) + Number(damageFine) + Number(lostFine);
  return { overdueFine, damageFine, lostFine, totalFine: total };
}


async function handleLostBookAndCharge({ loanDetailId, librarianId, returnDate }) {
  console.log('[handleLostBookAndCharge] called with', { loanDetailId, librarianId, returnDate });
  if (!loanDetailId) { const e = new Error('Thiếu loanDetailId'); e.status = 400; throw e; }
  // returnDate optional (có thể dùng today)
  const returnDateStr = returnDate || fmtToday();

  return await sequelize.transaction(async (t) => {
    // 🔹 Chuẩn hóa librarianId: có thể FE gửi nhầm accountId
    const resolvedLibrarianId = await resolveLibrarianIdFlexible(librarianId, t);

    // load loan detail + related
    const detail = await LoanDetail.findByPk(loanDetailId, {
      include: [
        { model: LoanSlip, attributes: ['loanSlipId', 'readerId', 'dueDate'] },
        { model: DocumentCopy, include: [{ model: Document, attributes: ['coverPrice', 'title', 'documentId'] }] }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!detail) { const e = new Error('LoanDetail không tồn tại'); e.status = 404; throw e; }
    if (String((detail.status || '').toUpperCase()) !== 'BORROWED') {
      const e = new Error('LoanDetail không ở trạng thái BORROWED'); e.status = 409; throw e;
    }

    const slip = detail.LoanSlip;
    const doc = detail.DocumentCopy?.Document;
    const coverPrice = doc?.coverPrice || 0;

    // tính tiền
    const overdueFine = slip.dueDate ? calculateOverdueFine(slip.dueDate, returnDateStr) : 0;
    const lostFine = calculateLostFine(coverPrice); // thường = coverPrice
    const totalFine = Number(overdueFine) + Number(lostFine);

    // cập nhật loanDetail (returnDate, fineAmount, status LOST)
    await detail.update({
      returnDate: returnDateStr,
      conditionReturn: 0,
      fineAmount: totalFine,
      status: 'RETURNED',
      note: (detail.note || '') + ' | Reported lost'
    }, { transaction: t });

    // cập nhật copy
    const copy = detail.DocumentCopy;
    if (copy) {
      await DocumentCopy.update({
        status: 'LOST',
        conditionNote: '0',
        conditionGrade: 'C'
      }, { where: { documentCopyId: copy.documentCopyId }, transaction: t });
    }

    // tìm thẻ member ACTIVE mới nhất
    const memberCard = await MemberCard.findOne({
      where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    // nếu có thẻ, kiểm tra balance
    if (memberCard) {
      const currentBalanceRow = await MemberCard.findByPk(memberCard.memberCardId, { transaction: t, lock: t.LOCK.UPDATE });
      const currentBalance = Number(currentBalanceRow.balance || 0);

      if (currentBalance >= totalFine) {
        // trừ đủ
        await MemberCard.update({
          balance: sequelize.literal(`COALESCE(balance,0) - ${Number(totalFine)}`)
        }, { where: { memberCardId: memberCard.memberCardId }, transaction: t });

        // tạo Payment record - mark là COMPLETED (GHI CHÚ: dùng resolvedLibrarianId)
        await Payment.create({
          readerId: slip.readerId,
          librarianId: resolvedLibrarianId,
          amount: totalFine,
          status: 'COMPLETED',
          paymentType: 'VIOLATION',
          description: `Đền bù mất sách: ${doc?.title || copy?.documentCopyId || ''}`,
          loanDetailId: loanDetailId
        }, { transaction: t });

        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'VIOLATION',
          title: 'Đã trừ tiền bồi thường mất sách',
          content: `Đã trừ ${Number(totalFine).toLocaleString('vi-VN')}đ từ số dư thẻ.`
        }, t);

        return { chargedFromCard: totalFine, payment: null, needsTopup: false };
      } else {
        // không đủ — trừ phần có thể
        const remaining = totalFine - currentBalance;

        if (currentBalance > 0) {
          await MemberCard.update({
            balance: sequelize.literal(`COALESCE(balance,0) - ${currentBalance}`)
          }, { where: { memberCardId: memberCard.memberCardId }, transaction: t });
        }

        const description = `Bổ sung thanh toán phạt mất sách (Slip#${slip.loanSlipId})`;
        const payResp = await payosService.createPaymentLink({
          amount: remaining,
          description,
          orderCode: `lost_${loanDetailId}_${Date.now()}`,
          returnUrl: process.env.PAY_RETURN_URL,
          cancelUrl: process.env.PAY_CANCEL_URL
        });

        // lưu Payment PENDING (dùng resolvedLibrarianId)
        const payment = await Payment.create({
          readerId: slip.readerId,
          librarianId: resolvedLibrarianId,
          amount: remaining,
          status: 'PENDING',
          paymentType: 'VIOLATION',
          description,
          externalRef: payResp.orderCode || null,
          checkoutUrl: payResp.checkoutUrl || payResp.qrCode || null,
          rawResponse: JSON.stringify(payResp || {})
        }, { transaction: t });

        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'VIOLATION',
          title: 'Cần thanh toán bồi thường mất sách',
          content: `Bạn còn nợ ${remaining}đ. Tạo link thanh toán để nạp.`,
          link: payment.checkoutUrl || null
        }, t);

        return {
          chargedFromCard: currentBalance,
          payment: {
            paymentId: payment.paymentId || payment.id || null,
            checkoutUrl: payResp.checkoutUrl,
            qrCode: payResp.qrCode,
            orderCode: payResp.orderCode,
            amountDue: remaining
          },
          needsTopup: true
        };
      }
    } else {
      // không có thẻ: tạo payment cho toàn bộ
      const description = `Thanh toán bồi thường mất sách (Slip#${slip.loanSlipId})`;
      const payResp = await payosService.createPaymentLink({
        amount: totalFine,
        description,
        orderCode: `lost_${loanDetailId}_${Date.now()}`,
        returnUrl: process.env.PAY_RETURN_URL,
        cancelUrl: process.env.PAY_CANCEL_URL
      });

      // lưu Payment PENDING (dùng resolvedLibrarianId)
      const payment = await Payment.create({
        readerId: slip.readerId,
        librarianId: resolvedLibrarianId,
        amount: totalFine,
        status: 'PENDING',
        paymentType: 'VIOLATION',
        description,
        externalRef: payResp.orderCode || null,
        checkoutUrl: payResp.checkoutUrl || payResp.qrCode || null,
        rawResponse: JSON.stringify(payResp || {})
      }, { transaction: t });

      await createNotificationSafe({
        readerId: slip.readerId,
        type: 'VIOLATION',
        title: 'Cần thanh toán bồi thường mất sách',
        content: `Bạn cần thanh toán ${totalFine}đ. Link thanh toán đã được tạo.`,
        link: payment.checkoutUrl || null
      }, t);

      return {
        chargedFromCard: 0,
        payment: {
          paymentId: payment.paymentId || payment.id || null,
          checkoutUrl: payResp.checkoutUrl,
          qrCode: payResp.qrCode,
          orderCode: payResp.orderCode,
          amountDue: totalFine
        },
        needsTopup: true
      };
    }
  }); // end tx
}

/**
 * TẠO PAYMENT PAYOS CHO CÁC VI PHẠM CHƯA THANH TOÁN CỦA 1 PHIẾU
 * - Input: loanSlipId, rawLibrarianId (có thể là librarianId hoặc accountId)
 * - Logic:
 *    + Tìm tất cả Violation của các LoanDetail thuộc phiếu, paymentStatus != 'PAID'
 *    + Nếu đã có Payment VIOLATION PENDING cho phiếu -> trả về payment đó (re-use)
 *    + Nếu chưa có:
 *        * Tính tổng tiền phạt còn lại = tổng fineAmount - các Payment VIOLATION COMPLETED
 *        * Nếu remaining <= 0 -> đánh dấu VIOLATION = PAID, không tạo QR
 *        * Nếu remaining > 0 -> tạo Payment PENDING + gọi PayOS tạo link/QR
 */
async function createViolationPaymentForSlipService(loanSlipId, rawLibrarianId) {
  if (!loanSlipId) {
    const e = new Error('Thiếu loanSlipId');
    e.status = 400;
    throw e;
  }

  return await sequelize.transaction(async (t) => {
    const slip = await LoanSlip.findByPk(loanSlipId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!slip) {
      const e = new Error('Không tìm thấy LoanSlip');
      e.status = 404;
      throw e;
    }

    // Chuẩn hóa librarianId (có thể FE gửi accountId)
    const resolvedLibrarianId = await resolveLibrarianIdFlexible(rawLibrarianId, t);

    // Lấy tất cả LoanDetail của phiếu
    const loanDetails = await LoanDetail.findAll({
      where: { loanSlipId },
      attributes: ['loanDetailId'],
      transaction: t,
    });

    const loanDetailIds = loanDetails.map((d) => d.loanDetailId);
    if (!loanDetailIds.length) {
      const e = new Error('Phiếu không có bản ghi chi tiết để tính vi phạm');
      e.status = 400;
      throw e;
    }

    // Lấy các Violation CHƯA PAID
    const violations = await Violation.findAll({
      where: {
        loanDetailId: { [Op.in]: loanDetailIds },
        deleted: false,
        paymentStatus: { [Op.ne]: 'PAID' },
      },
      transaction: t,
    });

    if (!violations.length) {
      const e = new Error('Phiếu không có vi phạm chưa thanh toán');
      e.status = 400;
      throw e;
    }

    // Nếu đã có Payment VIOLATION PENDING cho phiếu -> re-use
    const existingPending = await Payment.findOne({
      where: {
        loanSlipId,
        paymentType: 'VIOLATION',
        status: 'PENDING',
      },
      order: [['created_at', 'DESC']],
      transaction: t,
    });

    if (existingPending && existingPending.checkoutUrl) {
      return {
        needPayment: true,
        reusedPayment: true,
        payment: {
          paymentId: existingPending.paymentId || existingPending.id,
          amount: Number(existingPending.amount || 0),
          checkoutUrl: existingPending.checkoutUrl,
          orderCode:
            existingPending.externalRef ||
            existingPending.transactionCode ||
            null,
        },
      };
    }

    // Tổng tiền phạt theo Violation
    const totalFine = violations.reduce(
      (sum, v) => sum + Number(v.fineAmount || 0),
      0
    );

    // Đã thanh toán bao nhiêu cho VIOLATION của phiếu này (CARD / QR)
    const alreadyPaid =
      (await Payment.sum('amount', {
        where: {
          loanSlipId,
          paymentType: 'VIOLATION',
          status: 'COMPLETED',
        },
        transaction: t,
      })) || 0;

    const remaining = Math.max(0, totalFine - Number(alreadyPaid || 0));

    // Nếu không còn gì để thanh toán -> đánh dấu các Violation là PAID
    if (remaining <= 0) {
      await Violation.update(
        {
          paymentStatus: 'PAID',
          paidAt: new Date(),
        },
        {
          where: {
            violationId: { [Op.in]: violations.map((v) => v.violationId) },
            paymentStatus: { [Op.ne]: 'PAID' },
          },
          transaction: t,
        }
      );

      return {
        needPayment: false,
        message: 'Các vi phạm của phiếu đã được thanh toán đủ.',
      };
    }

    // ===== Tạo Payment PENDING + gọi PayOS =====
    let description = `Fine slip #${slip.loanSlipId}`;
    if (description.length > 25) {
      description = description.slice(0, 25);
    }

    const paymentRecord = await Payment.create(
      {
        readerId: slip.readerId,
        librarianId: resolvedLibrarianId || null,
        loanSlipId: slip.loanSlipId,
        amount: remaining,
        status: 'PENDING',
        paymentType: 'VIOLATION',
        paymentMethod: 'PAYOS_QR',
        description,
        transactionCode: null,
        externalRef: null,
        checkoutUrl: null,
        rawResponse: null,
      },
      { transaction: t }
    );

    const payResp = await payosService.createPaymentLink({
      amount: remaining,
      description,
      orderCode: `fine_${slip.loanSlipId}_${paymentRecord.paymentId || paymentRecord.id}`,
      returnUrl: process.env.PAY_RETURN_URL,
      cancelUrl: process.env.PAY_CANCEL_URL,
    });

    await paymentRecord.update(
      {
        transactionCode: String(payResp.orderCode || ''),
        externalRef: payResp.orderCode || null,
        checkoutUrl: payResp.checkoutUrl || payResp.qrCode || null,
        rawResponse: JSON.stringify(payResp || {}),
      },
      { transaction: t }
    );

    // Thông báo cho độc giả
    await createNotificationSafe(
      {
        readerId: slip.readerId,
        type: 'VIOLATION',
        title: 'Cần thanh toán tiền phạt',
        content: `Bạn cần thanh toán ${Number(remaining).toLocaleString(
          'vi-VN'
        )}đ cho các vi phạm của phiếu #${slip.loanSlipId}.`,
        link: paymentRecord.checkoutUrl || null,
      },
      t
    );

    return {
      needPayment: true,
      reusedPayment: false,
      payment: {
        paymentId: paymentRecord.paymentId || paymentRecord.id,
        amount: remaining,
        checkoutUrl: payResp.checkoutUrl,
        qrCode: payResp.qrCode,
        orderCode: payResp.orderCode,
      },
    };
  });
}


module.exports = {
  getAllLoanSlipsService,
  createLoanSlipService,
  approveReservationService,
  getBorrowableCopiesService,
  returnSingleItemService,
  returnBulkItemsService,
  pickupLoanSlipService,
  cancelLoanSlipService,
  removeLoanDetailService,
  cancelReservationService,
  sendFcmToReader,
  buildFcmPayload,
  calculateDamageOnly,
  computeReturnFines,
  handleLostBookAndCharge,
  previewBulkReturnFinesService,
  initBulkReturnPaymentService,
  confirmBulkReturnAfterPaymentService,
  createViolationPaymentForSlipService
};
