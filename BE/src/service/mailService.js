// src/service/mailService.js
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'thietdo345@gmail.com'; // Email đã verify trong SendGrid

// Hỗ trợ liên hệ mặc định (dùng trong template)
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@booktechv2.net';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '0123-456-789';

// Khởi tạo SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
} else {
  console.warn('⚠️ SENDGRID_API_KEY missing — email will not be sent! (DEV MODE)');
}

// --- helper escapeHtml (bảo vệ nội dung HTML) ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================
// SEND OTP EMAIL (existing)
// =============================
async function sendOtpEmail(to, otp) {
  // Nếu không có API key, chỉ log ra console (dev mode)
  if (!SENDGRID_API_KEY) {
    console.log('--- SEND MAIL (DEV MODE) ---');
    console.log({ to, otp, from: MAIL_FROM });
    return { accepted: [to], messageId: 'dev-local' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .otp-box { 
          background: #f4f4f4; 
          padding: 20px; 
          text-align: center; 
          border-radius: 8px;
          margin: 20px 0;
        }
        .otp-code { 
          font-size: 32px; 
          font-weight: bold; 
          color: #2563eb; 
          letter-spacing: 5px;
        }
        .footer { 
          margin-top: 30px; 
          font-size: 12px; 
          color: #666; 
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Xác thực tài khoản Book Tech</h2>
        <p>Bạn vừa yêu cầu mã xác thực OTP.</p>
        
        <div class="otp-box">
          <p style="margin: 0; font-size: 14px; color: #666;">Mã OTP của bạn là:</p>
          <div class="otp-code">${escapeHtml(otp)}</div>
        </div>
        
        <p><strong>Lưu ý:</strong></p>
        <ul>
          <li>Mã có hiệu lực trong <strong>10 phút</strong></li>
          <li>Không chia sẻ mã này với bất kỳ ai</li>
          <li>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email</li>
        </ul>
        
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>&copy; ${new Date().getFullYear()} Book Tech Library. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: to,
    from: MAIL_FROM,
    subject: 'Mã OTP xác thực - Book Tech',
    text: `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 10 phút.`,
    html: html
  };

  try {
    const info = await sgMail.send(msg);
    console.log('✅ OTP sent to', to, 'via SendGrid');
    return info;
  } catch (err) {
    console.error('❌ SendGrid Error:', err.response?.body || err.message || err);
    throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
  }
}

// -----------------------------
// General sendEmail wrapper
// -----------------------------
async function sendEmail(to, subject, html, text) {
  if (!to) throw new Error('sendEmail: missing "to"');

  // Dev mode: chỉ log khi không có API key
  if (!SENDGRID_API_KEY) {
    console.log('--- SEND EMAIL (DEV MODE) ---');
    console.log({ to, subject, text, from: MAIL_FROM });
    return { accepted: [to], messageId: 'dev-local' };
  }

  const msg = {
    to,
    from: MAIL_FROM,
    subject,
    text: text || '',
    html: html || ''
  };

  try {
    const res = await sgMail.send(msg);
    console.log(`✅ Email sent to ${to} — subject="${subject}"`);
    return res;
  } catch (err) {
    console.error('❌ sendEmail Error:', err.response?.body || err.message || err);
    throw err;
  }
}

// -----------------------------
// Template: gửi mail khi phát hành thẻ thành viên
// data: { fullName, cardNumber, cardTypeName, amount, issueDate, expiryDate, supportEmail?, supportPhone?, year? }
// -----------------------------
async function sendMemberCardIssuedEmail(to, data = {}) {
  if (!to) throw new Error('sendMemberCardIssuedEmail: missing "to"');

  const {
    fullName = '',
    cardNumber = '',
    cardTypeName = '',
    amount = '',
    issueDate = '',
    expiryDate = '',
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    year = new Date().getFullYear()
  } = data;

  const subject = `[Book Tech] Xác nhận: Thẻ thành viên đã được phát hành — Số thẻ ${cardNumber || ''}`;

  // Plain text
  const text = `Kính gửi ${fullName},

Cảm ơn bạn đã đăng ký thẻ thành viên tại Thư viện Book Tech.

Chúng tôi xác nhận thẻ thành viên của bạn đã được phát hành thành công với thông tin:
- Số thẻ: ${cardNumber}
- Loại thẻ: ${cardTypeName}
- Số tiền đã nộp: ${amount} VND
- Ngày phát hành: ${issueDate}
- Hạn sử dụng: ${expiryDate}

Số tiền trên sẽ được giữ làm quỹ đảm bảo cho việc mượn/trả tài liệu mang về. Sau 12 tháng (kể từ ngày phát hành), nếu bạn không gia hạn thẻ, số tiền này sẽ được hoàn trả — trừ đi các khoản khấu trừ (nếu có) do vi phạm trong quá trình mượn.

Bạn có thể bắt đầu sử dụng tài khoản ngay lập tức tại:
https://booktechv2.netlify.app/ hoặc ứng dụng Booktech.

Nếu cần hỗ trợ, vui lòng liên hệ:
- Email: ${supportEmail}
- SĐT: ${supportPhone}

Trân trọng,
Đội ngũ Book Tech Library
© ${year} Book Tech Library
`;

  // HTML (nhẹ, inline styles)
  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:600px; margin:20px auto; padding:20px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Xác nhận phát hành thẻ thành viên</h2>
      <p>Chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Cảm ơn bạn đã đăng ký thẻ thành viên tại <strong>Thư viện Book Tech</strong>. Thẻ của bạn đã được phát hành với thông tin:</p>

      <table style="width:100%; border-collapse:collapse; margin:12px 0;">
        <tr><td style="padding:8px; background:#f7f7f7; width:40%"><strong>Số thẻ</strong></td><td style="padding:8px;">${escapeHtml(cardNumber)}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Loại thẻ</strong></td><td style="padding:8px;">${escapeHtml(cardTypeName)}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Số tiền đã nộp</strong></td><td style="padding:8px;">${escapeHtml(String(amount))} VND</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Ngày phát hành</strong></td><td style="padding:8px;">${escapeHtml(issueDate)}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Hạn sử dụng</strong></td><td style="padding:8px;">${escapeHtml(expiryDate)}</td></tr>
      </table>

      <p>Số tiền trên sẽ được giữ làm quỹ đảm bảo để bạn mượn/trả tài liệu mang về. Sau <strong>12 tháng</strong> nếu bạn không gia hạn thẻ, quỹ sẽ được hoàn trả (sau khi trừ các khoản phạt nếu có).</p>

      <p>Bắt đầu sử dụng: <a href="https://booktechv2.netlify.app/" target="_blank" rel="noopener">https://booktechv2.netlify.app/</a> hoặc mở ứng dụng <strong>Booktech</strong>.</p>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">

      <p style="font-size:13px; color:#555;">Hỗ trợ: ${escapeHtml(supportEmail)} | ${escapeHtml(supportPhone)}</p>
      <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} Book Tech Library</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}

// -----------------------------
// Template: gửi mail khi đặt mượn thành công (reservation)
// data: { fullName, slipId, items: [{documentId, title}], requestedTotal, remainingAfterReserve, supportEmail?, supportPhone?, year? }
// -----------------------------
async function sendReservationConfirmationEmail(to, data = {}) {
  if (!to) throw new Error('sendReservationConfirmationEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    items = [],
    requestedTotal = 0,
    remainingAfterReserve = 0,
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    year = new Date().getFullYear()
  } = data;

  const subject = `[Book Tech] Xác nhận đặt mượn — Phiếu #${slipId}`;

  // Plain text
  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Chúng tôi đã nhận được yêu cầu đặt mượn của bạn. Thông tin phiếu đặt:`,
    `- Mã phiếu: ${slipId}`,
    `- Số lượng tài liệu: ${requestedTotal}`,
    `- Số lượt mượn có thể còn lại: ${remainingAfterReserve}`,
    '',
    `Danh sách tài liệu (tạm):`,
    ...items.map(it => `- ${it.title || ('Tài liệu #' + it.documentId)} (ID: ${it.documentId})`),
    '',
    `Phiếu đang ở trạng thái: CHỜ thủ thư duyệt. Bạn sẽ nhận thông báo khi thủ thư xác nhận và hẹn lấy.`,
    '',
    `Bạn có thể kiểm tra chi tiết tại: https://booktechv2.netlify.app/ (đăng nhập)`,
    '',
    `Nếu cần hỗ trợ, vui lòng liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `Đội ngũ Book Tech Library`,
    `© ${year} Book Tech Library`
  ];
  const text = textLines.join('\n');

  // HTML
  const itemsHtml = items.map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} (ID: ${escapeHtml(String(it.documentId))})</li>`).join('');
  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:600px; margin:20px auto; padding:20px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Xác nhận đặt mượn</h2>
      <p>Chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Chúng tôi đã nhận được yêu cầu đặt mượn của bạn với thông tin:</p>

      <table style="width:100%; border-collapse:collapse; margin:12px 0;">
        <tr><td style="padding:8px; background:#f7f7f7; width:40%"><strong>Mã phiếu</strong></td><td style="padding:8px;">${escapeHtml(String(slipId))}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Số lượng</strong></td><td style="padding:8px;">${requestedTotal}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Số lượt mượn còn lại</strong></td><td style="padding:8px;">${remainingAfterReserve}</td></tr>
      </table>

      <p><strong>Danh sách tài liệu:</strong></p>
      <ul>${itemsHtml}</ul>

      <p>Phiếu đang ở trạng thái: <strong>CHỜ THỦ THƯ DUYỆT</strong>. Bạn sẽ nhận email khi thủ thư xác nhận và hẹn lấy. Nếu không thấy email, vui lòng kiểm tra phần Spam/Promotions.</p>

      <p>Bạn có thể kiểm tra chi tiết và trạng thái phiếu tại: <a href="https://booktechv2.netlify.app/" target="_blank" rel="noopener">https://booktechv2.netlify.app/</a></p>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">

      <p style="font-size:13px; color:#555;">Hỗ trợ: ${escapeHtml(supportEmail)} | ${escapeHtml(supportPhone)}</p>
      <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} Book Tech Library</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}

