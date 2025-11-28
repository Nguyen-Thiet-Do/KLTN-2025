const { Librarian, Account } = require("../model");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");

// ============================================================
// 🔹 LẤY DANH SÁCH TẤT CẢ THỦ THƯ
// ============================================================
const getAllLibrarians = async () => {
  try {
    const librarians = await Librarian.findAll({
      include: [
        {
          model: Account,
          attributes: ["email", "phoneNumber", "status", "deleted"],
        },
      ],
      order: [["librarianId", "ASC"]],
    });

    return librarians.map((l) => ({
      librarianId: l.librarianId,
      fullName: l.fullName,
      gender: l.gender,
      dateOfBirth: l.dateOfBirth,
      cccd: l.cccd || null,
      address: l.address || null,
      email: l.Account?.email || null,
      phoneNumber: l.Account?.phoneNumber || null,
      deleted: l.deleted || false,
    }));
  } catch (error) {
    console.error("❌ Lỗi getAllLibrarians:", error);
    throw error;
  }
};

// ============================================================
// 🔹 LẤY THỦ THƯ THEO ACCOUNT ID
// ============================================================
const getLibrarianByAccountId = async (accountId) => {
  return await Librarian.findOne({
    include: [
      {
        model: Account,
        attributes: ["email", "phoneNumber", "status"],
      },
    ],
    where: { accountId, deleted: false },
  });
};

// ============================================================
// 🔹 THÊM THỦ THƯ MỚI (kiểm tra trùng email)
// ============================================================
const createLibrarian = async (data) => {
  const {
    fullName,
    email,
    password,
    gender,
    dateOfBirth,
    phoneNumber,
    address,
    cccd,
  } = data;

  if (!fullName || !email || !password)
    throw new Error("Thiếu thông tin bắt buộc.");

  const transaction = await Librarian.sequelize.transaction();
  try {
    // 🔍 Kiểm tra email trùng
    const existingEmail = await Account.findOne({ where: { email } });
    if (existingEmail) {
      throw new Error("Email đã tồn tại trong hệ thống.");
    }

    // 🔍 Kiểm tra số điện thoại trùng (nếu có nhập)
    if (phoneNumber && phoneNumber.trim() !== "") {
      const existingPhone = await Account.findOne({ where: { phoneNumber } });
      if (existingPhone) {
        throw new Error("Số điện thoại đã tồn tại trong hệ thống.");
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const account = await Account.create(
      {
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
        status: "active",
        roleId: 2,
      },
      { transaction }
    );

    const librarian = await Librarian.create(
      {
        accountId: account.accountId,
        roleId: 2,
        fullName,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        address: address || null,
        cccd: cccd || null,
      },
      { transaction }
    );

    await transaction.commit();
    return {
      success: true, // ← Thêm field này
      librarianId: librarian.librarianId,
      accountId: account.accountId,
      fullName,
      email,
    };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi createLibrarian:", err.message);
    throw err;
  }
};
// ============================================================
// 🔹 CẬP NHẬT THỦ THƯ
// ============================================================
// ============================================================
// 🔹 CẬP NHẬT THỦ THƯ
// ============================================================
const updateLibrarian = async (id, data) => {
  const {
    fullName,
    gender,
    dateOfBirth,
    phoneNumber,
    address,
    cccd,
    note,
  } = data;

  const transaction = await Librarian.sequelize.transaction();
  try {
    const librarian = await Librarian.findByPk(id, { 
      include: [Account], 
      transaction 
    });
    
    if (!librarian) {
      await transaction.rollback();
      return { success: false, message: "Không tìm thấy thủ thư" };
    }

    // ✅ Kiểm tra số điện thoại trùng lặp (nếu thay đổi)
    if (phoneNumber && phoneNumber.trim() !== "") {
      const currentPhone = librarian.Account?.phoneNumber || "";

      if (phoneNumber !== currentPhone) {
        const { Op } = require("sequelize");
        const existingPhone = await Account.findOne({
          where: { 
            phoneNumber, 
            accountId: { [Op.ne]: librarian.accountId } 
          },
          transaction,
        });

        if (existingPhone) {
          await transaction.rollback();
          return { 
            success: false, 
            message: "Số điện thoại đã tồn tại trong hệ thống" 
          };
        }
      }
    }

    // Cập nhật thông tin Librarian
    await Librarian.update(
      {
        fullName,
        gender,
        dateOfBirth,
        address,
        cccd,
        note,
      },
      { where: { librarianId: id }, transaction }
    );

    // Cập nhật Account (chỉ phoneNumber)
    if (phoneNumber) {
      await Account.update(
        { phoneNumber },
        { where: { accountId: librarian.accountId }, transaction }
      );
    }

    await transaction.commit();
    return { success: true, message: "Cập nhật thủ thư thành công" };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi updateLibrarian:", err);
    return { success: false, message: err.message || "Có lỗi xảy ra khi cập nhật" };
  }
};
// ============================================================
// 🔐 ĐẶT LẠI MẬT KHẨU
// ============================================================
const resetLibrarianPassword = async (librarianId, newPassword) => {
  try {
    if (!newPassword || newPassword.trim() === "")
      throw new Error("Mật khẩu mới không hợp lệ.");
    const librarian = await Librarian.findByPk(librarianId);
    if (!librarian) throw new Error("Không tìm thấy thủ thư.");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await Account.update({ passwordHash }, { where: { accountId: librarian.accountId } });

    return { success: true, message: "Đặt lại mật khẩu thành công." };
  } catch (error) {
    console.error("❌ Lỗi resetLibrarianPassword:", error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// 🗑️ XÓA MỀM THỦ THƯ
// ============================================================
const deleteLibrarian = async (librarianId) => {
  const transaction = await Librarian.sequelize.transaction();
  try {
    const librarian = await Librarian.findByPk(librarianId);
    if (!librarian) {
      await transaction.rollback();
      return false;
    }

    await Librarian.update({ deleted: true }, { where: { librarianId }, transaction });
    await Account.update({ deleted: true }, { where: { accountId: librarian.accountId }, transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi deleteLibrarian:", err);
    throw err;
  }
};

// ============================================================
// ♻️ KHÔI PHỤC THỦ THƯ
// ============================================================
const restoreLibrarian = async (librarianId) => {
  const transaction = await Librarian.sequelize.transaction();
  try {
    const librarian = await Librarian.findByPk(librarianId);
    if (!librarian) {
      await transaction.rollback();
      return false;
    }

    await Librarian.update({ deleted: false }, { where: { librarianId }, transaction });
    await Account.update({ deleted: false }, { where: { accountId: librarian.accountId }, transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi restoreLibrarian:", err);
    throw err;
  }
};

module.exports = {
  getAllLibrarians,
  getLibrarianByAccountId,
  createLibrarian,
  updateLibrarian,
  deleteLibrarian,
  restoreLibrarian,
  resetLibrarianPassword,
};
