// src/service/adminLoanSlip.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const mailService = require('./mailService');
const { emitToUser } = require('../config/socket');

const {
  LoanSlip,
  LoanDetail,
  Reader,
  Librarian,
  DocumentCopy,
  Document,
  Payment,
  CardType,
  MemberCard, // <- thêm model MemberCard
  Notification,
  Account,
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

  // 5) Vi phạm chưa giải quyết (ví dụ: tiền phạt/đền bù chưa thanh toán)
  const unresolvedViolationCount = await Payment.count({
    where: {
      readerId,
      status: 'PENDING',
      paymentType: { [Op.not]: 'DEPOSIT' } // deposit không dùng cho mượn, giữ điều kiện an toàn
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
    sortBy = 'loanDate',
    sortDir = 'DESC',
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
      { model: Reader, attributes: ['readerId', 'fullName'] },
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
          'conditionBorrow',
          'conditionReturn',
          'renewalCount',
          'note',
        ],
        include: [
          {
            model: DocumentCopy,
            attributes: ['documentCopyId', 'barCode'],
            include: [
              {
                model: Document,
                attributes: ['documentId', 'title', 'coverPhoto'],
              },
            ],
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
 * TRẢ TỪNG QUYỂN (PARTIAL RETURN) - SỬA: trừ vào MemberCard thay vì tạo Payment
 * - body: { loanDetailId, returnDate, conditionReturn, isLost = false, note }
 * - librarianId: id của thủ thư thực hiện
 */
async function returnSingleItemService(body, librarianId) {
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

  const conditionNum = Number(conditionReturn);
  if (isNaN(conditionNum) || conditionNum < 0 || conditionNum > 100) {
    const e = new Error('conditionReturn phải là số từ 0-100');
    e.status = 400;
    throw e;
  }

  return await sequelize.transaction(async (t) => {

    const detail = await LoanDetail.findByPk(loanDetailId, {
      include: [
        {
          model: LoanSlip,
          attributes: ['loanSlipId', 'readerId', 'dueDate', 'status']
        },
        {
          model: DocumentCopy,
          include: [{
            model: Document,
            attributes: ['documentId', 'coverPrice', 'title']
          }]
        }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!detail) {
      const e = new Error('Không tìm thấy LoanDetail');
      e.status = 404;
      throw e;
    }

    if (String((detail.status || '').toUpperCase()) !== 'BORROWED') {
      const e = new Error(`LoanDetail không ở trạng thái BORROWED (hiện tại: ${detail.status})`);
      e.status = 409;
      throw e;
    }

    if (detail.returnDate) {
      const e = new Error('LoanDetail đã được trả trước đó');
      e.status = 409;
      throw e;
    }

    const slip = detail.LoanSlip;
    const copy = detail.DocumentCopy;
    const coverPrice = copy?.Document?.coverPrice || 0;

    let overdueFine = slip.dueDate
      ? calculateOverdueFine(slip.dueDate, returnDate)
      : 0;

    let damageFine = 0;
    let lostFine = 0;

    if (isLost) {
      lostFine = calculateLostFine(coverPrice);
    } else {
      damageFine = calculateDamageFine(
        detail.conditionBorrow,
        conditionNum,
        coverPrice
      );
    }

    const totalFine = overdueFine + damageFine + lostFine;

    await detail.update({
      returnDate,
      conditionReturn: conditionNum,
      fineAmount: totalFine,
      status: 'RETURNED',
      note: note || detail.note
    }, { transaction: t });

    // Update DocumentCopy
    if (copy) {
      let newCopyStatus = isLost ? "LOST" :
        conditionNum < 50 ? "DAMAGED" : "AVAILABLE";

      const newCondition = isLost ? 0 : conditionNum;

      await DocumentCopy.update({
        status: newCopyStatus,
        conditionNote: String(newCondition),
        conditionGrade:
          newCondition >= 90 ? 'A'
            : newCondition >= 70 ? 'B' : 'C'
      }, {
        where: { documentCopyId: copy.documentCopyId },
        transaction: t
      });
    }

    // ========================
    // TRỪ TIỀN VÀO THẺ HỘI VIÊN
    // ========================
    let deducted = 0;

    if (totalFine > 0) {
      const memberCard = await MemberCard.findOne({
        where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
        order: [['issueDate', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!memberCard) {
        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'VIOLATION',
          title: 'Không thể trừ tiền phạt',
          content: `Không có thẻ hội viên ACTIVE để trừ ${totalFine}đ.`,
          priority: 'HIGH'
        }, t);
      } else {
        await MemberCard.update({
          balance: sequelize.literal(`COALESCE(balance,0) - ${Number(totalFine)}`)
        }, {
          where: { memberCardId: memberCard.memberCardId },
          transaction: t
        });

        deducted = totalFine;

        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'INFO',
          title: 'Đã trừ tiền phạt',
          content: `Đã trừ ${totalFine}đ vào số dư thẻ hội viên.`,
          priority: 'NORMAL'
        }, t);
      }
    }

    // ========================
    // GỬI EMAIL
    // ========================
    try {
      const reader = await Reader.findByPk(slip.readerId, {
        include: [{ model: Account }]
      });

      const email = reader?.Account?.email;
      const fullName = reader?.fullName || "Độc giả";

      if (email) {
        await mailService.sendReturnReceiptEmail(email, {
          fullName,
          slipId: slip.loanSlipId,
          title: copy?.Document?.title,
          returnDate,
          overdueFine,
          damageFine,
          lostFine,
          totalFine
        });
      }
    } catch (err) {
      console.log("⚠️ Gửi email thất bại:", err.message);
    }

    // ========================
    // GỬI FCM
    // ========================
    try {
      const payload = buildFcmPayload({
        title: `Trả tài liệu thành công`,
        body: `Phiếu #${slip.loanSlipId}, tổng phạt: ${totalFine}đ`,
        data: {
          type: 'RETURN_BOOK',
          slipId: String(slip.loanSlipId),
          loanDetailId: String(detail.loanDetailId),
          totalFine: String(totalFine)
        }
      });

      await sendFcmToReader(slip.readerId, payload);
    } catch (err) {
      console.log("⚠️ Lỗi gửi FCM:", err.message);
    }

    // ========================
    // GỬI SOCKET.IO
    // ========================
    try {
      emitToUser(slip.readerId, "bookReturned", {
        slipId: slip.loanSlipId,
        loanDetailId: detail.loanDetailId,
        totalFine,
        overdueFine,
        damageFine,
        lostFine
      });
    } catch (err) {
      console.log("⚠️ Lỗi gửi socket:", err.message);
    }

    // Kiểm tra đã trả hết chưa
    const allDetails = await LoanDetail.findAll({
      where: { loanSlipId: slip.loanSlipId },
      transaction: t
    });

    const allReturned = allDetails.every(d => d.returnDate !== null);

    if (allReturned) {
      await LoanSlip.update(
        { status: 'RETURNED' },
        { where: { loanSlipId: slip.loanSlipId }, transaction: t }
      );
    }

    return {
      message: 'Trả tài liệu thành công',
      loanDetailId: detail.loanDetailId,
      loanSlipId: slip.loanSlipId,
      returnDate,
      fines: {
        overdue: overdueFine,
        damage: damageFine,
        lost: lostFine,
        total: totalFine
      },
      deductedFromMemberCard: deducted,
      slipFullyReturned: allReturned,
      payment: null
    };

  }); // end transaction
}



/**
 * TRẢ TOÀN BỘ PHIẾU (BULK RETURN)
 * - Không tạo Payment nữa
 * - Tính phạt (damage chỉ khi degradation > 30)
 * - Trừ tổng phạt vào MemberCard.balance (thẻ ACTIVE mới nhất) — cho phép âm
 * - Gửi notification / email / fcm / socket cho độc giả
 *
 * body: { loanSlipId, returnDate, items: [{ loanDetailId, conditionReturn, isLost?, note? }] }
 */
async function returnBulkItemsService(body, librarianId) {
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
    // load slip
    const slip = await LoanSlip.findByPk(loanSlipId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) {
      const e = new Error('Không tìm thấy LoanSlip');
      e.status = 404;
      throw e;
    }

    if (String((slip.status || '').toUpperCase()) !== 'BORROWING') {
      const e = new Error(`LoanSlip không ở trạng thái BORROWING (hiện tại: ${slip.status})`);
      e.status = 409;
      throw e;
    }

    // load all details + copy + document
    const allDetails = await LoanDetail.findAll({
      where: { loanSlipId },
      include: [{
        model: DocumentCopy,
        include: [{
          model: Document,
          attributes: ['documentId', 'coverPrice', 'title']
        }]
      }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const itemMap = new Map(items.map(i => [Number(i.loanDetailId), i]));

    let totalOverdueFine = 0;
    let totalDamageFine = 0;
    let totalLostFine = 0;
    const processedItems = [];

    for (const detail of allDetails) {
      const itemData = itemMap.get(detail.loanDetailId);
      if (!itemData) continue;

      // skip non-borrowed or already returned
      if (String((detail.status || '').toUpperCase()) !== 'BORROWED' || detail.returnDate) {
        continue;
      }

      const copy = detail.DocumentCopy;
      const coverPrice = copy?.Document?.coverPrice || 0;
      const isLost = !!itemData.isLost;

      // overdue
      let overdueFine = 0;
      if (slip.dueDate) {
        try {
          overdueFine = calculateOverdueFine(slip.dueDate, returnDate) || 0;
        } catch (err) {
          overdueFine = 0;
        }
      }

      // lost or damage
      let lostFine = 0;
      let damageFine = 0;
      if (isLost) {
        lostFine = calculateLostFine(coverPrice);
      } else {
        // calculateDamageFine đã được sửa để chỉ tính khi degradation > 30
        damageFine = calculateDamageFine(
          detail.conditionBorrow,
          Number(itemData.conditionReturn),
          coverPrice
        );
      }

      const itemFine = Number(overdueFine) + Number(damageFine) + Number(lostFine);

      totalOverdueFine += overdueFine;
      totalDamageFine += damageFine;
      totalLostFine += lostFine;

      // update loan detail
      await detail.update({
        returnDate,
        conditionReturn: Number(itemData.conditionReturn),
        fineAmount: itemFine,
        status: 'RETURNED',
        note: itemData.note || detail.note
      }, { transaction: t });

      // update copy
      if (copy) {
        let newStatus = 'AVAILABLE';
        let newCondition = Number(itemData.conditionReturn);

        if (isLost) {
          newStatus = 'LOST';
          newCondition = 0;
        } else if (newCondition < 50) {
          newStatus = 'DAMAGED';
        }

        await DocumentCopy.update({
          status: newStatus,
          conditionNote: String(newCondition),
          conditionGrade: newCondition >= 90 ? 'A' : newCondition >= 70 ? 'B' : 'C'
        }, {
          where: { documentCopyId: copy.documentCopyId },
          transaction: t
        });
      }

      processedItems.push({
        loanDetailId: detail.loanDetailId,
        documentCopyId: copy?.documentCopyId,
        title: copy?.Document?.title || null,
        overdueFine,
        damageFine,
        lostFine,
        totalFine: itemFine
      });
    } // end for details

    const totalFine = totalOverdueFine + totalDamageFine + totalLostFine;

    // === Thay vì tạo Payment: trừ tổng phạt vào MemberCard.balance ===
    let deducted = 0;
    if (totalFine > 0) {
      const memberCard = await MemberCard.findOne({
        where: { readerId: slip.readerId, deleted: false, status: 'ACTIVE' },
        order: [['issueDate', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!memberCard) {
        // Không có thẻ: tạo notification cảnh báo (an toàn)
        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'VIOLATION',
          title: 'Không thể trừ tiền phạt (bulk return)',
          content: `Phiếu #${slip.loanSlipId}: cần thu phạt ${totalFine}đ nhưng độc giả không có thẻ hội viên ACTIVE.`,
          priority: 'HIGH'
        }, t);
      } else {
        // Trừ trực tiếp (cho phép âm)
        await MemberCard.update({
          balance: sequelize.literal(`COALESCE(balance,0) - ${Number(totalFine)}`)
        }, {
          where: { memberCardId: memberCard.memberCardId },
          transaction: t
        });

        deducted = totalFine;

        await createNotificationSafe({
          readerId: slip.readerId,
          type: 'INFO',
          title: 'Đã trừ tiền phạt (bulk)',
          content: `Đã trừ ${totalFine}đ vào số dư thẻ hội viên cho phiếu #${slip.loanSlipId}.`,
          priority: 'NORMAL'
        }, t);
      }
    }

    // Cập nhật trạng thái slip = RETURNED
    await slip.update({ status: 'RETURNED' }, { transaction: t });

    // ==== Gửi email / FCM / Socket (bọc try/catch để không rollback) ====
    // Gửi email tóm tắt (nếu có email)
    try {
      const reader = await Reader.findByPk(slip.readerId, { include: [{ model: Account }], transaction: t, lock: t.LOCK.UPDATE });
      const email = reader?.Account?.email || null;
      const fullName = reader?.fullName || 'Độc giả';

      if (email) {
        // Gửi email tóm tắt: dùng sendReturnReceiptEmail nhiều mục -> gửi 1 email tóm tắt
        // Hàm sendReturnReceiptEmail chấp nhận title (chuỗi) nên ta truyền tóm tắt số lượng
        await mailService.sendReturnReceiptEmail(email, {
          fullName,
          slipId: slip.loanSlipId,
          title: `Trả ${processedItems.length} tài liệu`,
          returnDate,
          overdueFine: totalOverdueFine,
          damageFine: totalDamageFine,
          lostFine: totalLostFine,
          totalFine
        });
      }
    } catch (err) {
      console.warn('⚠️ sendReturnReceiptEmail (bulk) failed:', err?.message || err);
      // không throw — không rollback tx
    }

    // Gửi FCM tóm tắt
    try {
      const payload = buildFcmPayload({
        title: `Trả phiếu #${slip.loanSlipId} — ${processedItems.length} tài liệu`,
        body: `Tổng phạt: ${Number(totalFine).toLocaleString('vi-VN')} đ`,
        data: {
          type: 'BULK_RETURN',
          slipId: String(slip.loanSlipId),
          itemsCount: String(processedItems.length),
          totalFine: String(totalFine)
        }
      });

      await sendFcmToReader(slip.readerId, payload);
    } catch (err) {
      console.warn('⚠️ sendFcmToReader (bulk) failed:', err?.message || err);
    }

    // Gửi socket emit tóm tắt
    try {
      emitToUser(slip.readerId, 'bulkReturnCompleted', {
        slipId: slip.loanSlipId,
        items: processedItems.map(it => ({ loanDetailId: it.loanDetailId, title: it.title, totalFine: it.totalFine })),
        totals: {
          overdue: totalOverdueFine,
          damage: totalDamageFine,
          lost: totalLostFine,
          total: totalFine
        },
        deductedFromMemberCard: deducted
      });
    } catch (err) {
      console.warn('⚠️ emitToUser (bulk) failed:', err?.message || err);
    }

    // Trả về kết quả
    return {
      message: 'Trả toàn bộ phiếu mượn thành công',
      loanSlipId: slip.loanSlipId,
      returnDate,
      summary: {
        itemsReturned: processedItems.length,
        totalFines: {
          overdue: totalOverdueFine,
          damage: totalDamageFine,
          lost: totalLostFine,
          total: totalFine
        }
      },
      items: processedItems,
      deductedFromMemberCard: deducted
    };
  }); // end transaction
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

    const target = (slip.details || []).find(d => String(d.loanDetailId || d.id) === String(loanDetailId));
    if (!target) { const e = new Error('Không tìm thấy tài liệu trong phiếu'); e.status = 404; throw e; }

    // lưu lý do
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
        await DocumentCopy.update({ status: 'AVAILABLE' }, { where: { documentCopyId: target.documentCopyId }, transaction: t });
      }
    } catch (err) {
      console.warn('removeLoanDetailService: cannot set DocumentCopy AVAILABLE', err?.message || err);
    }

    // xoá chi tiết
    await target.destroy({ transaction: t });

    // đếm còn lại
    const remain = await LoanDetail.count({ where: { loanSlipId: slipId }, transaction: t });

    // tạo notification không làm lỗi transaction
    let createdNotification = null;
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

    return {
      deletedSlip: remain === 0,
      readerId: slip.readerId,
      readerEmail: slip.Reader?.Account?.email || slip.reader?.Account?.email || null,
      fullName: slip.Reader?.fullName || slip.reader?.fullName || 'Độc giả',
      removedItem,
      librarianId,
      notificationId: createdNotification ? (createdNotification.notificationID || createdNotification.id || null) : null
    };
  }); // end tx

  // gửi email (non-critical)
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

  // -----------------------------
  // SOCKET.IO EMIT (non-critical)
  // -----------------------------
  try {
    // đảm bảo emitToUser đã được import ở đầu file:
    // const { emitToUser } = require('../config/socket');

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
    // không throw — socket lỗi không ảnh hưởng đến kết quả
  }

  return {
    deletedSlip: txResult.deletedSlip,
    message: txResult.deletedSlip ? "Đã xóa mục cuối → phiếu đã bị xoá" : "Đã xoá 1 tài liệu khỏi phiếu",
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

// require payosService ở đầu file (nếu chưa có)
const payosService = require('./payosService'); // đường dẫn theo project

async function handleLostBookAndCharge({ loanDetailId, librarianId, returnDate }) {
  console.log('[handleLostBookAndCharge] called with', { loanDetailId, librarianId, returnDate });
  if (!loanDetailId) { const e = new Error('Thiếu loanDetailId'); e.status = 400; throw e; }
  // returnDate optional (có thể dùng today)
  const returnDateStr = returnDate || fmtToday();

  return await sequelize.transaction(async (t) => {
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

        // tạo Payment record - mark là COMPLETED (GHI CHÚ: thêm librarianId)
        await Payment.create({
          readerId: slip.readerId,
          librarianId: librarianId || null,
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

        // lưu Payment PENDING (thêm librarianId)
        const payment = await Payment.create({
          readerId: slip.readerId,
          librarianId: librarianId || null,
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

      // lưu Payment PENDING (thêm librarianId)
      const payment = await Payment.create({
        readerId: slip.readerId,
        librarianId: librarianId || null,
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

};
