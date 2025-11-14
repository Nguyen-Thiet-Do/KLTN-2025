// src/service/mailService.js
const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = port === 465; // 465 => SSL; 587 => TLS

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false, // tránh lỗi trên Render
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

const transporter = createTransporter();

async function sendOtpEmail(to, otp) {
  const html = `
    <div style="font-family: Arial; font-size: 16px;">
      <p>Bạn vừa yêu cầu mã xác thực.</p>
      <p><b>Mã OTP:</b> <span style="font-size:20px;color:#007bff">${otp}</span></p>
      <p>Mã có hiệu lực trong <b>10 phút</b>.</p>
    </div>
  `;

  try {
    const result = await transporter.sendMail({
      from: process.env.MAIL_FROM || `"BookTech" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Mã OTP xác thực',
      html,
    });

    console.log("📨 Email OTP gửi thành công:", result.messageId);
    return true;
  } catch (err) {
    console.error("❌ Lỗi gửi mail:", err);
    throw new Error("EMAIL_SEND_FAILED");
  }
}

module.exports = { sendOtpEmail };
