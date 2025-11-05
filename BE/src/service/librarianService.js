const { Librarian, Account } = require('../model');
const bcrypt = require('bcrypt');

// ============================================================
// 🔹 LẤY DANH SÁCH TẤT CẢ THỦ THƯ
// ============================================================
const getAllLibrarians = async () => {
  try {
    const librarians = await Librarian.findAll({
      include: [
        {
          model: Account,
          attributes: ['email', 'phoneNumber', 'status'],
        },
      ],
      where: { deleted: false },
      order: [['librarianId', 'ASC']],
    });

    // ✅ Chuẩn hóa output cho FE
    return librarians.map((l) => ({
      librarianId: l.librarianId,
      fullName: l.fullName,
      gender: l.gender,
      dateOfBirth: l.dateOfBirth,
      cccd: l.cccd || null,
      address: l.address || null,
      basicSalary: l.basicSalary || null,
      salaryCoefficient: l.salaryCoefficient || null,
      email: l.Account?.email || null,
      phoneNumber: l.Account?.phoneNumber || null,
    }));
  } catch (error) {
    console.error('❌ Lỗi getAllLibrarians:', error);
    throw error;
  }
};

// ============================================================
// 🔹 LẤY THÔNG TIN THỦ THƯ THEO ACCOUNT ID
// ============================================================
const getLibrarianByAccountId = async (accountId) => {
  return await Librarian.findOne({
    include: [
      {
        model: Account,
        attributes: ['email', 'phoneNumber', 'status'],
      },
    ],
    where: { accountId, deleted: false },
  });
};

// ============================================================
// 🔹 THÊM THỦ THƯ MỚI (CHO ADMIN)
// ============================================================
const createLibrarian = async (data) => {
  const { fullName, email, password, gender, dateOfBirth, phoneNumber, address, cccd, basicSalary } = data;
  if (!fullName || !email || !password) throw new Error('Thiếu thông tin bắt buộc');

  const transaction = await Librarian.sequelize.transaction();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // 1️⃣ Tạo tài khoản
    const account = await Account.create(
      {
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
        status: 'active',
        roleId: 2,
      },
      { transaction }
    );

    // 2️⃣ Tạo thủ thư
    const librarian = await Librarian.create(
      {
        accountId: account.accountId,
        roleId: 2,
        fullName,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        address: address || null,
        cccd: cccd || null,
        basicSalary: basicSalary || null,
      },
      { transaction }
    );

    await transaction.commit();
    return { librarianId: librarian.librarianId, accountId: account.accountId, fullName, email };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ============================================================
// 🔹 CẬP NHẬT THÔNG TIN THỦ THƯ
// ============================================================
const updateLibrarian = async (id, data) => {
  const {
    fullName,
    gender,
    dateOfBirth,
    phoneNumber,
    address,
    cccd,
    basicSalary,
    salaryCoefficient,
    note,
  } = data;

  const transaction = await Librarian.sequelize.transaction();
  try {
    // 🔍 Tìm thủ thư hiện tại để lấy accountId
    const librarian = await Librarian.findByPk(id);
    if (!librarian) throw new Error("Không tìm thấy thủ thư.");

    // 1️⃣ Cập nhật Librarian
    await Librarian.update(
      {
        fullName,
        gender,
        dateOfBirth,
        address,
        cccd,
        basicSalary,
        salaryCoefficient,
        note,
      },
      { where: { librarianId: id }, transaction }
    );

    // 2️⃣ Cập nhật số điện thoại trong Account (nếu có)
    if (phoneNumber) {
      await Account.update(
        { phoneNumber },
        { where: { accountId: librarian.accountId }, transaction }
      );
    }

    await transaction.commit();
    return { success: true, message: "Cập nhật thành công." };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi updateLibrarian:", err);
    return { success: false, message: err.message };
  }
};

// ============================================================
// 🔐 ĐẶT LẠI MẬT KHẨU THỦ CÔNG
// ============================================================
const resetLibrarianPassword = async (librarianId, newPassword) => {
  try {
    if (!newPassword || newPassword.trim() === "") throw new Error("Mật khẩu mới không hợp lệ");
    const librarian = await Librarian.findByPk(librarianId);
    if (!librarian) throw new Error("Không tìm thấy thủ thư");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await Account.update({ passwordHash }, { where: { accountId: librarian.accountId } });

    return { success: true, message: "Đặt lại mật khẩu thành công" };
  } catch (error) {
    console.error("❌ Lỗi resetLibrarianPassword:", error);
    return { success: false, message: error.message };
  }
};
// ============================================================
// 🗑️ XÓA THỦ THƯ (XÓA CẢ ACCOUNT LIÊN KẾT)
// ============================================================
const deleteLibrarian = async (librarianId) => {
  const transaction = await Librarian.sequelize.transaction();
  try {
    const librarian = await Librarian.findByPk(librarianId);
    if (!librarian) {
      await transaction.rollback();
      return false;
    }

    await Librarian.destroy({ where: { librarianId } }, { transaction });
    await Account.destroy({ where: { accountId: librarian.accountId } }, { transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

module.exports = {
  getAllLibrarians,
  getLibrarianByAccountId,
  createLibrarian,
  updateLibrarian,
  deleteLibrarian,
  resetLibrarianPassword
};
