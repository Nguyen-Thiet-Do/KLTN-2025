const readerService = require("../service/readerService");

// ✅ Lấy danh sách tất cả độc giả (Admin + Thủ thư)
const getAllReaders = async (req, res) => {
  try {
    const readers = await readerService.getAllReaders();
    res.json({ success: true, readers });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Lấy thông tin độc giả theo accountId (chính mình hoặc Admin xem)
const getReaderByAccountId = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const reader = await readerService.getReaderByAccountId(accountId);
    if (!reader)
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả" });
    res.json({ success: true, reader });
  } catch (err) {
    console.error("❌ Lỗi khi lấy thông tin độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Thêm độc giả mới (chỉ Admin)
const createReader = async (req, res) => {
  try {
    if (req.user.roleId !== 1) {
      return res.status(403).json({ success: false, message: "Chỉ Admin được thêm độc giả" });
    }
    const data = req.body;
    const newReader = await readerService.createReader(data);
    res.json({ success: true, message: "Thêm độc giả thành công", reader: newReader });
  } catch (err) {
    console.error("❌ Lỗi khi thêm độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Cập nhật thông tin độc giả (Admin hoặc Thủ thư)
const updateReader = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await readerService.updateReader(id, req.body);
    res.json({ success: true, message: "Cập nhật độc giả thành công", result });
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Xóa độc giả (chỉ Admin)
const deleteReader = async (req, res) => {
  try {
    if (req.user.roleId !== 1) {
      return res.status(403).json({ success: false, message: "Chỉ Admin được xóa độc giả" });
    }
    const { id } = req.params;
    const result = await readerService.deleteReader(id);
    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả." });
    res.json({ success: true, message: "Đã xóa độc giả thành công." });
  } catch (err) {
    console.error("❌ Lỗi khi xóa độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllReaders,
  getReaderByAccountId,
  createReader,
  updateReader,
  deleteReader,
};
