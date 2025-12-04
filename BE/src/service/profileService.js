const { Reader, Account, MemberCard, CardType, LoanSlip } = require("../model");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");

/**
 * LẤY THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID (bao gồm cả Account)
 */
const getReaderByAccountId = async (accountId) => {
  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
      include: [
        { model: Account, required: true },
        {
          model: MemberCard,
          as: "memberCard",
          required: false,
          where: { deleted: false },
          include: [{ model: CardType, as: "cardType", required: false }],
        },
      ],
    });

    if (!reader) return null;

    const r = reader.get({ plain: true });

    const BORROWING_STATUSES = ["BORROWING", "BORROWED", "OVERDUE"];

    const [
      pendingCount,
      waitingPickupCount,
      borrowingCount,
      returnedCount,
    ] = await Promise.all([
      LoanSlip.count({
        where: { readerId: r.readerId, deleted: false, status: "PENDING" },
      }).catch(() => 0),

      LoanSlip.count({
        where: { readerId: r.readerId, deleted: false, status: "WAITING_FOR_PICKUP" },
      }).catch(() => 0),

      LoanSlip.count({
        where: { readerId: r.readerId, deleted: false, status: BORROWING_STATUSES },
      }).catch(() => 0),

      LoanSlip.count({
        where: { readerId: r.readerId, deleted: false, status: "RETURNED" },
      }).catch(() => 0),
    ]);

    const activeTotal =
      Number(pendingCount) +
      Number(waitingPickupCount) +
      Number(borrowingCount);

    return {
      readerId: r.readerId,
      accountId: r.accountId,
      roleId: r.roleId,
      fullName: r.fullName,
      dateOfBirth: r.dateOfBirth,
      gender: r.gender,
      cccd: r.cccd,
      address: r.address,
      totalBorrow: r.totalBorrow ?? r.totolBorrow ?? 0,
      note: r.note,
      deleted: r.deleted,
      created_at: r.created_at,
      updated_at: r.updated_at,
  avatarUrl: r.avatarUrl,
      email: r.Account?.email ?? null,
      phoneNumber: r.Account?.phoneNumber ?? null,
      status: r.Account?.status ?? null,
      roleId_account: r.Account?.roleId ?? null,
      created_at_account: r.Account?.created_at ?? null,
      updated_at_account: r.Account?.updated_at ?? null,

      account: r.Account ?? null,
      memberCard: r.memberCard ?? null,

      loanCounts: {
        pending: Number(pendingCount) || 0,
        waitingPickup: Number(waitingPickupCount) || 0,
        borrowing: Number(borrowingCount) || 0,
        activeTotal: Number(activeTotal) || 0,
      },

      returnedCount: Number(returnedCount) || 0,
    };
  } catch (error) {
    console.error("❌ Lỗi getReaderByAccountId:", error);
    throw error;
  }
};

/**
 * CẬP NHẬT THÔNG TIN ĐỘC GIẢ
 */
const updateReaderByAccountId = async (accountId, data) => {
  const ALLOWED_FIELDS = [
    "fullName",
    "gender",
    "dateOfBirth",
    "address",
    "cccd",
    "note",
     "avatarUrl", 
  ];

  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
    });

    if (!reader) return null;

    const patch = {};
    for (const key of ALLOWED_FIELDS) {
      if (data[key] !== undefined) patch[key] = data[key];
    }

    if (Object.keys(patch).length > 0) {
      await reader.update(patch);
    }

    return await getReaderByAccountId(accountId);
  } catch (error) {
    console.error("❌ Lỗi updateReaderByAccountId:", error);
    throw error;
  }
};

/**
 * CẬP NHẬT ACCOUNT — BẮT BUỘC NHẬP oldPassword KHI ĐỔI password
 */
const updateAccountByAccountId = async (accountId, data) => {
  try {
    const account = await Account.scope("withSecrets").findOne({
      where: { accountId, deleted: false },
    });

    if (!account) throw new Error("Tài khoản không tồn tại");

    const patch = {};

    // Email - KHÔNG CHO PHÉP ĐỔI
    // if (data.email !== undefined) patch.email = data.email;

    // Phone
    if (data.phoneNumber !== undefined) patch.phoneNumber = data.phoneNumber;

    // ============================
    // 🔥 KIỂM TRA ĐỔI MẬT KHẨU
    // ============================
    // Hỗ trợ cả "password" và "newPassword" từ frontend
    const newPassword = data.password || data.newPassword;
    const oldPassword = data.oldPassword;

    if (oldPassword || newPassword) {
      // Nếu có một trong hai -> bắt buộc phải có cả hai
      if (!oldPassword || !newPassword) {
        throw new Error("Cần nhập đầy đủ mật khẩu cũ và mật khẩu mới");
      }

      // Kiểm tra mật khẩu cũ
      const isMatch = await bcrypt.compare(oldPassword, account.passwordHash);
      if (!isMatch) {
        throw new Error("Mật khẩu cũ không chính xác");
      }

      // Kiểm tra mật khẩu mới phải khác mật khẩu cũ
      const isSamePassword = await bcrypt.compare(newPassword, account.passwordHash);
      if (isSamePassword) {
        throw new Error("Mật khẩu mới không được trùng với mật khẩu cũ");
      }

      // Hash và lưu mật khẩu mới
      patch.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(patch).length > 0) {
      await account.update(patch);
    }

    return account;
  } catch (error) {
    console.error("❌ Lỗi updateAccountByAccountId:", error);
    throw error;
  }
};

/**
 * CẬP NHẬT TOÀN BỘ (Account + Reader)
 */
const updateFullProfileByAccountId = async (accountId, data) => {
  try {
    const accountData = {};
    const readerData = {};

    // Hỗ trợ cả "password" và "newPassword"
    const accountFields = ["email", "phoneNumber", "oldPassword", "password", "newPassword"];
    const readerFields = [
      "fullName",
      "gender",
      "dateOfBirth",
      "address",
      "cccd",
      "note",
    ];

    Object.keys(data).forEach((key) => {
      if (accountFields.includes(key)) {
        accountData[key] = data[key];
      } else if (readerFields.includes(key)) {
        readerData[key] = data[key];
      }
    });

    // Cập nhật Account trước (nếu có thay đổi)
    if (Object.keys(accountData).length > 0) {
      await updateAccountByAccountId(accountId, accountData);
    }

    // Cập nhật Reader sau (nếu có thay đổi)
    if (Object.keys(readerData).length > 0) {
      await updateReaderByAccountId(accountId, readerData);
    }

    // Trả về thông tin đầy đủ sau khi cập nhật
    return await getReaderByAccountId(accountId);
  } catch (error) {
    console.error("❌ Lỗi updateFullProfileByAccountId:", error);
    throw error;
  }
};

module.exports = {
  getReaderByAccountId,
  updateReaderByAccountId,
  updateAccountByAccountId,
  updateFullProfileByAccountId,
};