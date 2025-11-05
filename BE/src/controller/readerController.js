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

// ✅ Lấy thông tin độc giả theo accountId
const getReaderByAccountId = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const reader = await readerService.getReaderByAccountId(accountId);
    if (!reader) return res.status(404).json({ success: false, message: "Không tìm thấy độc giả" });
    res.json({ success: true, reader });
  } catch (err) {
    console.error("❌ Lỗi khi lấy thông tin độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Thêm độc giả mới (Admin)
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

// ✅ Cập nhật độc giả (Admin hoặc Thủ thư)
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

// ✅ Đặt lại mật khẩu độc giả
const resetReaderPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await readerService.resetReaderPassword(id, newPassword);
    res.json(result);
  } catch (err) {
    console.error("❌ Lỗi khi đặt lại mật khẩu:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Xóa độc giả (Admin)
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

// ✅ Lấy độc giả theo ID
const getReaderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "readerId không hợp lệ" });
    }

    const reader = await readerService.getReaderById(id);
    if (!reader) {
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả" });
    }
    return res.json({ success: true, reader });
  } catch (err) {
    console.error("❌ Lỗi khi lấy độc giả theo ID:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllReaders,
  getReaderByAccountId,
  createReader,
  updateReader,
  deleteReader,
  getReaderById,
  resetReaderPassword, // ✅ thêm export
};
