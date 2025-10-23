const { Reader, Account } = require("../model");

// ============================================================
// 🔹 LẤY THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID
// ============================================================
const getReaderByAccountId = async (accountId) => {
  try {
    const reader = await Reader.findOne({
      include: [
        {
          model: Account,
          attributes: ["email", "phoneNumber", "status"],
        },
      ],
      where: { accountId, deleted: false },
    });

    if (!reader) return null;

    return {
      readerId: reader.readerId,
      fullName: reader.fullName,
      gender: reader.gender,
      dateOfBirth: reader.dateOfBirth,
      address: reader.address,
      email: reader.Account?.email || null,
      phoneNumber: reader.Account?.phoneNumber || null,
      status: reader.Account?.status || null,
    };
  } catch (error) {
    console.error("❌ Lỗi getReaderByAccountId:", error);
    throw error;
  }
};

// ============================================================
// 🔹 CẬP NHẬT THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID
// ============================================================
const updateReaderByAccountId = async (accountId, data) => {
  const { fullName, gender, dateOfBirth, address, phoneNumber } = data;

  try {
    const reader = await Reader.findOne({ where: { accountId, deleted: false } });
    if (!reader) return null;

    // Cập nhật Reader
    await reader.update({ fullName, gender, dateOfBirth, address });

    // Cập nhật thông tin liên hệ trong Account
    if (phoneNumber) {
      const account = await Account.findByPk(accountId);
      if (account) await account.update({ phoneNumber });
    }

    // Trả về thông tin sau cập nhật
    return await getReaderByAccountId(accountId);
  } catch (error) {
    console.error("❌ Lỗi updateReaderByAccountId:", error);
    throw error;
  }
};

module.exports = {
  getReaderByAccountId,
  updateReaderByAccountId,
};
