// src/service/auth.forgot.service.js

const { Account, ResetOTP } = require("../model"); 
const generateOTP = require("../utils/generateOTP");
const sendEmail = require("../utils/sendEmail");
const bcrypt = require("bcrypt");

module.exports = {
  // ---------------------------------------------------
  // GỬI OTP
  // ---------------------------------------------------
  async sendOTP(email) {
    const account = await Account.findOne({ where: { email } });

    if (!account) {
      return { success: false, message: "Email không tồn tại." };
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await ResetOTP.create({ email, otp, expiresAt });

    await sendEmail(
      email,
      "Mã OTP khôi phục mật khẩu - BookTech",
      `
        <div style="font-family:Arial; font-size:15px; line-height:1.6;">
          <h2>Xin chào,</h2>
          <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>

          <p>Mã OTP của bạn là:</p>
          <h1 style="color:#3366ff; letter-spacing:3px;">${otp}</h1>

          <p>Mã OTP có hiệu lực trong <b>5 phút</b>.<br>
          Không chia sẻ mã này với bất kỳ ai.</p>

          <br>
          <p>Trân trọng,<br/>
          <b>BookTech Library System</b></p>
        </div>
      `
    );

    return { success: true };
  },

  // ---------------------------------------------------
  // KIỂM TRA OTP
  // ---------------------------------------------------
  async verifyOTP(email, otp) {
    const record = await ResetOTP.findOne({
      where: { email, otp, used: false },
      order: [["created_at", "DESC"]],
    });

    if (!record) {
      return { success: false, message: "OTP không hợp lệ." };
    }

    if (new Date() > new Date(record.expiresAt)) {
      return { success: false, message: "OTP đã hết hạn." };
    }

    record.used = true;
    await record.save();

    return { success: true };
  },

  // ---------------------------------------------------
  // ĐẶT LẠI MẬT KHẨU - ⭐ PHẢI DÙNG SCOPE withSecrets
  // ---------------------------------------------------
  async resetPassword(email, newPassword) {
    try {
      // ⭐ BẮT BUỘC: Phải dùng scope 'withSecrets' để lấy được passwordHash
      const account = await Account.scope("withSecrets").findOne({ 
        where: { email } 
      });
      
      if (!account) {
        console.log("❌ Không tìm thấy account với email:", email);
        return { success: false, message: "Email không tồn tại." };
      }

      console.log("✅ Tìm thấy account:", { 
        accountId: account.accountId, 
        email: account.email 
      });

      // Validate mật khẩu
      if (!newPassword || newPassword.trim() === "") {
        return { success: false, message: "Mật khẩu mới không hợp lệ" };
      }

      // Hash mật khẩu
      const passwordHash = await bcrypt.hash(newPassword, 10);

      console.log("🔐 Mật khẩu đã hash:", passwordHash.substring(0, 30) + "...");

      // ⭐ Cập nhật - Sequelize tự động map passwordHash → password
      account.passwordHash = passwordHash;
      await account.save();

      console.log("✅ Đã lưu mật khẩu mới");

      // Verify lại
      const updatedAccount = await Account.scope("withSecrets").findOne({ 
        where: { email } 
      });
      
      const isMatch = await bcrypt.compare(newPassword, updatedAccount.passwordHash);
      
      console.log("🔍 Verify mật khẩu mới:", isMatch ? "✅ ĐÚNG" : "❌ SAI");

      if (!isMatch) {
        return { success: false, message: "Lỗi khi xác minh mật khẩu mới" };
      }

      return { success: true, message: "Đặt lại mật khẩu thành công" };

    } catch (error) {
      console.error("❌ Lỗi resetPassword:", error);
      return { success: false, message: "Lỗi hệ thống: " + error.message };
    }
  },
};