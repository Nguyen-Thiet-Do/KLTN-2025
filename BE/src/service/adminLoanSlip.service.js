// src/service/adminLoanSlip.service.js
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const sequelize = require('../config/database');

const {
  LoanSlip,
  LoanDetail,
  Reader,
  Librarian,
  DocumentCopy,
  Document,
  Payment,
} = require('../model');

const { getDocumentDetailWithDeposit } = require('./documentService');

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
          'depositAmount',
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
 * Tạo phiếu mượn ở trạng thái "PENDING_PAYMENT"
 * Body:
 * {
 *   readerId, librarianId,
 *   loanDate?: 'YYYY-MM-DD', dueDate?: 'YYYY-MM-DD',
 *   items: [{ documentCopyId, depositAmount?, note? }],
 *   totalAmount?: number
 * }
 */
async function createLoanSlipService(body) {
  const {
    readerId,
    librarianId,
    loanDate,
    dueDate,
    items = [],
    totalAmount,
  } = body || {};

  if (!readerId || !librarianId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('Thiếu dữ liệu: readerId, librarianId, items');
    e.status = 400; throw e;
  }

  const computedAmount =
    totalAmount != null
      ? Number(totalAmount)
      : items.reduce((s, it) => s + Number(it.depositAmount || 0), 0);

  if (Number.isNaN(computedAmount) || computedAmount < 0) {
    const e = new Error('totalAmount không hợp lệ');
    e.status = 400; throw e;
  }

  return await sequelize.transaction(async (t) => {
    const [reader, librarian] = await Promise.all([
      Reader.findByPk(readerId, { transaction: t }),
      Librarian.findByPk(librarianId, { transaction: t }),
    ]);
    if (!reader) { const e = new Error('Không tìm thấy độc giả'); e.status = 404; throw e; }
    if (!librarian) { const e = new Error('Không tìm thấy thủ thư'); e.status = 404; throw e; }

    const copyIds = items.map(i => i.documentCopyId);
    const copies = await DocumentCopy.findAll({
      where: { documentCopyId: copyIds },
      transaction: t,
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

    const today = new Date().toISOString().slice(0, 10);
    const slip = await LoanSlip.create({
      readerId,
      librarianId,
      loanDate: loanDate || today,
      dueDate: dueDate || null,
      status: 'PENDING_PAYMENT',
      deleted: false,
    }, { transaction: t });

    for (const it of items) {
      await LoanDetail.create({
        loanSlipId: slip.loanSlipId,
        documentCopyId: it.documentCopyId,
        status: 'PENDING_PAYMENT',
        depositAmount: it.depositAmount ?? null,
        note: it.note ?? null,
      }, { transaction: t });

      await DocumentCopy.update(
        { status: 'ON_HOLD' },
        { where: { documentCopyId: it.documentCopyId }, transaction: t }
      );
    }

    return {
      loanSlip: slip,
      items,
      payment: {
        amount: computedAmount,
        status: 'PENDING',
        message: 'Phiếu mượn đã tạo, chờ thanh toán.',
      }
    };
  });
}

/**
 * Tạo QR thanh toán cho phiếu mượn
 * input: { loanSlipId, amount, description? }
 * - Tạo Payment: PENDING
 * - QR payload JSON: { loanSlipId, amount, desc, tx }
 */
async function createLoanSlipPaymentQRService({ loanSlipId, amount, description }) {
  if (!loanSlipId || amount == null) {
    const e = new Error('Thiếu loanSlipId hoặc amount');
    e.status = 400; throw e;
  }

  const slip = await LoanSlip.findByPk(loanSlipId);
  if (!slip) { const e = new Error('Không tìm thấy phiếu mượn'); e.status = 404; throw e; }

  const slipStatus = String(slip.status || '').toUpperCase();
  if (slipStatus !== 'PENDING_PAYMENT') {
    const e = new Error('Phiếu mượn không ở trạng thái PENDING_PAYMENT');
    e.status = 409; throw e;
  }

  if (!slip.librarianId) {
    const e = new Error('Thiếu librarianId để tạo Payment');
    e.status = 400; throw e;
  }

  const tx = `LS${loanSlipId}-${Date.now()}`;
  const payload = JSON.stringify({
    loanSlipId: Number(loanSlipId),
    amount: Number(amount),
    desc: description || 'Thanh toan phieu muon',
    tx,
  });

  const qrDataUrl = await QRCode.toDataURL(payload);

  const paymentRecord = await Payment.create({
    loanSlipId: Number(loanSlipId),
    readerId: slip.readerId,
    librarianId: slip.librarianId,
    paymentType: 'DEPOSIT',
    amount: Number(amount),
    paymentMethod: 'QR',
    paymentDate: null,
    transactionCode: tx,
    status: 'PENDING',
    note: description || null,
  });

  return {
    paymentId: paymentRecord.paymentId,
    amount: Number(amount),
    status: paymentRecord.status,
    transactionCode: tx,
    qr: { type: 'data-url', content: qrDataUrl },
    qrPayloadExample: JSON.parse(payload),
  };
}

/**
 * Xác nhận thanh toán thành công (coi như đã thanh toán)
 * input: { loanSlipId? , paymentId?, transactionCode? }
 */
async function confirmLoanSlipPaymentService({ loanSlipId, paymentId, transactionCode }) {
  if (!loanSlipId && !paymentId) {
    const e = new Error('Thiếu loanSlipId hoặc paymentId');
    e.status = 400; throw e;
  }

  return await sequelize.transaction(async (t) => {
    let slip = null;

    if (paymentId) {
      const payment = await Payment.findByPk(Number(paymentId), { transaction: t });
      if (!payment) { const e = new Error('Không tìm thấy Payment'); e.status = 404; throw e; }

      if (String(payment.status || '').toUpperCase() === 'COMPLETED') {
        const s = payment.loanSlipId ? await LoanSlip.findByPk(payment.loanSlipId, { transaction: t }) : null;
        return { message: 'Payment đã xác nhận trước đó', loanSlipId: s?.loanSlipId || null };
      }

      if (!payment.loanSlipId) {
        const e = new Error('Payment không gắn với LoanSlip');
        e.status = 400; throw e;
      }
      slip = await LoanSlip.findByPk(payment.loanSlipId, { transaction: t });
      if (!slip) { const e = new Error('Không tìm thấy LoanSlip'); e.status = 404; throw e; }

      if (String(slip.status || '').toUpperCase() !== 'PENDING_PAYMENT') {
        const e = new Error('Phiếu không ở trạng thái PENDING_PAYMENT'); e.status = 409; throw e;
      }

      await payment.update({
        status: 'COMPLETED',
        paymentDate: new Date().toISOString().slice(0, 10),
        transactionCode: transactionCode || payment.transactionCode,
      }, { transaction: t });

    } else {
      slip = await LoanSlip.findByPk(Number(loanSlipId), { transaction: t });
      if (!slip) { const e = new Error('Không tìm thấy LoanSlip'); e.status = 404; throw e; }
      if (String(slip.status || '').toUpperCase() !== 'PENDING_PAYMENT') {
        const e = new Error('Phiếu không ở trạng thái PENDING_PAYMENT'); e.status = 409; throw e;
      }

      await Payment.update({
        status: 'COMPLETED',
        paymentDate: new Date().toISOString().slice(0, 10),
        transactionCode: transactionCode || undefined,
      }, {
        where: { loanSlipId: slip.loanSlipId, status: 'PENDING' },
        transaction: t
      });
    }

    await slip.update({ status: 'OPEN' }, { transaction: t });

    const details = await LoanDetail.findAll({ where: { loanSlipId: slip.loanSlipId }, transaction: t });
    for (const d of details) {
      await d.update({ status: 'BORROWED' }, { transaction: t });
      if (d.documentCopyId) {
        await DocumentCopy.update(
          { status: 'BORROWED' },
          { where: { documentCopyId: d.documentCopyId }, transaction: t }
        );
      }
    }

    return { message: 'Xác nhận thanh toán thành công', loanSlipId: slip.loanSlipId };
  });
}

/**
 * Duyệt phiếu đặt trước -> WAITING_FOR_PICKUP
 * - Gán DocumentCopy AVAILABLE cho từng LoanDetail (hoặc theo chỉ định)
 * - Chốt depositAmount cho từng LoanDetail
 * - Set librarianId, dueDate; ON_HOLD các copy
 * - (tuỳ chọn) tạo Payment PENDING tổng cọc
 */
async function approveReservationService(payload) {
  const {
    loanSlipId,
    librarianId,
    dueDate,
    pricingMode = 'AUTO_MIN', // 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL'
    deposits = [],            // [{ loanDetailId, depositAmount }]
    assignments = [],         // [{ loanDetailId, documentCopyId }]
    createPayment = false,
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
    if (status !== 'PENDING' || String(slip.borrowForm || '') !== 'RESERVATION') {
      const e = new Error('Chỉ duyệt phiếu đặt trước đang ở trạng thái PENDING (borrowForm=RESERVATION)');
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

    const assignMap = new Map(assignments.map(a => [Number(a.loanDetailId), Number(a.documentCopyId)]));
    const depositMap = new Map(deposits.map(d => [Number(d.loanDetailId), Number(d.depositAmount)]));

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

    let totalDeposit = 0;

    for (const d of pendingDetails) {
      const docId = parseRequestedDocId(d.note);
      let deposit = depositMap.has(d.loanDetailId) ? depositMap.get(d.loanDetailId) : null;

      if (deposit == null) {
        const detail = await getDocumentDetailWithDeposit(docId);
        const minDep = detail?.deposit?.minDeposit ?? 0;
        const maxDep = detail?.deposit?.maxDeposit ?? minDep;
        deposit = pricingMode === 'AUTO_MAX' ? maxDep : minDep;
      }

      if (Number.isNaN(Number(deposit)) || Number(deposit) < 0) {
        const e = new Error(`depositAmount không hợp lệ cho LoanDetail #${d.loanDetailId}`);
        e.status = 400; throw e;
      }

      totalDeposit += Number(deposit);

      const copyId = chosenCopyIds.get(d.loanDetailId);
      await d.update({
        documentCopyId: copyId,
        depositAmount: Number(deposit),
        status: 'PENDING_PAYMENT',
      }, { transaction: t });

      await DocumentCopy.update(
        { status: 'ON_HOLD' },
        { where: { documentCopyId: copyId }, transaction: t }
      );
    }

    await slip.update({
      librarianId: Number(librarianId),
      dueDate: dueDate || slip.dueDate,
      status: 'WAITING_FOR_PICKUP',
    }, { transaction: t });

    let payment = null;
    if (createPayment) {
      const txCode = `RSV${slip.loanSlipId}-${Date.now()}`;
      payment = await Payment.create({
        loanSlipId: slip.loanSlipId,
        readerId: slip.readerId,
        librarianId: Number(librarianId),
        paymentType: 'DEPOSIT',
        amount: Number(totalDeposit),
        paymentMethod: 'QR',
        paymentDate: null,
        transactionCode: txCode,
        status: 'PENDING',
        note: 'Đặt trước - chờ thanh toán',
      }, { transaction: t });
    }

    return {
      message: 'Duyệt phiếu đặt trước thành công. Đang chờ độc giả đến lấy.',
      loanSlipId: slip.loanSlipId,
      slipStatus: 'WAITING_FOR_PICKUP',
      totalDeposit,
      payment: payment ? {
        paymentId: payment.paymentId,
        amount: payment.amount,
        status: payment.status,
        transactionCode: payment.transactionCode,
      } : null,
    };
  });
}

module.exports = {
  getAllLoanSlipsService,
  createLoanSlipService,
  createLoanSlipPaymentQRService,
  confirmLoanSlipPaymentService,
  approveReservationService,
};