// -----------------------------
// Template: gửi mail khi thủ thư duyệt yêu cầu (chuyển sang WAITING_FOR_PICKUP)
// data: {
//   fullName, slipId, items: [{ title, documentId, documentCopyId }],
//   pickupDeadline, pickUpLocation, supportEmail?, supportPhone?, year?
// }
// -----------------------------
async function sendReservationApprovedEmail(to, data = {}) {
  if (!to) throw new Error('sendReservationApprovedEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    items = [],
    pickupDeadline = '', // YYYY-MM-DD
    pickUpLocation = process.env.LIBRARY_ADDRESS || 'Thư viện Book Tech — Số 1, Đường ABC, Quận XYZ',
    supportEmail = process.env.SUPPORT_EMAIL || SUPPORT_EMAIL,
    supportPhone = process.env.SUPPORT_PHONE || SUPPORT_PHONE,
    libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech',
    year = new Date().getFullYear()
  } = data;

  const subject = `[${libraryName}] Phiếu #${slipId} — Đã được duyệt, vui lòng đến nhận trong vòng 3 ngày`;

  // Plain text
  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Phiếu đặt mượn (Mã: ${slipId}) của bạn đã được THỦ THƯ DUYỆT và đang được giữ chờ tại thư viện.`,
    '',
    `Danh sách tài liệu được giữ:`,
    ...items.map(it => `- ${it.title || ('Tài liệu #' + it.documentId)} (Bản sao: ${it.documentCopyId || '—'})`),
    '',
    `Vui lòng đến nhận tại: ${pickUpLocation}`,
    `Hạn cuối nhận: ${pickupDeadline} (tức trong vòng 3 ngày kể từ khi được duyệt).`,
    '',
    `Lưu ý quan trọng:`,
    `- Nếu bạn không đến lấy trong vòng 3 ngày (đến sau ${pickupDeadline}), hệ thống sẽ tự động hủy giữ và trả bản sao về kho hoặc phát hành cho yêu cầu khác.`,
    `- Sau khi hủy, bạn sẽ nhận được thông báo; nếu vẫn muốn mượn, vui lòng đặt lại yêu cầu.`,
    '',
    `Nếu cần hỗ trợ, liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `${libraryName}`,
    `© ${year} ${libraryName}`
  ];
  const text = textLines.join('\n');

  // HTML
  const itemsHtml = items.map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} — Bản sao: ${escapeHtml(String(it.documentCopyId || '—'))}</li>`).join('');
  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:680px; margin:20px auto; padding:22px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Phiếu đặt mượn đã được duyệt</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Phiếu <strong>#${escapeHtml(String(slipId))}</strong> của bạn đã được <strong>thủ thư duyệt</strong> và các bản sao đã được giữ sẵn.</p>

      <p><strong>Danh sách tài liệu được giữ:</strong></p>
      <ul>${itemsHtml}</ul>

      <p><strong>Hạn cuối nhận:</strong> ${escapeHtml(pickupDeadline)} (vui lòng đến trong vòng 3 ngày).</p>
      <p><strong>Địa điểm nhận:</strong> ${escapeHtml(pickUpLocation)}</p>

      <div style="padding:12px; background:#f9fafb; border-radius:6px; margin-top:12px;">
        <p style="margin:0;"><strong>Lưu ý quan trọng</strong></p>
        <ul style="margin-top:6px;">
          <li>Nếu bạn không đến nhận trong vòng 3 ngày, thư viện sẽ hủy giữ và trả bản sao về kho hoặc phát hành cho yêu cầu khác.</li>
          <li>Sau khi hủy, nếu bạn vẫn cần, vui lòng tạo lại yêu cầu đặt mượn.</li>
        </ul>
      </div>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">

      <p style="font-size:13px; color:#555;">Hỗ trợ: ${escapeHtml(supportEmail)} | ${escapeHtml(supportPhone)}</p>
      <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} ${escapeHtml(libraryName)}</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}

// -----------------------------
// Template: gửi mail khi thủ thư tạo phiếu mượn (TRỰC TIẾP BORROWING)
// data: { fullName, slipId, items: [{ title, documentId, documentCopyId }], loanDate, dueDate, pickUpLocation?, supportEmail?, supportPhone?, libraryName?, year? }
// -----------------------------
async function sendLoanIssuedEmail(to, data = {}) {
  if (!to) throw new Error('sendLoanIssuedEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    items = [],
    loanDate = '',
    dueDate = '',
    pickUpLocation = process.env.LIBRARY_ADDRESS || 'Thư viện Book Tech — Số 1, Đường ABC, Quận XYZ',
    supportEmail = process.env.SUPPORT_EMAIL || SUPPORT_EMAIL,
    supportPhone = process.env.SUPPORT_PHONE || SUPPORT_PHONE,
    libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech',
    year = new Date().getFullYear()
  } = data;

  const subject = `[${libraryName}] Thông báo phiếu mượn #${slipId} — Vui lòng giữ gìn tài liệu và trả đúng hạn`;

  // Plain text
  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Phiếu mượn của bạn (Mã: ${slipId}) đã được tạo bởi thủ thư và kích hoạt (Đã mượn).`,
    `Ngày mượn: ${loanDate}`,
    `Hạn trả: ${dueDate}`,
    '',
    `Danh sách tài liệu:`,
    ...items.map(it => `- ${it.title || ('Tài liệu #' + it.documentId)} (Bản sao: ${it.documentCopyId || '—'})`),
    '',
    `Lưu ý quan trọng:`,
    `- Vui lòng giữ gìn tài liệu khi mượn (không làm mất, không tẩy xóa, không làm rách).`,
    `- Trả đúng hạn: nếu trả muộn sẽ phát sinh phí trễ hạn theo quy định.`,
    `- Nếu làm mất hoặc hư hỏng nặng, bạn có thể phải bồi thường theo giá bìa/giá trị tài liệu.`,
    '',
    `Bạn có thể xem chi tiết phiếu tại: https://booktechv2.netlify.app/loan/${slipId}`,
    '',
    `Nếu cần hỗ trợ, liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `${libraryName}`,
    `© ${year} ${libraryName}`
  ];
  const text = textLines.join('\n');

  // HTML
  const itemsHtml = items.map(it => `<li>${escapeHtml(it.title || `Tài liệu #${it.documentId}`)} — Bản sao: ${escapeHtml(String(it.documentCopyId || '—'))}</li>`).join('');
  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:680px; margin:20px auto; padding:22px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Thông báo: Phiếu mượn đã được tạo</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Phiếu mượn <strong>#${escapeHtml(String(slipId))}</strong> đã được thủ thư tạo và kích hoạt.</p>

      <p><strong>Ngày mượn:</strong> ${escapeHtml(loanDate)}<br>
      <strong>Hạn trả:</strong> ${escapeHtml(dueDate)}</p>

      <p><strong>Danh sách tài liệu:</strong></p>
      <ul>${itemsHtml}</ul>

      <div style="padding:12px; background:#fff7e6; border-radius:6px; margin-top:12px;">
        <p style="margin:0;"><strong>Lưu ý khi mượn</strong></p>
        <ul style="margin-top:6px;">
          <li>Giữ gìn tài liệu, không làm rách, vẽ bậy hay tẩy xóa.</li>
          <li>Trả đúng hạn để tránh phí trễ hạn. (Quy trình & mức phạt theo quy định của thư viện.)</li>
          <li>Nếu làm mất hoặc hư hỏng nặng, người mượn có thể phải bồi thường theo giá bìa hoặc mức bồi thường quy định.</li>
        </ul>
      </div>

      <p style="margin-top:12px;">Xem chi tiết phiếu: <a href="https://booktechv2.netlify.app/loan/${escapeHtml(String(slipId))}" target="_blank" rel="noopener">Mở chi tiết phiếu</a></p>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">

      <p style="font-size:13px; color:#555;">Hỗ trợ: ${escapeHtml(supportEmail)} | ${escapeHtml(supportPhone)}</p>
      <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} ${escapeHtml(libraryName)}</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}
// -----------------------------
// Template: gửi mail khi 1 LoanDetail bị xóa (removed from slip)
// data: {
//   fullName, slipId, loanDetailId, title, documentId, documentCopyId,
//   reason, librarianName, supportEmail?, supportPhone?, libraryName?, year?
// }
// -----------------------------
async function sendLoanDetailRemovedEmail(to, data = {}) {
  if (!to) throw new Error('sendLoanDetailRemovedEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    loanDetailId = '',
    title = '',
    documentId = '',
    documentCopyId = '',
    reason = '',
    librarianName = '',
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech',
    year = new Date().getFullYear()
  } = data;

  const subject = `[${libraryName}] Thông báo: Một mục trong phiếu #${slipId} đã bị hủy`;

  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Thông báo: một mục trong phiếu mượn (Mã: ${slipId}) của bạn đã bị hủy bởi thủ thư${librarianName ? `: ${librarianName}` : ''}.`,
    `- Mã loanDetail: ${loanDetailId}`,
    `- Tài liệu: ${title || ('ID: ' + documentId)}`,
    `- Bản sao (copyId): ${documentCopyId || '—'}`,
    `- Lý do: ${reason || 'Không có lý do cụ thể'}`,
    '',
    `Nếu bạn có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `${libraryName}`,
    `© ${year} ${libraryName}`
  ];
  const text = textLines.join('\n');

  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:680px; margin:12px auto; padding:18px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Thông báo mục bị hủy — Phiếu #${escapeHtml(String(slipId))}</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
      <p>Một mục trong phiếu mượn <strong>#${escapeHtml(String(slipId))}</strong> của bạn đã bị hủy${librarianName ? ` bởi <strong>${escapeHtml(librarianName)}</strong>` : ''}.</p>
      <ul>
        <li><strong>Mã loanDetail:</strong> ${escapeHtml(String(loanDetailId))}</li>
        <li><strong>Tài liệu:</strong> ${escapeHtml(title || ('ID: ' + documentId))}</li>
        <li><strong>Bản sao (copyId):</strong> ${escapeHtml(String(documentCopyId || '—'))}</li>
        <li><strong>Lý do:</strong> ${escapeHtml(reason || 'Không có lý do cụ thể')}</li>
      </ul>
      <p>Nếu bạn cần hỗ trợ, liên hệ: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> — ${escapeHtml(supportPhone)}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
      <p style="font-size:12px; color:#777;">Email này được gửi tự động. Vui lòng không trả lời trực tiếp.</p>
      <p style="font-size:12px; color:#999;">&copy; ${year} ${escapeHtml(libraryName)}</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}

