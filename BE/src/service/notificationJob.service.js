// src/service/notificationJob.service.js
const cron = require('node-cron');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const mailService = require('./mailService');

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

function fmtToday() {
  return new Date().toISOString().slice(0, 10);
}
function parseDateOnlyToDate(str) {
  if (!str) return null;
  return new Date(`${str}T00:00:00Z`);
}
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
  // data: {fullName, slipId, dueDate, daysLeft, items, pickUpLocation}
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
  return `
  <!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#333">
    <h3>THÔNG BÁO QUÁ HẠN — Phiếu #${escapeHtml(String(data.slipId))}</h3>
    <p>Chào <strong>${escapeHtml(data.fullName || 'Độc giả')}</strong>,</p>
    <p>Phiếu mượn của bạn đã <strong>quá hạn ${escapeHtml(String(data.overdueDays))} ngày</strong> (hạn trả: ${escapeHtml(data.dueDate)}).</p>
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
  return `QUÁ HẠN: Phiếu #${data.slipId}\nQuá hạn ${data.overdueDays} ngày (due: ${data.dueDate})\n\nDanh sách:\n${itemsText}\n\nVui lòng trả hoặc liên hệ: ${process.env.SUPPORT_EMAIL || ''} ${process.env.SUPPORT_PHONE || ''}`;
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
  // Notifications table columns: notificationID, readerId, type, title, content, priority, link, isRead, readAt, emailAt, deleted, created_at, updated_at
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
    await mailService.sendEmail(toEmail, subject, htmlBody, textBody); // sử dụng sendEmail của bạn
    await notificationRecord.update({ emailAt: new Date() });
    return { ok: true };
  } catch (err) {
    // nếu gửi lỗi thì vẫn cập nhật content->ghi lỗi (không throw để job tiếp tục)
    await notificationRecord.update({ content: (notificationRecord.content || '') + `\n\nERROR: ${String(err?.message || err)}`.slice(0, 2000) });
    console.error('Error sending mail for notificationID', notificationRecord.notificationID, err?.message || err);
    return { ok: false, error: err };
  }
}

