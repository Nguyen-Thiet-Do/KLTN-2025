// src/service/mailService.js
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'thietdo345@gmail.com'; // Email đã verify trong SendGrid

// Khởi tạo SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
} else {
  console.warn('⚠️ SENDGRID_API_KEY missing — email will not be sent!');
}

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
          <div class="otp-code">${otp}</div>
        </div>
        
        <p><strong>Lưu ý:</strong></p>
        <ul>
          <li>Mã có hiệu lực trong <strong>10 phút</strong></li>
          <li>Không chia sẻ mã này với bất kỳ ai</li>
          <li>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email</li>
        </ul>
        
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>&copy; 2024 Book Tech Library. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: to,
    from: MAIL_FROM, // Email đã verify trong SendGrid
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

module.exports = { sendOtpEmail };