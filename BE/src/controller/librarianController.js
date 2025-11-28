const librarianService = require("../service/librarianService");

// ✅ Lấy danh sách thủ thư
const getAllLibrarians = async (req, res) => {
  try {
    const librarians = await librarianService.getAllLibrarians();
    res.json({ success: true, librarians });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách thủ thư:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Lấy thông tin thủ thư hiện tại
const getCurrentLibrarian = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const librarian = await librarianService.getLibrarianByAccountId(accountId);
    if (!librarian)
      return res.status(404).json({ success: false, message: "Không tìm thấy thủ thư" });
    res.json({ success: true, librarian });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Thêm thủ thư

const createLibrarian = async (req, res) => {
  try {
    const data = req.body;
    const result = await librarianService.createLibrarian(data);
    
    // ✅ Trả về response với success: true
    return res.json({ 
      success: true, 
      message: "Thêm thủ thư thành công", 
      librarian: result 
    });
  } catch (err) {
    console.error("❌ Lỗi khi thêm thủ thư:", err);
    
    // ✅ Trả về lỗi với success: false
    return res.status(400).json({ 
      success: false, 
      message: err.message || "Không thể thêm thủ thư" 
    });
  }
};

// ✅ Cập nhật thủ thư

const updateLibrarian = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await librarianService.updateLibrarian(id, req.body);
    
    // ✅ Kiểm tra result.success và trả về status code phù hợp
    if (!result.success) {
      return res.status(400).json(result); // ← Trả về HTTP 400 khi có lỗi
    }
    
    return res.json(result); // ← HTTP 200 khi thành công
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật thủ thư:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// ✅ Đặt lại mật khẩu 
const resetLibrarianPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await librarianService.resetLibrarianPassword(id, newPassword);
    res.json(result);
  } catch (err) {
    console.error("❌ Lỗi khi đặt lại mật khẩu:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Xóa mềm thủ thư
const deleteLibrarian = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await librarianService.deleteLibrarian(id);
    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy thủ thư." });
    res.json({ success: true, message: "Đã xóa mềm thủ thư thành công." });
  } catch (err) {
    console.error("❌ Lỗi khi xóa thủ thư:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Khôi phục thủ thư
const restoreLibrarian = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await librarianService.restoreLibrarian(id);
    if (!result)
      return res.status(404).json({ success: false, message: "Không tìm thấy thủ thư để khôi phục." });
    res.json({ success: true, message: "Khôi phục thủ thư thành công." });
  } catch (err) {
    console.error("❌ Lỗi khi khôi phục thủ thư:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllLibrarians,
  getCurrentLibrarian,
  createLibrarian,
  updateLibrarian,
  deleteLibrarian,
  restoreLibrarian,
  resetLibrarianPassword,
};
