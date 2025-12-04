// src/controller/profileController.js
const profileService = require("../service/profileService");

// ✅ Lấy thông tin độc giả hiện tại
const getCurrentReader = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const reader = await profileService.getReaderByAccountId(accountId);
    if (!reader)
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả." });

    res.json({ success: true, reader });
  } catch (err) {
    console.error("❌ Lỗi khi lấy thông tin độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Cập nhật thông tin độc giả hiện tại (chỉ Reader fields)
const updateCurrentReader = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const result = await profileService.updateReaderByAccountId(accountId, req.body);

    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả." });

    res.json({ success: true, message: "Cập nhật thông tin thành công.", reader: result });
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ CẬP NHẬT ACCOUNT (email, phoneNumber, password)
const updateCurrentAccount = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const result = await profileService.updateAccountByAccountId(accountId, req.body);

    res.json({ 
      success: true, 
      message: "Cập nhật thông tin tài khoản thành công.",
      account: {
        accountId: result.accountId,
        email: result.email,
        phoneNumber: result.phoneNumber,
      }
    });
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật tài khoản:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ CẬP NHẬT TOÀN BỘ (Account + Reader) cùng lúc
const updateFullProfile = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const result = await profileService.updateFullProfileByAccountId(accountId, req.body);

    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin." });

    res.json({ 
      success: true, 
      message: "Cập nhật thông tin thành công.", 
      data: result 
    });
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật toàn bộ profile:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Upload avatar

const uploadAvatar = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng chọn file ảnh" 
      });
    }

    // ✅ Cloudinary tự động trả về URL trong req.file.path
    const avatarUrl = req.file.path;
    
    console.log("✅ Avatar uploaded to Cloudinary:");
    console.log("   URL:", avatarUrl);
    console.log("   Public ID:", req.file.filename);
    console.log("   Size:", req.file.size, "bytes");

    const result = await profileService.updateReaderByAccountId(accountId, {
      avatarUrl: avatarUrl
    });

    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy độc giả." 
      });
    }

    res.json({ 
      success: true, 
      message: "Upload avatar thành công.", 
      avatarUrl: avatarUrl,
      reader: result 
    });
  } catch (err) {
    console.error("❌ Lỗi khi upload avatar:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// ⚠️ QUAN TRỌNG: PHẢI EXPORT TẤT CẢ CÁC HÀM
module.exports = {
  getCurrentReader,
  updateCurrentReader,
  updateCurrentAccount,     
  updateFullProfile,         
  uploadAvatar
};