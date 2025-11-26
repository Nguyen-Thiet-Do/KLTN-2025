const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // ⭐ TẮT kiểm tra certificate (cho dev)
    minVersion: "TLSv1.2"
  },
  // Thêm timeout
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Kiểm tra kết nối khi khởi động
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error);
  } else {
    console.log("✅ SMTP Server ready to send emails");
  }
});

module.exports = async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"BookTech Library" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Send email error:", error);
    throw error;
  }
};