// -----------------------------
// Template: gửi mail khi toàn bộ phiếu bị hủy (cancel slip)
// data: {
//   fullName, slipId, items: [{title, documentId, documentCopyId}], reason, librarianName,
//   supportEmail?, supportPhone?, libraryName?, year?
// }
// -----------------------------
async function sendLoanSlipCancelledEmail(to, data = {}) {
  if (!to) throw new Error('sendLoanSlipCancelledEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    items = [],
    reason = '',
    librarianName = '',
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech',
    year = new Date().getFullYear()
  } = data;

  const subject = `[${libraryName}] Thông báo: Phiếu mượn #${slipId} đã bị hủy`;

  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Phiếu mượn (Mã: ${slipId}) của bạn đã bị hủy${librarianName ? ` bởi ${librarianName}` : ''}.`,
    `Lý do: ${reason || 'Không có lý do cụ thể'}`,
    '',
    `Danh sách mục đã bị hủy:`,
    ...items.map(it => `- ${it.title || ('ID:' + it.documentId)} (copyId: ${it.documentCopyId || '—'})`),
    '',
    `Nếu bạn cần hỗ trợ, vui lòng liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `${libraryName}`,
    `© ${year} ${libraryName}`
  ];
  const text = textLines.join('\n');

  const itemsHtml = items.map(it => `<li>${escapeHtml(it.title || ('ID:' + it.documentId))} — Bản sao: ${escapeHtml(String(it.documentCopyId || '—'))}</li>`).join('');

  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:720px; margin:12px auto; padding:18px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Phiếu mượn #${escapeHtml(String(slipId))} — Đã bị hủy</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
      <p>Phiếu mượn <strong>#${escapeHtml(String(slipId))}</strong> của bạn đã bị hủy${librarianName ? ` bởi <strong>${escapeHtml(librarianName)}</strong>` : ''}.</p>
      <p><strong>Lý do:</strong> ${escapeHtml(reason || 'Không có lý do cụ thể')}</p>

      <p><strong>Danh sách các mục bị hủy:</strong></p>
      <ul>${itemsHtml}</ul>

      <p>Nếu bạn cần hỗ trợ hoặc muốn đặt lại yêu cầu, vui lòng liên hệ: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> — ${escapeHtml(supportPhone)}</p>

      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
      <p style="font-size:12px; color:#777;">Email này được gửi tự động. Vui lòng không trả lời trực tiếp.</p>
      <p style="font-size:12px; color:#999;">&copy; ${year} ${escapeHtml(libraryName)}</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}
