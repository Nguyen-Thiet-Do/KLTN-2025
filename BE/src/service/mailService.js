// src/service/mailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendOtpEmail(to, otp) {
  const html = `
    <p>Bạn vừa yêu cầu mã xác thực.</p>
    <p><b>Mã OTP:</b> ${otp}</p>
    <p>Mã có hiệu lực trong 10 phút.</p>
  `;
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Mã OTP xác thực',
    html
  });
}

module.exports = { sendOtpEmail };
