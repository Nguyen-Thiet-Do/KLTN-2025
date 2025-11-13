// src/service/adminLoanSlip.service.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');

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
 * Tạo phiếu mượn -> TRỰC TIẾP BORROWING (mượn luôn)
 * (Không còn deposit khi mượn)
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
    const e = new Error('Định dạng loanDate không hợp lệ (YYYY-MM-DD)');
    e.status = 400; throw e;
  }

  const requestedCopyIds = items.map(i => Number(i.documentCopyId));
  const uniqueRequestedCopyIds = new Set(requestedCopyIds);
  if (uniqueRequestedCopyIds.size !== items.length) {
    const e = new Error('Danh sách items có bản sao tài liệu bị trùng (documentCopyId)');
    e.status = 400; throw e;
  }

  return await sequelize.transaction(async (t) => {
    const [reader, librarian] = await Promise.all([
      Reader.findByPk(readerId, { transaction: t }),
      Librarian.findByPk(librarianId, { transaction: t }),
    ]);
    if (!reader) { const e = new Error('Không tìm thấy độc giả'); e.status = 404; throw e; }
    if (!librarian) { const e = new Error('Không tìm thấy thủ thư'); e.status = 404; throw e; }

    // --- LẤY THẺ (MemberCard) CỦA ĐỘC GIẢ -> RỒI LẤY CardType ---
    const memberCard = await MemberCard.findOne({
      where: { readerId, deleted: false, status: 'ACTIVE' },
      order: [['issueDate', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!memberCard) {
      const e = new Error('Độc giả chưa có thẻ hội viên hợp lệ (MemberCard).');
      e.status = 403; throw e;
    }

    // Kiểm tra hạn thẻ nếu tồn tại expiryDate
    if (memberCard.expiryDate) {
      const expiry = parseDateOnly(memberCard.expiryDate);
      if (!expiry) {
        // nếu expiryDate không đúng định dạng, coi là không hợp lệ
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
    const cardType = cardTypeId
      ? await CardType.findByPk(cardTypeId, { transaction: t })
      : null;

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
    const snap = await getReaderBorrowSnapshot(readerId, t);
    const remaining = maxBorrowLimit - snap.activeCount;

    const blockingReasons = [];
    if (snap.overdueCount > 0) {
      blockingReasons.push(`Có ${snap.overdueCount} quyển trễ hạn chưa trả`);
    }
    if (snap.unresolvedViolationCount > 0) {
      blockingReasons.push(`Có ${snap.unresolvedViolationCount} vi phạm/chứng từ phạt chưa giải quyết`);
    }

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
          quota: {
            max: maxBorrowLimit,
            using: snap.activeCount,
            remaining: Math.max(0, remaining),
            requested: items.length
          }
        },
        reasons: blockingReasons
      };
      throw e;
    }

    if (remaining <= 0 || items.length > remaining) {
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
          quota: {
            max: maxBorrowLimit,
            using: snap.activeCount,
            remaining: Math.max(0, remaining),
            requested: items.length
          }
        },
        hint: `Bạn chỉ có thể mượn thêm tối đa ${Math.max(0, remaining)} tài liệu.`
      };
      throw e;
    }

    // Lấy copies & kiểm tra AVAILABLE
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

    // Chặn mượn 2 bản sao cùng 1 đầu sách
    const docIds = copies.map(c => Number(c.documentId));
    const uniqueDocIds = new Set(docIds);
    if (uniqueDocIds.size !== copies.length) {
      const e = new Error('Không được mượn 2 bản sao của cùng một đầu sách');
      e.status = 400; throw e;
    }

    // dueDate mặc định từ cardType nếu không truyền
    let finalDueDate = dueDate || addDaysDateOnly(loanDateStr, borrowDuration);
    const dueD = parseDateOnly(finalDueDate);
    if (!dueD) {
      const e = new Error('Định dạng dueDate không hợp lệ (YYYY-MM-DD)');
      e.status = 400; throw e;
    }
    const dd = daysDiff(loanDateStr, finalDueDate);
    if (!(dd > 0)) {
      const e = new Error('Hạn trả phải sau ngày mượn');
      e.status = 400; throw e;
    }
    if (dd > borrowDuration) {
      const e = new Error(`Hạn trả không được quá ${borrowDuration} ngày theo loại thẻ (${cardType.typeName})`);
      e.status = 400; throw e;
    }

    // TẠO SLIP: trực tiếp BORROWING (mượn luôn), không set deposit
    const slip = await LoanSlip.create({
      readerId,
      librarianId,
      loanDate: loanDateStr,
      dueDate: finalDueDate,
      status: 'BORROWING',
      deleted: false,
    }, { transaction: t });

    const copyById = new Map(copies.map(c => [Number(c.documentCopyId), c]));

    for (const it of items) {
      const cp = copyById.get(Number(it.documentCopyId));
      // === CHỈNH: luôn ưu tiên lấy DocumentCopy.conditionNote ===
      const borrowCond = sanitizeBorrowCondition(
        cp?.conditionNote ?? it.conditionBorrow ?? cp?.conditionGrade ?? null
      );

      await LoanDetail.create({
        loanSlipId: slip.loanSlipId,
        documentCopyId: it.documentCopyId,
        status: 'BORROWED',
        note: it.note ?? null,
        conditionBorrow: borrowCond,
      }, { transaction: t });

      // cập nhật bản sao thành BORROWED ngay
      await DocumentCopy.update(
        { status: 'BORROWED' },
        { where: { documentCopyId: it.documentCopyId }, transaction: t }
      );
    }

    return {
      loanSlip: slip,
      items,
      payment: null,
      message: 'Phiếu mượn được tạo và kích hoạt (BORROWING).'
    };
  });
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

  return await sequelize.transaction(async (t) => {
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

    // Lấy memberCard (thẻ) của reader và từ đó lấy cardType
    const reader = await Reader.findByPk(slip.readerId, { transaction: t });
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
    const borrowDuration = Number(cardType.borrowDuration) || 0;

    const assignMap = new Map(assignments.map(a => [Number(a.loanDetailId), Number(a.documentCopyId)]));
    const condMap = new Map(conditions.map(c => [Number(c.loanDetailId), sanitizeBorrowCondition(c.conditionBorrow)]));

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

    const chosenCopyIds = new Map(); // loanDetailId -> documentCopyId

    for (const [documentId, details] of groups.entries()) {
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

      const need = details.length - preset.length;
      if (need > 0) {
        const availableCopies = await DocumentCopy.findAll({
          where: { documentId, deleted: false, status: 'AVAILABLE' },
          limit: need,
          attributes: ['documentCopyId'],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (availableCopies.length < need) {
          const e = new Error(`Tài liệu #${documentId} không đủ bản sao AVAILABLE để duyệt`);
          e.status = 400; throw e;
        }
        let idx = 0;
        for (const d of details) {
          if (!chosenCopyIds.has(d.loanDetailId)) {
            chosenCopyIds.set(d.loanDetailId, availableCopies[idx++].documentCopyId);
          }
        }
      }
    }

    // Prefetch chosen copy condition info
    const chosenIdsSet = new Set([...chosenCopyIds.values()]);
    const chosenIds = [...chosenIdsSet];
    const chosenCopies = chosenIds.length
      ? await DocumentCopy.findAll({
        where: { documentCopyId: chosenIds },
        attributes: ['documentCopyId', 'conditionGrade', 'conditionNote'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      : [];
    const chosenCopyMap = new Map(chosenCopies.map(c => [Number(c.documentCopyId), c]));

    // Cập nhật pendingDetails -> WAITING_FOR_PICKUP và ON_HOLD cho copy
    for (const d of pendingDetails) {
      const copyId = chosenCopyIds.get(d.loanDetailId);
      const cp = chosenCopyMap.get(Number(copyId));
      const overrideCond = condMap.get(d.loanDetailId);
      // === CHỈNH: ưu tiên DocumentCopy.conditionNote ===
      const borrowCond = sanitizeBorrowCondition(
        cp?.conditionNote ?? overrideCond ?? cp?.conditionGrade ?? null
      );

      await d.update({
        documentCopyId: copyId,
        status: 'WAITING_FOR_PICKUP',
        conditionBorrow: borrowCond,
      }, { transaction: t });

      await DocumentCopy.update(
        { status: 'ON_HOLD' },
        { where: { documentCopyId: copyId }, transaction: t }
      );
    }

    // cập nhật dueDate nếu chưa có
    let newDueDate = dueDate || slip.dueDate;
    if (!newDueDate) {
      newDueDate = addDaysDateOnly(fmtToday(), borrowDuration);
    }

    await slip.update({
      librarianId: Number(librarianId),
      dueDate: newDueDate,
      status: 'WAITING_FOR_PICKUP',
    }, { transaction: t });

    return {
      message: 'Duyệt phiếu thành công. Phiếu đã chuyển sang WAITING_FOR_PICKUP (chờ độc giả đến lấy).',
      loanSlipId: slip.loanSlipId,
      slipStatus: 'WAITING_FOR_PICKUP',
      payment: null,
    };
  });
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

/**
 * HELPER: Tính tiền phạt hư hỏng
 */
function calculateDamageFine(conditionBorrow, conditionReturn, coverPrice) {
  const borrow = Number(conditionBorrow) || 100;
  const returnCond = Number(conditionReturn) || 100;
  const price = Number(coverPrice) || 0;

  if (returnCond >= borrow) return 0;

  const degradation = borrow - returnCond;
  return Math.round((degradation / 100) * price);
}

/**
 * HELPER: Tính tiền bồi thường mất sách
 */
function calculateLostFine(coverPrice) {
  return Number(coverPrice) || 0;
}

/**
 * TRẢ TỪNG QUYỂN (PARTIAL RETURN)
 * - Không sử dụng deposit để khấu trừ (deposit đã loại).
 * - Phạt vẫn được tính và sẽ tạo Payment (status 'PENDING') để thu sau.
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
            attributes: ['documentId', 'coverPrice']
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

    if (detail.status !== 'BORROWED') {
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

    let overdueFine = 0;
    let damageFine = 0;
    let lostFine = 0;

    if (slip.dueDate) {
      overdueFine = calculateOverdueFine(slip.dueDate, returnDate);
    }

    if (isLost) {
      lostFine = calculateLostFine(coverPrice);
    } else {
      damageFine = calculateDamageFine(
        detail.conditionBorrow,
        conditionReturn,
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

    if (copy) {
      let newCopyStatus = 'AVAILABLE';
      let newCondition = conditionNum;

      if (isLost) {
        newCopyStatus = 'LOST';
        newCondition = 0;
      } else if (conditionNum < 50) {
        newCopyStatus = 'DAMAGED';
      }

      await DocumentCopy.update({
        status: newCopyStatus,
        conditionNote: String(newCondition),
        conditionGrade: newCondition >= 90 ? 'A' : newCondition >= 70 ? 'B' : 'C'
      }, {
        where: { documentCopyId: copy.documentCopyId },
        transaction: t
      });
    }

    let paymentRecord = null;
    if (totalFine > 0) {
      paymentRecord = await Payment.create({
        loanSlipId: slip.loanSlipId,
        readerId: slip.readerId,
        librarianId,
        paymentType: isLost ? 'COMPENSATION' : 'FINE',
        amount: totalFine,
        paymentMethod: 'CASH',
        paymentDate: returnDate,
        transactionCode: `RETURN-${loanDetailId}-${Date.now()}`,
        status: 'PENDING',
        note: `Trả sách: phạt trễ=${overdueFine}đ, hư hỏng=${damageFine}đ, mất=${lostFine}đ`
      }, { transaction: t });
    }

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
      payment: paymentRecord ? {
        paymentId: paymentRecord.paymentId,
        amount: paymentRecord.amount,
        status: paymentRecord.status
      } : null,
      slipFullyReturned: allReturned
    };
  });
}

/**
 * TRẢ TOÀN BỘ PHIẾU (BULK RETURN)
 * - Không sử dụng deposit để khấu trừ; tính phạt và tạo Payment nếu cần.
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
    const slip = await LoanSlip.findByPk(loanSlipId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!slip) {
      const e = new Error('Không tìm thấy LoanSlip');
      e.status = 404;
      throw e;
    }

    if (slip.status !== 'BORROWING') {
      const e = new Error(`LoanSlip không ở trạng thái BORROWING (hiện tại: ${slip.status})`);
      e.status = 409;
      throw e;
    }

    const allDetails = await LoanDetail.findAll({
      where: { loanSlipId },
      include: [{
        model: DocumentCopy,
        include: [{
          model: Document,
          attributes: ['documentId', 'coverPrice']
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

      if (detail.status !== 'BORROWED' || detail.returnDate) {
        continue;
      }

      const copy = detail.DocumentCopy;
      const coverPrice = copy?.Document?.coverPrice || 0;
      const isLost = itemData.isLost || false;

      let overdueFine = 0;
      let damageFine = 0;
      let lostFine = 0;

      if (slip.dueDate) {
        overdueFine = calculateOverdueFine(slip.dueDate, returnDate);
      }

      if (isLost) {
        lostFine = calculateLostFine(coverPrice);
      } else {
        damageFine = calculateDamageFine(
          detail.conditionBorrow,
          itemData.conditionReturn,
          coverPrice
        );
      }

      const itemFine = overdueFine + damageFine + lostFine;

      totalOverdueFine += overdueFine;
      totalDamageFine += damageFine;
      totalLostFine += lostFine;

      await detail.update({
        returnDate,
        conditionReturn: Number(itemData.conditionReturn),
        fineAmount: itemFine,
        status: 'RETURNED',
        note: itemData.note || detail.note
      }, { transaction: t });

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
        overdueFine,
        damageFine,
        lostFine,
        totalFine: itemFine,
      });
    }

    const totalFine = totalOverdueFine + totalDamageFine + totalLostFine;

    let paymentRecord = null;
    if (totalFine > 0) {
      paymentRecord = await Payment.create({
        loanSlipId: slip.loanSlipId,
        readerId: slip.readerId,
        librarianId,
        paymentType: totalLostFine > 0 ? 'COMPENSATION' : 'FINE',
        amount: totalFine,
        paymentMethod: 'CASH',
        paymentDate: returnDate,
        transactionCode: `BULK-RETURN-${loanSlipId}-${Date.now()}`,
        status: 'PENDING',
        note: `Trả nhiều sách: phạt trễ=${totalOverdueFine}đ, hư hỏng=${totalDamageFine}đ, mất=${totalLostFine}đ`
      }, { transaction: t });
    }

    await slip.update({ status: 'RETURNED' }, { transaction: t });

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
      payment: paymentRecord ? {
        paymentId: paymentRecord.paymentId,
        amount: paymentRecord.amount,
        status: paymentRecord.status
      } : null
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
};