/* Core job */
async function runNotificationJob() {
  const today = fmtToday();

  // 1) Reminder: BORROWING slips with dueDate in [today, today+3]
  try {
    const maxDateObj = new Date(`${today}T00:00:00Z`);
    maxDateObj.setDate(maxDateObj.getDate() + 3);
    const maxDate = maxDateObj.toISOString().slice(0, 10);

    const slips = await LoanSlip.findAll({
      where: {
        status: 'BORROWING',
        dueDate: { [Op.between]: [today, maxDate] },
        deleted: 0
      },
      include: [{ model: Reader }]
    });

    for (const slip of slips) {
      const daysLeft = daysDiff(fmtToday(), slip.dueDate);
      if (isNaN(daysLeft)) continue;

      // tránh gửi duplicate cùng ngày: kiểm tra Notification.emailAt date = today OR Notification.type='REMINDER_DUE' và created_at today
      const alreadyToday = await Notification.findOne({
        where: {
          readerId: slip.readerId,
          type: 'REMINDER_DUE',
          // emailAt not null AND DATE(emailAt) = today
          emailAt: { [Op.not]: null }
        },
        order: [['created_at', 'DESC']],
        limit: 1
      });

      // if we have sent today for this reader & slip, skip (we check by loanSlipId in content/title to be safe)
      if (alreadyToday) {
        const lastEmailDate = alreadyToday.emailAt ? new Date(alreadyToday.emailAt).toISOString().slice(0,10) : null;
        if (lastEmailDate === today && String(alreadyToday.content || '').includes(String(slip.loanSlipId))) {
          continue;
        }
      }

      // recipient email: try account -> fallback to reader.accountId if available
      let toEmail = null;
      try {
        if (slip.Reader?.accountId) {
          const acct = await Account.findByPk(slip.Reader.accountId, { attributes: ['email'] });
          toEmail = acct?.email || null;
        }
      } catch (err) {
        toEmail = null;
      }
      // If your Readers table stores email field instead, fallback:
      toEmail = toEmail || slip.Reader?.email || null;

      const items = await buildItemsForSlip(slip.loanSlipId);
      const payloadTitle = `[Nhắc trả] Phiếu #${slip.loanSlipId} — còn ${daysLeft} ngày`;
      const payloadContent = JSON.stringify({ slipId: slip.loanSlipId, dueDate: slip.dueDate, daysLeft, items });

      const notif = await createNotificationRow({
        readerId: slip.readerId,
        type: 'REMINDER_DUE',
        title: payloadTitle,
        content: `Slip:${slip.loanSlipId}\nDaysLeft:${daysLeft}\nItems:${items.map(i=>i.title).join(';')}`
      });

      if (!toEmail) {
        // đánh dấu lỗi (không throw)
        await notif.update({ content: (notif.content || '') + '\n\nNO_EMAIL' });
        console.warn(`No email for readerId=${slip.readerId} loanSlip=${slip.loanSlipId}`);
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

      await sendEmailAndMarkNotification(notif, toEmail, payloadTitle, html, text);
      console.log(`Reminder email for slip=${slip.loanSlipId} daysLeft=${daysLeft} to=${toEmail}`);
    }
  } catch (err) {
    console.error('runNotificationJob REMINDER error', err);
  }

  // 2) Overdue notices: BORROWING slips with dueDate < today and overdueDays in [1..30], send every 3 days (1,4,7,...)
  try {
    const overdueSlips = await LoanSlip.findAll({
      where: {
        status: 'BORROWING',
        dueDate: { [Op.lt]: today },
        deleted: 0
      },
      include: [{ model: Reader }]
    });

    for (const slip of overdueSlips) {
      const overdueDays = daysDiff(slip.dueDate, fmtToday());
      if (isNaN(overdueDays) || overdueDays <= 0 || overdueDays > 30) continue;

      // send on day 1,4,7... -> condition (overdueDays - 1) % 3 === 0
      if ((overdueDays - 1) % 3 !== 0) continue;

      // check already sent today for this slip/type
      const alreadyToday = await Notification.findOne({
        where: {
          readerId: slip.readerId,
          type: 'OVERDUE_NOTICE',
          emailAt: { [Op.not]: null }
        },
        order: [['created_at', 'DESC']],
        limit: 1
      });
      if (alreadyToday) {
        const lastEmailDate = alreadyToday.emailAt ? new Date(alreadyToday.emailAt).toISOString().slice(0,10) : null;
        if (lastEmailDate === fmtToday() && String(alreadyToday.content || '').includes(String(slip.loanSlipId))) {
          continue;
        }
      }

      let toEmail = null;
      try {
        if (slip.Reader?.accountId) {
          const acct = await Account.findByPk(slip.Reader.accountId, { attributes: ['email'] });
          toEmail = acct?.email || null;
        }
      } catch (err) {
        toEmail = null;
      }
      toEmail = toEmail || slip.Reader?.email || null;

      const items = await buildItemsForSlip(slip.loanSlipId);

      const title = `[QUÁ HẠN] Phiếu #${slip.loanSlipId} — quá hạn ${overdueDays} ngày`;
      const content = `Slip:${slip.loanSlipId}\nOverdueDays:${overdueDays}\nItems:${items.map(i=>i.title).join(';')}`;

      const notif = await createNotificationRow({
        readerId: slip.readerId,
        type: 'OVERDUE_NOTICE',
        title,
        content
      });

      if (!toEmail) {
        await notif.update({ content: (notif.content || '') + '\n\nNO_EMAIL' });
        console.warn(`No email for overdue readerId=${slip.readerId} loanSlip=${slip.loanSlipId}`);
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

      await sendEmailAndMarkNotification(notif, toEmail, title, html, text);
      console.log(`Overdue email for slip=${slip.loanSlipId} overdueDays=${overdueDays} to=${toEmail}`);
    }
  } catch (err) {
    console.error('runNotificationJob OVERDUE error', err);
  }
}

/* Schedule job: chạy hàng ngày lúc 02:00 server */
function scheduleDailyJob() {
  const timezone = process.env.SERVER_TIMEZONE || 'Asia/Ho_Chi_Minh';
  // 0 2 * * * -> 02:00 every day
  cron.schedule('0 2 * * *', () => {
    console.log(`[notificationJob] start at ${new Date().toISOString()}`);
    runNotificationJob().catch(e => console.error('notification job fail', e));
  }, { timezone });
}

module.exports = {
  runNotificationJob,
  scheduleDailyJob
};
