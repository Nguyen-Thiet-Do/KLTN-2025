// src/service/mailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = (process.env.SMTP_SECURE === 'true');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || 'No-Reply <no-reply@example.com>';

let transporter = null;

function createTransporter() {
  // Nếu không có config, dùng fake transporter (dev)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('Mail service: SMTP config missing — using console transport (dev).');
    return {
      sendMail: async (opts) => {
        console.log('--- SEND MAIL (DEV MODE) ---');
        console.log(opts);
        return { accepted: [opts.to], messageId: 'dev-local' };
      }
    };
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      // do not fail on invalid certs (only if necessary)
      rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
    },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000
  });
}

transporter = createTransporter();

async function sendOtpEmail(to, otp) {
  const html = `
    <p>Bạn vừa yêu cầu mã xác thực.</p>
    <p><b>Mã OTP:</b> ${otp}</p>
    <p>Mã có hiệu lực trong 10 phút.</p>
  `;

  const mailOptions = {
    from: MAIL_FROM,
    to,
    subject: 'Mã OTP xác thực - Book Tech',
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP sent to', to, 'msgId=', info && info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Lỗi gửi mail:', err && err.message ? err.message : err);
    // Không ném lỗi thô — trả về lỗi để caller xử lý
    throw err;
  }
}

module.exports = { sendOtpEmail };
