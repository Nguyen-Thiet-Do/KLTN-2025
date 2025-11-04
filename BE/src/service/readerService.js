// BE/services/readerService.js
const { Reader, Account } = require("../model");
const bcrypt = require("bcrypt");

// ============================================================
// 🔹 LẤY DANH SÁCH TẤT CẢ ĐỘC GIẢ
// ============================================================
const getAllReaders = async () => {
  try {
    const readers = await Reader.findAll({
      include: [
        {
          model: Account,
          attributes: ["email", "phoneNumber", "status"],
        },
      ],
      where: { deleted: false },
      order: [["readerId", "ASC"]],
    });

    return readers.map((r) => ({
      readerId: r.readerId,
      fullName: r.fullName,
      gender: r.gender,
      dateOfBirth: r.dateOfBirth,
      cccd: r.cccd,                     
      address: r.address,
      email: r.Account?.email || null,
      phoneNumber: r.Account?.phoneNumber || null,
    }));
  } catch (error) {
    console.error("❌ Lỗi getAllReaders:", error);
    throw error;
  }
};

// ============================================================
// 🔹 LẤY THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID
// ============================================================
const getReaderByAccountId = async (accountId) => {
  return await Reader.findOne({
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
// 🔹 THÊM ĐỘC GIẢ MỚI (CHO ADMIN)
// ============================================================
const createReader = async (data) => {
  const { fullName, email, password, gender, dateOfBirth, phoneNumber, address, cccd } = data;
  if (!fullName || !email || !password) throw new Error("Thiếu thông tin bắt buộc");

  const transaction = await Reader.sequelize.transaction();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // 1️⃣ Tạo tài khoản
    const account = await Account.create(
      {
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
        status: "active",
        roleId: 3,
      },
      { transaction }
    );

    // 2️⃣ Tạo độc giả
    const reader = await Reader.create(
      {
        accountId: account.accountId,
        roleId: 3,
        fullName,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        cccd: cccd || null,           // ✅ thêm
        address: address || null,
      },
      { transaction }
    );

    await transaction.commit();
    return { readerId: reader.readerId, accountId: account.accountId, fullName, email };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ============================================================
// 🔹 CẬP NHẬT THÔNG TIN ĐỘC GIẢ
// ============================================================
const updateReader = async (id, data) => {
  const { fullName, gender, dateOfBirth, address, cccd } = data;
  const [affected] = await Reader.update(
    { fullName, gender, dateOfBirth, address, cccd }, // ✅ thêm cccd
    { where: { readerId: id } }
  );
  return { affectedRows: affected };
};

// ============================================================
// 🗑️ XÓA ĐỘC GIẢ
// ============================================================
const deleteReader = async (readerId) => {
  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(readerId);
    if (!reader) {
      await transaction.rollback();
      return false;
    }

    await Reader.destroy({ where: { readerId } }, { transaction });
    await Account.destroy({ where: { accountId: reader.accountId } }, { transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ============================================================
// 🔹 LẤY ĐỘC GIẢ THEO ID
// ============================================================
const getReaderById = async (readerId) => {
  const r = await Reader.findOne({
    where: { readerId, deleted: false },
    include: [{
      model: Account,
      attributes: ["email", "phoneNumber", "status"],
    }],
  });
  if (!r) return null;

  return {
    readerId: r.readerId,
    fullName: r.fullName,
    gender: r.gender,
    dateOfBirth: r.dateOfBirth,
    cccd: r.cccd,                   
    address: r.address,
    email: r.Account?.email || null,
    phoneNumber: r.Account?.phoneNumber || null,
    status: r.Account?.status || null,
  };
};

module.exports = {
  getAllReaders,
  getReaderByAccountId,
  createReader,
  updateReader,
  deleteReader,
  getReaderById,
};
