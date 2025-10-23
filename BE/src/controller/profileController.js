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

// ✅ Cập nhật thông tin độc giả hiện tại
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

module.exports = {
  getCurrentReader,
  updateCurrentReader,
};