// -----------------------------
// Template: gửi mail khi HỦY PHIẾU ĐẶT TRƯỚC (reservation cancel)
// data: {
//   fullName, slipId, items: [{requestedDocumentId?, title?, originalNote?}], reason, librarianName,
//   supportEmail?, supportPhone?, libraryName?, year?
// }
// -----------------------------
async function sendReservationCancelledEmail(to, data = {}) {
  if (!to) throw new Error('sendReservationCancelledEmail: missing "to"');

  const {
    fullName = '',
    slipId = '',
    items = [],
    reason = '',
    librarianName = '',
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    libraryName = process.env.LIBRARY_NAME || 'Thư viện Book Tech',
    year = new Date().getFullYear()
  } = data;

  const subject = `[${libraryName}] Thông báo: Phiếu đặt trước #${slipId} đã bị hủy`;

  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Phiếu đặt trước (Mã: ${slipId}) của bạn đã bị hủy${librarianName ? ` bởi ${librarianName}` : ''}.`,
    `Lý do: ${reason || 'Không có lý do cụ thể'}`,
    '',
    `Danh sách mục trong phiếu:`,
    ...items.map(it => {
      const titlePart = it.title ? `${it.title}` : (it.requestedDocumentId ? `ID: ${it.requestedDocumentId}` : '—');
      const notePart = it.originalNote ? ` (Ghi chú: ${it.originalNote})` : '';
      return `- ${titlePart}${notePart}`;
    }),
    '',
    `Nếu bạn cần hỗ trợ hoặc muốn đặt lại, vui lòng liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `${libraryName}`,
    `© ${year} ${libraryName}`
  ];
  const text = textLines.join('\n');

  // HTML
  const itemsHtml = items.length
    ? items.map(it => {
      const titlePart = it.title ? escapeHtml(it.title) : (it.requestedDocumentId ? `ID: ${escapeHtml(String(it.requestedDocumentId))}` : '—');
      const notePart = it.originalNote ? ` — <em>${escapeHtml(it.originalNote)}</em>` : '';
      return `<li>${titlePart}${notePart}</li>`;
    }).join('')
    : '<li>—</li>';

  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:720px; margin:12px auto; padding:18px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Phiếu đặt trước #${escapeHtml(String(slipId))} — Đã bị hủy</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
      <p>Phiếu đặt trước <strong>#${escapeHtml(String(slipId))}</strong> của bạn đã bị hủy${librarianName ? ` bởi <strong>${escapeHtml(librarianName)}</strong>` : ''}.</p>
      <p><strong>Lý do:</strong> ${escapeHtml(reason || 'Không có lý do cụ thể')}</p>

      <p><strong>Danh sách mục trong phiếu:</strong></p>
      <ul>${itemsHtml}</ul>

      <p>Nếu bạn cần hỗ trợ hoặc muốn đặt lại yêu cầu, vui lòng liên hệ: <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a> — ${escapeHtml(supportPhone)}</p>

      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;">
      <p style="font-size:12px; color:#777;">Email này được gửi tự động. Vui lòng không trả lời trực tiếp.</p>
      <p style="font-size:12px; color:#999;">&copy; ${year} ${escapeHtml(libraryName)}</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}
