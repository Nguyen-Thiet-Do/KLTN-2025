// src/service/notificationJob.service.js
const cron = require('node-cron');
const { Op, fn, col, where } = require('sequelize');
const sequelize = require('../config/database');
const mailService = require('./mailService');
const { emitToUser } = require('../config/socket'); // <- emit realtime

const {
  LoanSlip,
  LoanDetail,
  Reader,
  DocumentCopy,
  Document,
  Account,
  Notification // <-- đảm bảo model này export trong src/model/index.js
} = require('../model');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TZ = process.env.SERVER_TIMEZONE || 'Asia/Ho_Chi_Minh';

/**
 * Trả về YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh (VN)
 */
function fmtToday() {
  try {
    const now = new Date();
    // convert to VN local time string then parse back to Date to get local midnight in that TZ context
    const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    return local.toISOString().slice(0, 10);
  } catch (e) {
    // fallback: UTC date
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Parse chuỗi 'YYYY-MM-DD' -> Date object at UTC midnight for stability.
 * Sử dụng Date.UTC để tránh lệch do server timezone.
 */
function parseDateOnlyToDate(str) {
  if (!str) return null;
  const parts = String(str).split('-').map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  // create Date at UTC midnight for that date (consistent for diff)
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

/**
 * Trả số ngày b giữa a và b : round((b - a) / ONE_DAY_MS)
 * aStr, bStr: 'YYYY-MM-DD'
 */
function daysDiff(aStr, bStr) {
  const a = parseDateOnlyToDate(aStr);
  const b = parseDateOnlyToDate(bStr);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS);
}

/* Build items list for email */
async function buildItemsForSlip(loanSlipId) {
  const details = await LoanDetail.findAll({
    where: { loanSlipId },
    include: [
      {
        model: DocumentCopy,
        include: [{ model: Document, attributes: ['documentId', 'title'] }]
      }
    ]
  });

  return details.map(d => ({
    loanDetailId: d.loanDetailId,
    documentId: d.DocumentCopy?.Document?.documentId || null,
    title: d.DocumentCopy?.Document?.title || null,
    documentCopyId: d.documentCopyId || null
  }));
}

/* HTML/text builders (tùy chỉnh nếu muốn) */
function buildHtmlReminder(data) {
  const itemsHtml = (data.items || []).map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} (Bản sao #${it.documentCopyId || '—'})</li>`).join('');
  return `
  <!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#333">
    <h3>Thông báo hạn trả sắp tới — Phiếu #${escapeHtml(String(data.slipId))}</h3>
    <p>Chào <strong>${escapeHtml(data.fullName || 'Độc giả')}</strong>,</p>
    <p>Phiếu mượn của bạn có hạn trả <strong>${escapeHtml(data.dueDate)}</strong>. Còn <strong>${escapeHtml(String(data.daysLeft))}</strong> ngày nữa.</p>
    <p><strong>Danh sách tài liệu:</strong></p>
    <ul>${itemsHtml}</ul>
    <p>Vui lòng giữ gìn tài liệu, trả đúng hạn để tránh bị tính phí trễ hạn.</p>
    <p>Địa điểm trả / lấy: ${escapeHtml(data.pickUpLocation || process.env.LIBRARY_ADDRESS || '')}</p>
    <hr>
    <p style="font-size:12px;color:#666">Nếu đã trả rồi, vui lòng bỏ qua thông báo này. Hỗ trợ: ${escapeHtml(process.env.SUPPORT_EMAIL || '')} — ${escapeHtml(process.env.SUPPORT_PHONE || '')}</p>
  </body></html>
  `;
}
function buildTextReminder(data) {
  const itemsText = (data.items || []).map(it => `- ${it.title || ('Tài liệu #' + it.documentId)} (copy:${it.documentCopyId || '—'})`).join('\n');
  return `Phiếu #${data.slipId}\nHạn trả: ${data.dueDate}\nCòn ${data.daysLeft} ngày\n\nDanh sách:\n${itemsText}\n\nVui lòng trả đúng hạn. Hỗ trợ: ${process.env.SUPPORT_EMAIL || ''} ${process.env.SUPPORT_PHONE || ''}`;
}

function buildHtmlOverdue(data) {
  const itemsHtml = (data.items || []).map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} (Bản sao #${it.documentCopyId || '—'})</li>`).join('');

  // 🔥 Thêm cảnh báo khóa tài khoản nếu >= 30 ngày
  const warningHtml = data.overdueDays >= 30
    ? '<p style="color:red;font-weight:bold">⚠️ TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA DO QUÁ HẠN 30 NGÀY. Vui lòng liên hệ thư viện ngay để xử lý.</p>'
    : data.overdueDays >= 25
      ? '<p style="color:orange;font-weight:bold">⚠️ Cảnh báo: Tài khoản sẽ bị khóa nếu quá hạn 30 ngày!</p>'
      : '';

  return `
  <!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#333">
    <h3>THÔNG BÁO QUÁ HẠN — Phiếu #${escapeHtml(String(data.slipId))}</h3>
    <p>Chào <strong>${escapeHtml(data.fullName || 'Độc giả')}</strong>,</p>
    <p>Phiếu mượn của bạn đã <strong>quá hạn ${escapeHtml(String(data.overdueDays))} ngày</strong> (hạn trả: ${escapeHtml(data.dueDate)}).</p>
    ${warningHtml}
    <p><strong>Danh sách tài liệu đang quá hạn:</strong></p>
    <ul>${itemsHtml}</ul>
    <p>Vui lòng trả ngay để tránh phí cao hơn hoặc xử lý vi phạm. Nếu có lý do cần gia hạn, liên hệ thư viện.</p>
    <p>Hỗ trợ: ${escapeHtml(process.env.SUPPORT_EMAIL || '')} — ${escapeHtml(process.env.SUPPORT_PHONE || '')}</p>
    <hr>
    <p style="font-size:12px;color:#666">Thông báo sẽ tiếp tục gửi mỗi 3 ngày cho tới khi trả (tối đa 30 ngày).</p>
  </body></html>
  `;
}
function buildTextOverdue(data) {
  const itemsText = (data.items || []).map(it => `- ${it.title || ('Tài liệu #' + it.documentId)} (copy:${it.documentCopyId || '—'})`).join('\n');
  const warning = data.overdueDays >= 30 ? '\n⚠️ TÀI KHOẢN ĐÃ BỊ KHÓA!\n' : '';
  return `QUÁ HẠN: Phiếu #${data.slipId}\nQuá hạn ${data.overdueDays} ngày (due: ${data.dueDate})${warning}\n\nDanh sách:\n${itemsText}\n\nVui lòng trả hoặc liên hệ: ${process.env.SUPPORT_EMAIL || ''} ${process.env.SUPPORT_PHONE || ''}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Create notification DB row (use existing Notifications table) */
async function createNotificationRow({ readerId, type, title, content, link = null, scheduledAt = null }) {
  const rec = await Notification.create({
    readerId,
    type,
    title: title ? String(title).slice(0, 200) : null,
    content: content || null,
    priority: 'NORMAL',
    link: link || null,
    isRead: 0,
    readAt: null,
    emailAt: null // updated later when email actually sent
  });
  return rec;
}

/* Send email and update notification.emailAt (and content/title if needed) */
async function sendEmailAndMarkNotification(notificationRecord, toEmail, subject, htmlBody, textBody) {
  try {
    await mailService.sendEmail(toEmail, subject, htmlBody, textBody);
    const now = new Date();
    await notificationRecord.update({ emailAt: now });

    // Emit realtime update: notification email sent (client có thể cập nhật UI)
    try {
      if (notificationRecord && notificationRecord.readerId) {
        const payload = {
          notificationID: notificationRecord.notificationID,
          type: notificationRecord.type,
          title: notificationRecord.title,
          content: notificationRecord.content,
          emailAt: now,
          isRead: notificationRecord.isRead
        };
        emitToUser(notificationRecord.readerId, 'notification:email_sent', payload);
      }
    } catch (emitErr) {
      console.warn('[notificationJob] Warning: emit notification email_sent failed', emitErr?.message || emitErr);
    }

    return { ok: true };
  } catch (err) {
    const appended = `\n\nERROR: ${String(err?.message || err)}`.slice(0, 2000);
    try {
      await notificationRecord.update({ content: (notificationRecord.content || '') + appended });
    } catch (uErr) {
      console.error('[notificationJob] Failed to update notification content with error', uErr);
    }
    console.error('[notificationJob] Error sending mail for notificationID', notificationRecord.notificationID, err?.message || err);
    return { ok: false, error: err };
  }
}

/* Core job (with detailed logging and safer date handling) */
async function runNotificationJob() {
  const today = fmtToday();
  console.log('[notificationJob] ===== runNotificationJob START =====', new Date().toISOString(), ' | TZ=', TZ, ' | today=', today);

  try {
    // 1) Reminder: BORROWING slips with dueDate in [today, today+3]
    const maxDateObj = (() => {
      // build VN-local today -> add 3 days -> format YYYY-MM-DD
      const parts = today.split('-').map(p => parseInt(p, 10));
      const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      dt.setUTCDate(dt.getUTCDate() + 3);
      return dt;
    })();
    const maxDate = maxDateObj.toISOString().slice(0, 10);
    console.log('[notificationJob] checking reminders between', today, 'and', maxDate);

    // Use DATE(dueDate) in SQL to be robust vs DATETIME/timezone
    const slips = await LoanSlip.findAll({
      where: {
        status: 'BORROWING',
        deleted: 0,
        // Sequelize where DATE(dueDate) BETWEEN today AND maxDate
        [Op.and]: [
          sequelize.where(fn('DATE', col('dueDate')), { [Op.between]: [today, maxDate] })
        ]
      },
      include: [{ model: Reader }]
    });

    console.log('[notificationJob] reminder slips found =', Array.isArray(slips) ? slips.length : slips);
    if (Array.isArray(slips) && slips.length > 0) console.log('[notificationJob] reminder slip ids =', slips.map(s => s.loanSlipId));

    for (const slip of slips) {
      try {
        console.log('[notificationJob] -> processing slip', slip.loanSlipId, 'readerId', slip.readerId, 'dueDate', slip.dueDate);

        const daysLeft = daysDiff(today, slip.dueDate);
        if (isNaN(daysLeft)) {
          console.warn('[notificationJob] invalid daysLeft -> skip slip', slip.loanSlipId);
          continue;
        }

        // improved duplicate check: filter content contains Slip:ID and emailAt not null
        const alreadyToday = await Notification.findOne({
          where: {
            readerId: slip.readerId,
            type: 'REMINDER_DUE',
            emailAt: { [Op.not]: null },
            content: { [Op.like]: `%Slip:${slip.loanSlipId}%` }
          },
          order: [['created_at', 'DESC']],
          limit: 1
        });
        if (alreadyToday) {
          const lastEmailDate = alreadyToday.emailAt ? new Date(alreadyToday.emailAt).toISOString().slice(0, 10) : null;
          console.log('[notificationJob] already email record found for slip', slip.loanSlipId, 'lastEmailDate=', lastEmailDate);
          if (lastEmailDate === today) {
            console.log('[notificationJob] skipped because already sent today for slip', slip.loanSlipId);
            continue;
          }
        }

        // recipient email: try account -> fallback to reader.email
        let toEmail = null;
        try {
          if (slip.Reader?.accountId) {
            const acct = await Account.findByPk(slip.Reader.accountId, { attributes: ['email'] });
            toEmail = acct?.email || null;
            console.log('[notificationJob] account lookup for accountId=', slip.Reader.accountId, '->', toEmail);
          }
        } catch (err) {
          console.warn('[notificationJob] account lookup error', err?.message || err);
          toEmail = toEmail || null;
        }
        toEmail = toEmail || slip.Reader?.email || null;
        console.log('[notificationJob] final toEmail =', toEmail);

        const items = await buildItemsForSlip(slip.loanSlipId);
        const payloadTitle = `[Nhắc trả] Phiếu #${slip.loanSlipId} — còn ${daysLeft} ngày`;
        const notif = await createNotificationRow({
          readerId: slip.readerId,
          type: 'REMINDER_DUE',
          title: payloadTitle,
          content: `Slip:${slip.loanSlipId}\nDaysLeft:${daysLeft}\nItems:${items.map(i => i.title).join(';')}`
        });
        console.log('[notificationJob] created notification id=', notif.notificationID, 'for slip', slip.loanSlipId);

        // Emit realtime (best effort)
        try {
          emitToUser(slip.readerId, 'notification:new', {
            notificationID: notif.notificationID,
            type: notif.type,
            title: notif.title,
            content: notif.content,
            isRead: notif.isRead,
            created_at: notif.created_at
          });
        } catch (emitErr) {
          console.warn('[notificationJob] emit notification:new failed', emitErr?.message || emitErr);
        }

        if (!toEmail) {
          await notif.update({ content: (notif.content || '') + '\n\nNO_EMAIL' });
          console.warn(`[notificationJob] No email for readerId=${slip.readerId} loanSlip=${slip.loanSlipId}`);
          continue;
        }

        const html = buildHtmlReminder({
          fullName: slip.Reader?.fullName || 'Độc giả',
          slipId: slip.loanSlipId,
          dueDate: slip.dueDate,
          daysLeft,
          items,
          pickUpLocation: process.env.LIBRARY_ADDRESS || ''
        });
        const text = buildTextReminder({ slipId: slip.loanSlipId, dueDate: slip.dueDate, daysLeft, items });

        const sendRes = await sendEmailAndMarkNotification(notif, toEmail, payloadTitle, html, text);
        console.log('[notificationJob] sendEmail result for notif', notif.notificationID, sendRes);
      } catch (innerErr) {
        console.error('[notificationJob] error processing reminder slip', slip.loanSlipId, innerErr?.message || innerErr);
      }
    } // end for reminders

  } catch (err) {
    console.error('[notificationJob] runNotificationJob REMINDER error', err);
  }

  // 2) Overdue notices: BORROWING slips with dueDate < today and overdueDays in [1..30], send every 3 days (1,4,7,...)
  try {
    console.log('[notificationJob] checking overdue slips (dueDate <', today, ')');

    const overdueSlips = await LoanSlip.findAll({
      where: {
        status: 'BORROWING',
        deleted: 0,
        [Op.and]: [
          sequelize.where(fn('DATE', col('dueDate')), { [Op.lt]: today })
        ]
      },
      include: [{ model: Reader }]
    });

    console.log('[notificationJob] overdueSlips found =', Array.isArray(overdueSlips) ? overdueSlips.length : overdueSlips);
    if (Array.isArray(overdueSlips) && overdueSlips.length > 0) console.log('[notificationJob] overdue slip ids =', overdueSlips.map(s => s.loanSlipId));

    for (const slip of overdueSlips) {
      try {
        const overdueDays = daysDiff(slip.dueDate, today);
        if (isNaN(overdueDays) || overdueDays <= 0) {
          continue;
        }

        // 🔥 FEATURE 1: Chuyển status sang OVERDUE ngay khi phát hiện quá hạn
        if (slip.status === 'BORROWING') {
          await slip.update({ status: 'OVERDUE' });
          console.log(`[notificationJob] ✅ Updated slip ${slip.loanSlipId} to OVERDUE (${overdueDays} days)`);

          // 📦 Đồng thời chuyển tất cả DocumentCopy sang BORROWED_OVERDUE
          try {
            const loanDetails = await LoanDetail.findAll({
              where: { loanSlipId: slip.loanSlipId },
              include: [{ model: DocumentCopy }]
            });

            const overdueCopies = [];
            for (const detail of loanDetails) {
              if (detail.DocumentCopy && detail.DocumentCopy.status === 'BORROWED') {
                await detail.DocumentCopy.update({
                  status: 'BORROWED_OVERDUE',
                  conditionNote: (detail.DocumentCopy.conditionNote || '') + `\n[AUTO] Marked BORROWED_OVERDUE on ${today} - slip overdue ${overdueDays} days`
                });
                overdueCopies.push({
                  documentCopyId: detail.DocumentCopy.documentCopyId,
                  barCode: detail.DocumentCopy.barCode
                });
                console.log(`[notificationJob] 📦 Updated DocumentCopy ${detail.DocumentCopy.documentCopyId} to BORROWED_OVERDUE (barCode: ${detail.DocumentCopy.barCode})`);
              }
            }

            // Emit realtime event về cả slip và copies
            try {
              emitToUser(slip.readerId, 'slip:status_changed', {
                loanSlipId: slip.loanSlipId,
                oldStatus: 'BORROWING',
                newStatus: 'OVERDUE',
                overdueDays,
                overdueCopies
              });
            } catch (emitErr) {
              console.warn('[notificationJob] emit slip:status_changed failed', emitErr?.message);
            }
          } catch (copyErr) {
            console.error('[notificationJob] error updating copies to BORROWED_OVERDUE for slip', slip.loanSlipId, copyErr?.message || copyErr);
          }
        }

        // 🔥 FEATURE 2: Khóa tài khoản + Đánh dấu bản sao LOST nếu quá hạn >= 30 ngày
        if (overdueDays >= 30 && slip.Reader?.accountId) {
          try {
            const account = await Account.findByPk(slip.Reader.accountId);
            if (account && account.status !== 'locked') {
              await account.update({ status: 'locked' });
              console.log(`[notificationJob] 🔒 LOCKED account ${account.accountId} (readerId: ${slip.readerId}) - overdue ${overdueDays} days on slip ${slip.loanSlipId}`);

              // Emit realtime event
              try {
                emitToUser(slip.readerId, 'account:locked', {
                  accountId: account.accountId,
                  reason: 'OVERDUE_30_DAYS',
                  loanSlipId: slip.loanSlipId,
                  overdueDays
                });
              } catch (emitErr) {
                console.warn('[notificationJob] emit account:locked failed', emitErr?.message);
              }

              // 📦 Đánh dấu tất cả bản sao trong phiếu này là LOST
              try {
                const loanDetails = await LoanDetail.findAll({
                  where: { loanSlipId: slip.loanSlipId },
                  include: [{ model: DocumentCopy }]
                });

                const lostCopies = [];
                for (const detail of loanDetails) {
                  // Chuyển từ BORROWED hoặc BORROWED_OVERDUE sang LOST
                  if (detail.DocumentCopy && !['LOST', 'DAMAGED'].includes(detail.DocumentCopy.status)) {
                    const oldStatus = detail.DocumentCopy.status;
                    await detail.DocumentCopy.update({
                      status: 'LOST',
                      conditionNote: (detail.DocumentCopy.conditionNote || '') + `\n[AUTO] Marked LOST on ${today} - overdue ${overdueDays} days (was ${oldStatus})`
                    });
                    lostCopies.push({
                      documentCopyId: detail.DocumentCopy.documentCopyId,
                      barCode: detail.DocumentCopy.barCode,
                      oldStatus
                    });
                    console.log(`[notificationJob] 📦 Marked DocumentCopy ${detail.DocumentCopy.documentCopyId} as LOST from ${oldStatus} (barCode: ${detail.DocumentCopy.barCode})`);
                  }
                }

                if (lostCopies.length > 0) {
                  // Emit realtime event về các bản sao bị mất
                  try {
                    emitToUser(slip.readerId, 'copies:marked_lost', {
                      loanSlipId: slip.loanSlipId,
                      lostCopies,
                      overdueDays
                    });
                  } catch (emitErr) {
                    console.warn('[notificationJob] emit copies:marked_lost failed', emitErr?.message);
                  }
                }
              } catch (lostErr) {
                console.error('[notificationJob] error marking copies as LOST for slip', slip.loanSlipId, lostErr?.message || lostErr);
              }

              // Tạo notification về việc khóa tài khoản
              const lockNotif = await createNotificationRow({
                readerId: slip.readerId,
                type: 'ACCOUNT_LOCKED',
                title: '[KHÓA TÀI KHOẢN] Quá hạn trả sách 30 ngày',
                content: `Tài khoản đã bị khóa do phiếu #${slip.loanSlipId} quá hạn ${overdueDays} ngày. Các tài liệu đã được đánh dấu là mất. Vui lòng liên hệ thư viện.`
              });

              // Gửi email thông báo khóa tài khoản
              const lockEmail = account.email;
              if (lockEmail) {
                const items = await buildItemsForSlip(slip.loanSlipId);
                const itemsHtml = items.map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} (Bản sao #${it.documentCopyId || '—'})</li>`).join('');

                const lockHtml = `
                  <!doctype html>
                  <html><body style="font-family:Arial,sans-serif;color:#333">
                    <h3 style="color:red">🔒 TÀI KHOẢN ĐÃ BỊ KHÓA</h3>
                    <p>Chào <strong>${escapeHtml(slip.Reader?.fullName || 'Độc giả')}</strong>,</p>
                    <p>Tài khoản của bạn đã bị khóa do phiếu mượn #${slip.loanSlipId} <strong>quá hạn ${overdueDays} ngày</strong>.</p>
                    <p><strong>⚠️ Các tài liệu sau đã được đánh dấu là MẤT:</strong></p>
                    <ul>${itemsHtml}</ul>
                    <p>Bạn cần liên hệ thư viện để xử lý bồi thường và mở khóa tài khoản.</p>
                    <p>Hỗ trợ: ${escapeHtml(process.env.SUPPORT_EMAIL || '')} — ${escapeHtml(process.env.SUPPORT_PHONE || '')}</p>
                  </body></html>
                `;
                const lockText = `TÀI KHOẢN BỊ KHÓA\n\nPhiếu #${slip.loanSlipId} quá hạn ${overdueDays} ngày.\nCác tài liệu đã được đánh dấu MẤT.\nLiên hệ: ${process.env.SUPPORT_EMAIL || ''} ${process.env.SUPPORT_PHONE || ''}`;

                await sendEmailAndMarkNotification(lockNotif, lockEmail, '[KHÓA TÀI KHOẢN] Quá hạn 30 ngày - Tài liệu mất', lockHtml, lockText);
              }
            }
          } catch (lockErr) {
            console.error('[notificationJob] error locking account for readerId', slip.readerId, lockErr?.message || lockErr);
          }
        }

        // Skip notification nếu quá 30 ngày (đã khóa rồi)
        if (overdueDays > 30) {
          console.log('[notificationJob] skip overdue notification for slip', slip.loanSlipId, '(over 30 days)');
          continue;
        }

        // send on day 1,4,7...
        if ((overdueDays - 1) % 3 !== 0) continue;

        const alreadyToday = await Notification.findOne({
          where: {
            readerId: slip.readerId,
            type: 'OVERDUE_NOTICE',
            emailAt: { [Op.not]: null },
            content: { [Op.like]: `%Slip:${slip.loanSlipId}%` }
          },
          order: [['created_at', 'DESC']],
          limit: 1
        });
        if (alreadyToday) {
          const lastEmailDate = alreadyToday.emailAt ? new Date(alreadyToday.emailAt).toISOString().slice(0, 10) : null;
          console.log('[notificationJob] overdue already email record for slip', slip.loanSlipId, 'lastEmailDate=', lastEmailDate);
          if (lastEmailDate === today) {
            console.log('[notificationJob] skipped overdue because already sent today', slip.loanSlipId);
            continue;
          }
        }

        let toEmail = null;
        try {
          if (slip.Reader?.accountId) {
            const acct = await Account.findByPk(slip.Reader.accountId, { attributes: ['email'] });
            toEmail = acct?.email || null;
            console.log('[notificationJob] account lookup for overdue accountId=', slip.Reader.accountId, '->', toEmail);
          }
        } catch (acctErr) {
          console.warn('[notificationJob] account lookup error', acctErr?.message || acctErr);
        }
        toEmail = toEmail || slip.Reader?.email || null;
        console.log('[notificationJob] overdue final toEmail =', toEmail);

        const items = await buildItemsForSlip(slip.loanSlipId);
        const title = `[QUÁ HẠN] Phiếu #${slip.loanSlipId} — quá hạn ${overdueDays} ngày`;
        const notif = await createNotificationRow({
          readerId: slip.readerId,
          type: 'OVERDUE_NOTICE',
          title,
          content: `Slip:${slip.loanSlipId}\nOverdueDays:${overdueDays}\nItems:${items.map(i => i.title).join(';')}`
        });
        console.log('[notificationJob] created overdue notification id=', notif.notificationID);

        try {
          emitToUser(slip.readerId, 'notification:new', {
            notificationID: notif.notificationID,
            type: notif.type,
            title: notif.title,
            content: notif.content,
            isRead: notif.isRead,
            created_at: notif.created_at
          });
        } catch (emitErr) {
          console.warn('[notificationJob] emit notification:new failed', emitErr?.message || emitErr);
        }

        if (!toEmail) {
          await notif.update({ content: (notif.content || '') + '\n\nNO_EMAIL' });
          console.warn(`[notificationJob] No email for overdue readerId=${slip.readerId} loanSlip=${slip.loanSlipId}`);
          continue;
        }

        const html = buildHtmlOverdue({
          fullName: slip.Reader?.fullName || 'Độc giả',
          slipId: slip.loanSlipId,
          dueDate: slip.dueDate,
          overdueDays,
          items
        });
        const text = buildTextOverdue({ slipId: slip.loanSlipId, dueDate: slip.dueDate, overdueDays, items });

        const sendRes = await sendEmailAndMarkNotification(notif, toEmail, title, html, text);
        console.log('[notificationJob] sendEmail result for overdue notif', notif.notificationID, sendRes);
      } catch (innerErr) {
        console.error('[notificationJob] error processing overdue slip', slip.loanSlipId, innerErr?.message || innerErr);
      }
    } // end for overdue

  } catch (err) {
    console.error('[notificationJob] runNotificationJob OVERDUE error', err);
  }

  console.log('[notificationJob] ===== runNotificationJob END =====', new Date().toISOString());
  return { ok: true };
}

/* Schedule job: chạy hàng ngày lúc 02:00 server (theo TZ cấu hình) */
function scheduleDailyJob() {
  const timezone = process.env.SERVER_TIMEZONE || TZ;
  console.log('[notificationJob] scheduleDailyJob registering cron at 02:00 with timezone =', timezone);
  // 0 2 * * * -> 02:00 every day
  cron.schedule('0 2 * * *', () => {
    console.log(`[notificationJob] cron fired at ${new Date().toISOString()} (cron timezone ${timezone})`);
    runNotificationJob().catch(e => console.error('[notificationJob] notification job fail', e));
  }, { timezone });
}

module.exports = {
  runNotificationJob,
  scheduleDailyJob,
  buildItemsForSlip
};