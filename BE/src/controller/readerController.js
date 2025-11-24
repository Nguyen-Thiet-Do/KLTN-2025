const readerService = require("../service/readerService");

// Helper quyền: Admin (1) hoặc Thủ thư (2)
const isStaff = (req) => [1, 2].includes(req.user?.roleId);

// ✅ Lấy danh sách tất cả độc giả (Admin + Thủ thư)
const getAllReaders = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được truy cập" });
    }
    const readers = await readerService.getAllReaders();
    res.json({ success: true, readers });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Lấy thông tin độc giả theo accountId (cho chính người dùng đăng nhập)
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

// ✅ Thêm độc giả mới (Admin + Thủ thư)
const createReader = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được thêm độc giả" });
    }
    const data = req.body;
    const newReader = await readerService.createReader(data);
    res.json({ success: true, message: "Thêm độc giả thành công", reader: newReader });
  } catch (err) {
    console.error("❌ Lỗi khi thêm độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Cập nhật độc giả (Admin + Thủ thư)
const updateReader = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được cập nhật độc giả" });
    }
    const { id } = req.params;
    const result = await readerService.updateReader(id, req.body);
    res.json({ success: true, message: "Cập nhật độc giả thành công", result });
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Đặt lại mật khẩu độc giả (Admin + Thủ thư)
const resetReaderPassword = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được đặt lại mật khẩu" });
    }
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await readerService.resetReaderPassword(id, newPassword);
    res.json(result);
  } catch (err) {
    console.error("❌ Lỗi khi đặt lại mật khẩu:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Xóa độc giả (Admin + Thủ thư)
const deleteReader = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được xóa độc giả" });
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
// ✅ Khôi phục độc giả (Admin + Thủ thư)
const restoreReader = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được khôi phục độc giả" });
    }
    const { id } = req.params;
    const result = await readerService.restoreReader(id);
    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy độc giả để khôi phục." });
    res.json({ success: true, message: "Khôi phục độc giả thành công." });
  } catch (err) {
    console.error("❌ Lỗi khi khôi phục độc giả:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Lấy độc giả theo ID (Admin + Thủ thư)
const getReaderById = async (req, res) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ success: false, message: "Chỉ Admin/Thủ thư được xem chi tiết độc giả" });
    }

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
/**
 * PUT /:id/lock
 * Body (JSON) (optional): { reason: "Lý do khoá" }
 */
const lockReaderAccount = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "readerId không hợp lệ" });
    }

    const { reason } = req.body || {};
    const result = await readerService.lockReaderAccount(id, reason);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json({ success: true, message: result.message || "Khoá tài khoản thành công" });
  } catch (err) {
    console.error("❌ Lỗi lockReaderAccount:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /:id/unlock
 * Mở khoá tài khoản
 */
const unlockReaderAccount = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "readerId không hợp lệ" });
    }

    const result = await readerService.unlockReaderAccount(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json({ success: true, message: result.message || "Mở khoá tài khoản thành công" });
  } catch (err) {
    console.error("❌ Lỗi unlockReaderAccount:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllReaders,
  getReaderByAccountId,
  createReader,
  updateReader,
  deleteReader,
  restoreReader,
  getReaderById,
  resetReaderPassword,
  lockReaderAccount,
  unlockReaderAccount,
};