/**
 * Gửi email biên nhận trả tài liệu cho độc giả
 *
 * @param {string} to                  Email người nhận
 * @param {object} data                Dữ liệu email
 * @param {string} data.fullName       Tên độc giả
 * @param {number|string} data.slipId  Mã phiếu mượn
 * @param {string} data.title          Tên tài liệu
 * @param {string} data.returnDate     Ngày trả (YYYY-MM-DD)
 * @param {number} data.overdueFine    Phạt trễ hạn
 * @param {number} data.damageFine     Phạt hư hỏng
 * @param {number} data.lostFine       Phạt mất sách
 * @param {number} data.totalFine      Tổng phạt
 */
async function sendReturnReceiptEmail(to, data = {}) {
  if (!to) throw new Error('sendReturnReceiptEmail: missing "to"');

  const {
    fullName = 'Độc giả',
    slipId = '',
    title = '',
    returnDate = '',
    overdueFine = 0,
    damageFine = 0,
    lostFine = 0,
    totalFine = 0,
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    year = new Date().getFullYear()
  } = data;

  const subject = `[Book Tech] Biên nhận trả tài liệu — Phiếu #${escapeHtml(String(slipId))}`;

  // Plain text fallback
  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Chúng tôi xác nhận bạn đã trả tài liệu thuộc Phiếu mượn: ${slipId} vào ngày ${returnDate}.`,
    `Tên tài liệu: ${title}`,
    '',
    `Chi tiết tiền phạt:`,
    `- Phạt trễ hạn: ${Number(overdueFine).toLocaleString('vi-VN')} đ`,
    `- Phạt hư hỏng: ${Number(damageFine).toLocaleString('vi-VN')} đ`,
    `- Phạt mất sách: ${Number(lostFine).toLocaleString('vi-VN')} đ`,
    `- Tổng: ${Number(totalFine).toLocaleString('vi-VN')} đ`,
    '',
    `Nếu bạn có thắc mắc, vui lòng liên hệ: ${supportEmail} — ${supportPhone}`,
    '',
    'Trân trọng,',
    'Thư viện Book Tech',
    `© ${year} Book Tech Library`
  ];
  const text = textLines.join('\n');

  // HTML content
  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:720px; margin:12px auto; padding:18px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Biên nhận trả tài liệu</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Chúng tôi xác nhận bạn đã trả tài liệu thuộc <strong>Phiếu #${escapeHtml(String(slipId))}</strong> vào ngày <strong>${escapeHtml(returnDate)}</strong>.</p>

      <p><strong>Tên tài liệu:</strong> ${escapeHtml(title)}</p>

      <h3 style="margin-bottom:6px;">Chi tiết tiền phạt</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <tr>
          <td style="padding:8px; background:#f7f7f7; width:50%"><strong>Phạt trễ hạn</strong></td>
          <td style="padding:8px;">${Number(overdueFine).toLocaleString('vi-VN')} đ</td>
        </tr>
        <tr>
          <td style="padding:8px; background:#f7f7f7;"><strong>Phạt hư hỏng</strong></td>
          <td style="padding:8px;">${Number(damageFine).toLocaleString('vi-VN')} đ</td>
        </tr>
        <tr>
          <td style="padding:8px; background:#f7f7f7;"><strong>Phạt mất sách</strong></td>
          <td style="padding:8px;">${Number(lostFine).toLocaleString('vi-VN')} đ</td>
        </tr>
        <tr>
          <td style="padding:12px; background:#fff; font-size:16px;"><strong>Tổng</strong></td>
          <td style="padding:12px; font-size:16px;"><strong>${Number(totalFine).toLocaleString('vi-VN')} đ</strong></td>
        </tr>
      </table>

      <p style="margin-top:12px;">Nếu bạn cần hỗ trợ hoặc có thắc mắc, vui lòng liên hệ:</p>
      <p style="font-size:13px; color:#555;">Email: ${escapeHtml(supportEmail)} — SĐT: ${escapeHtml(supportPhone)}</p>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">
      <p style="font-size:12px; color:#999;">Email này được gửi tự động. Vui lòng không trả lời trực tiếp.</p>
      <p style="font-size:12px; color:#999;">&copy; ${year} Book Tech Library</p>
    </div>
  </body>
  </html>
  `;

  // Gọi wrapper sendEmail (dùng SendGrid nếu config)
  return sendEmail(to, subject, html, text);
}
async function sendRenewalRequestReceivedEmail(to, data = {}) {
  if (!to) throw new Error('sendRenewalRequestReceivedEmail: missing "to"');
  const {
    fullName = '',
    renewalId = '',
    loanDetailId = '',
    oldDueDate = '',
    proposedNewDue = '',
    supportEmail = SUPPORT_EMAIL,
    supportPhone = SUPPORT_PHONE,
    year = new Date().getFullYear()
  } = data;

  const subject = `[Book Tech] Yêu cầu gia hạn #${renewalId} — Đã tiếp nhận`;

  const textLines = [
    `Kính gửi ${fullName},`,
    '',
    `Yêu cầu gia hạn (Mã: ${renewalId}) cho mục mượn (LoanDetail: ${loanDetailId}) của bạn đã được tiếp nhận và đang chờ thủ thư xử lý.`,
    `Hạn trả hiện tại: ${oldDueDate}`,
    `Hạn dự kiến nếu được duyệt: ${proposedNewDue}`,
    '',
    `Khi thủ thư duyệt hoặc từ chối, chúng tôi sẽ gửi email thông báo tiếp theo.`,
    '',
    `Nếu cần hỗ trợ, vui lòng liên hệ:`,
    `- Email: ${supportEmail}`,
    `- SĐT: ${supportPhone}`,
    '',
    `Trân trọng,`,
    `Đội ngũ Book Tech Library`,
    `© ${year} Book Tech Library`
  ];
  const text = textLines.join('\n');

  const html = `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:Arial, sans-serif; color:#333;">
    <div style="max-width:680px; margin:20px auto; padding:22px; border:1px solid #eee; border-radius:8px;">
      <h2 style="color:#0b5cff; margin-top:0;">Yêu cầu gia hạn đã được tiếp nhận</h2>
      <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>

      <p>Yêu cầu gia hạn <strong>#${escapeHtml(String(renewalId))}</strong> cho mục mượn <strong>LoanDetail #${escapeHtml(String(loanDetailId))}</strong> đã được tiếp nhận và đang chờ thủ thư xử lý.</p>

      <table style="width:100%; border-collapse:collapse; margin:12px 0;">
        <tr><td style="padding:8px; background:#f7f7f7; width:40%"><strong>Hạn trả hiện tại</strong></td><td style="padding:8px;">${escapeHtml(String(oldDueDate))}</td></tr>
        <tr><td style="padding:8px; background:#f7f7f7;"><strong>Hạn dự kiến nếu duyệt</strong></td><td style="padding:8px;">${escapeHtml(String(proposedNewDue))}</td></tr>
      </table>

      <p>Chúng tôi sẽ gửi email thông báo khi thủ thư xử lý yêu cầu (duyệt hoặc từ chối).</p>

      <hr style="border:none; border-top:1px solid #eee; margin:18px 0;">

      <p style="font-size:13px; color:#555;">Hỗ trợ: ${escapeHtml(supportEmail)} | ${escapeHtml(supportPhone)}</p>
      <p style="font-size:12px; color:#999;">Đây là email tự động. Vui lòng không trả lời trực tiếp.<br>&copy; ${year} Book Tech Library</p>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html, text);
}

module.exports = {
  sendOtpEmail,
  sendEmail,
  sendMemberCardIssuedEmail,
  sendReservationConfirmationEmail,
  sendReservationApprovedEmail,
  sendLoanIssuedEmail,
  sendLoanDetailRemovedEmail,
  sendLoanSlipCancelledEmail,
  sendReservationCancelledEmail,
  sendReturnReceiptEmail,
  sendRenewalRequestReceivedEmail
};
