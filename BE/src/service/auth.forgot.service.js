// src/service/auth.forgot.service.js

const { Account, ResetOTP } = require("../model");
const generateOTP = require("../utils/generateOTP");
const { sendEmail, sendOtpEmail } = require("../service/mailService");
const bcrypt = require("bcrypt");

module.exports = {
  // ---------------------------------------------------
  // GỬI OTP
  // ---------------------------------------------------
  async sendOTP(email) {
    try {
      console.log('\n📧 ===== SEND OTP =====');
      console.log('Email:', email);

      const account = await Account.findOne({ where: { email } });
      if (!account) {
        console.log('❌ Email not found');
        return { success: false, message: "Email không tồn tại trong hệ thống." };
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

      console.log('🔑 OTP:', otp, '| Expires:', expiresAt.toISOString());

      await ResetOTP.create({ email, otp, expiresAt });
      console.log('✅ OTP saved to database');

      try {
        await sendOtpEmail(email, otp);
        console.log('✅ Email sent successfully');
        console.log('======================\n');
        
        return { 
          success: true, 
          message: "OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư." 
        };
      } catch (mailError) {
        console.error('❌ Mail error:', mailError.message);
        
        // Vẫn cho phép tiếp tục nếu OTP đã lưu (để dev test)
        return { 
          success: true, 
          message: `OTP: ${otp} (Email service error, dùng OTP này để test)` 
        };
      }
    } catch (error) {
      console.error('❌ sendOTP error:', error);
      return { 
        success: false, 
        message: "Lỗi hệ thống: " + error.message 
      };
    }
  },

  // ---------------------------------------------------
  // KIỂM TRA OTP
  // ---------------------------------------------------
  async verifyOTP(email, otp) {
    try {
      console.log('\n🔍 ===== VERIFY OTP =====');
      console.log('Email:', email);
      console.log('OTP:', otp);

      if (!email || !otp) {
        return { 
          success: false, 
          message: "Email và OTP không được để trống" 
        };
      }

      const record = await ResetOTP.findOne({
        where: { email, otp, used: false },
        order: [["created_at", "DESC"]],
      });

      if (!record) {
        console.log('❌ OTP not found or already used');
        return { 
          success: false, 
          message: "OTP không hợp lệ hoặc đã được sử dụng" 
        };
      }

      if (new Date() > new Date(record.expiresAt)) {
        console.log('❌ OTP expired');
        return { 
          success: false, 
          message: "OTP đã hết hạn. Vui lòng yêu cầu mã mới." 
        };
      }

      // Đánh dấu đã dùng
      record.used = true;
      await record.save();

      console.log('✅ OTP verified successfully');
      console.log('========================\n');

      return { 
        success: true, 
        message: "Xác minh OTP thành công" 
      };

    } catch (error) {
      console.error('❌ verifyOTP error:', error);
      return { 
        success: false, 
        message: "Lỗi khi xác minh OTP: " + error.message 
      };
    }
  },

  // ---------------------------------------------------
  // ĐẶT LẠI MẬT KHẨU
  // ---------------------------------------------------
  async resetPassword(email, newPassword) {
    try {
      console.log('\n🔄 ===== RESET PASSWORD =====');
      console.log('Email:', email);
      console.log('Password length:', newPassword?.length || 0);

      // Validation
      if (!email || !email.trim()) {
        return { 
          success: false, 
          message: "Email không hợp lệ" 
        };
      }

      if (!newPassword || newPassword.trim() === "") {
        return { 
          success: false, 
          message: "Mật khẩu mới không được để trống" 
        };
      }

      if (newPassword.length < 6) {
        return { 
          success: false, 
          message: "Mật khẩu phải có ít nhất 6 ký tự" 
        };
      }

      // Tìm account
      const account = await Account.scope("withSecrets").findOne({
        where: { email },
      });

      if (!account) {
        console.log('❌ Account not found');
        return { 
          success: false, 
          message: "Email không tồn tại trong hệ thống" 
        };
      }

      console.log('✅ Account found:', account.accountId);

      // Hash mật khẩu mới
      const passwordHash = await bcrypt.hash(newPassword, 10);
      console.log('🔐 Password hashed');

      // Cập nhật
      account.passwordHash = passwordHash;
      await account.save();
      console.log('✅ Password updated in database');

      // Verify lại (optional, để đảm bảo)
      const updatedAccount = await Account.scope("withSecrets").findOne({
        where: { email },
      });

      const isMatch = await bcrypt.compare(newPassword, updatedAccount.passwordHash);
      
      if (!isMatch) {
        console.error('❌ Password verification failed after save');
        return {
          success: false,
          message: "Lỗi khi xác minh mật khẩu mới. Vui lòng thử lại.",
        };
      }

      console.log('✅ Password verified after update');

      // Gửi email xác nhận (không chặn nếu lỗi)
      try {
        await sendEmail(
          email,
          "Đặt lại mật khẩu thành công - BookTech",
          `
            <div style="font-family:Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
              <h2 style="color:#0b5cff;">✅ Mật khẩu đã được thay đổi</h2>
              <p>Bạn vừa đặt lại mật khẩu cho tài khoản BookTech thành công.</p>
              <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
              <p><strong>Email:</strong> ${email}</p>
              
              <div style="background:#fff3cd; padding:15px; border-radius:8px; margin:20px 0;">
                <p style="margin:0; color:#856404;">
                  ⚠️ <strong>Lưu ý bảo mật:</strong><br>
                  Nếu bạn không thực hiện thao tác này, vui lòng đổi mật khẩu ngay lập tức và liên hệ bộ phận hỗ trợ.
                </p>
              </div>

              <p>Bạn có thể đăng nhập ngay tại: <a href="https://booktechv3.netlify.app/login">https://booktechv3.netlify.app/login</a></p>

              <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
              <p style="font-size:12px; color:#999;">
                Email tự động từ BookTech Library. Vui lòng không trả lời.<br>
                © ${new Date().getFullYear()} BookTech Library
              </p>
            </div>
          `,
          `Mật khẩu của bạn đã được thay đổi thành công. Nếu không phải bạn, vui lòng liên hệ hỗ trợ ngay.`
        );
        console.log('✅ Confirmation email sent');
      } catch (mailError) {
        console.error('⚠️ Could not send confirmation email:', mailError.message);
        // Không return error vì mật khẩu đã đổi thành công
      }

      console.log('============================\n');

      return { 
        success: true, 
        message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay." 
      };

    } catch (error) {
      console.error('❌ resetPassword error:', error);
      return { 
        success: false, 
        message: "Lỗi hệ thống: " + error.message 
      };
    }
  },
};