const { Op, QueryTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const {
  Account,
  Reader,
  LoanSlip,
  LoanDetail,
  MemberCard,
  CardType,
} = require("../model");

// ============================================================
// 🔹 LẤY DANH SÁCH TẤT CẢ ĐỘC GIẢ — MỞ RỘNG (stats + memberCard)
// ============================================================
const getAllReaders = async () => {
  try {
    // Lấy reader + account + memberCard (kèm cardType nếu có)
    const readers = await Reader.findAll({
      where: { deleted: false },
      include: [
        {
          model: Account,
          attributes: ["email", "phoneNumber", "status", "deleted"],
        },
        {
          model: MemberCard,
          as: "memberCard",
          required: false,
          include: [
            {
              model: CardType,
              as: "cardType",
              required: false,
            },
          ],
        },
      ],
      order: [["readerId", "ASC"]],
    });

    if (!readers.length) return [];

    // Tập các readerId để lấy stats trong 1 query
    const readerIds = readers.map((r) => r.readerId);

    const today = new Date().toISOString().slice(0, 10);
    const loanDetailTable = LoanDetail.getTableName();
    const loanSlipTable = LoanSlip.getTableName();

    // MySQL: dùng backticks cho table/column names
    const sql =
      "SELECT " +
      "ls.`readerId` AS readerId, " +
      "SUM(CASE WHEN ld.`status` = 'BORROWED' THEN 1 ELSE 0 END) AS `borrowedCount`, " +
      "SUM(CASE WHEN ld.`status` = 'PENDING' THEN 1 ELSE 0 END) AS `pendingCount`, " +
      "SUM(CASE WHEN ld.`status` = 'WAITING_FOR_PICKUP' THEN 1 ELSE 0 END) AS `waitingForPickupCount`, " +
      "SUM(CASE WHEN ld.`status` = 'BORROWED' AND DATE(ls.`dueDate`) < DATE(:today) THEN 1 ELSE 0 END) AS `overdueCount` " +
      "FROM `" + loanDetailTable + "` ld " +
      "JOIN `" + loanSlipTable + "` ls ON ld.`loanSlipId` = ls.`loanSlipId` " +
      "WHERE ls.`readerId` IN (:readerIds) " +
      "AND (ld.`deleted` IS NULL OR ld.`deleted` = 0) " +
      "AND (ls.`deleted` IS NULL OR ls.`deleted` = 0) " +
      "GROUP BY ls.`readerId`;";

    const statsRows = await Reader.sequelize.query(sql, {
      replacements: { readerIds, today },
      type: QueryTypes.SELECT,
    });

    const statsMap = {};
    statsRows.forEach((row) => {
      // row.readerId có thể là string hoặc number
      const rid = Number(row.readerId);
      statsMap[rid] = {
        borrowedCount: Number(row.borrowedCount || 0),
        pendingCount: Number(row.pendingCount || 0),
        waitingForPickupCount: Number(row.waitingForPickupCount || 0),
        overdueCount: Number(row.overdueCount || 0),
      };
    });

    // Build response list
    return readers.map((r) => {
      const card = r.memberCard
        ? {
          memberCardId: r.memberCard.memberCardId,
          cardNumber: r.memberCard.cardNumber,
          cardTypeId: r.memberCard.cardTypeId,
          cardType: r.memberCard.cardType
            ? {
              cardTypeId: r.memberCard.cardType.cardTypeId,
              typeName: r.memberCard.cardType.typeName,
              maxBorrowLimit: r.memberCard.cardType.maxBorrowLimit,
              borrowDuration: r.memberCard.cardType.borrowDuration,
            }
            : null,
          balance: r.memberCard.balance,
          issueDate: r.memberCard.issueDate,
          expiryDate: r.memberCard.expiryDate,
          status: r.memberCard.status,
        }
        : null;

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
        deleted: r.deleted || false,
        stats: statsMap[r.readerId] || {
          borrowedCount: 0,
          pendingCount: 0,
          waitingForPickupCount: 0,
          overdueCount: 0,
        },
        memberCard: card,
      };
    });
  } catch (error) {
    console.error("❌ Lỗi getAllReaders:", error);
    throw error;
  }
};

// ============================================================
// 🔹 LẤY ĐỘC GIẢ THEO ACCOUNT ID
// ============================================================
const getReaderByAccountId = async (accountId) => {
  return await Reader.findOne({
    include: [
      {
        model: Account,
        attributes: ["email", "phoneNumber", "status"],
      },
      {
        model: MemberCard,
        as: "memberCard",
        required: false,
        include: [
          {
            model: CardType,
            as: "cardType",
            required: false,
          },
        ],
      },
    ],
    where: { accountId, deleted: false },
  });
};

// ============================================================
// 🔹 THÊM ĐỘC GIẢ MỚI (KIỂM TRA EMAIL TRÙNG)
// ============================================================
const createReader = async (data) => {
  const { fullName, email, password, gender, dateOfBirth, phoneNumber, address, cccd } = data;

  if (!fullName || !email || !password) throw new Error("Thiếu thông tin bắt buộc");

  const transaction = await Reader.sequelize.transaction();
  try {
    // 🔍 Kiểm tra email trùng trong bảng accounts
    const existingAccount = await Account.findOne({ where: { email } });
    if (existingAccount) {
      throw new Error("Email đã tồn tại trong hệ thống");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 1️⃣ Tạo tài khoản
    const account = await Account.create(
      {
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
        status: "active",
        roleId: 3, // role 3 = độc giả
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
        cccd: cccd || null,
        address: address || null,
      },
      { transaction }
    );

    await transaction.commit();
    return {
      readerId: reader.readerId,
      accountId: account.accountId,
      fullName,
      email,
    };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi createReader:", err.message);
    throw err;
  }
};

// ============================================================
// 🔹 CẬP NHẬT THÔNG TIN ĐỘC GIẢ
// ============================================================
const updateReader = async (id, data) => {
  const { fullName, gender, dateOfBirth, address, cccd, email, phoneNumber, password } = data;

  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(id, { include: [Account], transaction });
    if (!reader) throw new Error("Không tìm thấy độc giả");

    await reader.update({ fullName, gender, dateOfBirth, address, cccd }, { transaction });

    const updates = {};

    // 🔍 Kiểm tra nếu email mới trùng với email của người khác
    if (email && email !== reader.Account.email) {
      const existing = await Account.findOne({ where: { email } });
      if (existing) throw new Error("Email này đã được sử dụng bởi tài khoản khác");
      updates.email = email;
    }

    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (password && password.trim() !== "") {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length > 0) {
      await Account.update(updates, { where: { accountId: reader.accountId }, transaction });
    }

    await transaction.commit();
    return { success: true, message: "Cập nhật độc giả thành công" };
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Lỗi updateReader:", error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// 🔐 ĐẶT LẠI MẬT KHẨU
// ============================================================
const resetReaderPassword = async (readerId, newPassword) => {
  try {
    if (!newPassword || newPassword.trim() === "") throw new Error("Mật khẩu mới không hợp lệ");
    const reader = await Reader.findByPk(readerId);
    if (!reader) throw new Error("Không tìm thấy độc giả");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await Account.update({ passwordHash }, { where: { accountId: reader.accountId } });

    return { success: true, message: "Đặt lại mật khẩu thành công" };
  } catch (error) {
    console.error("❌ Lỗi resetReaderPassword:", error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// 🗑️ XÓA MỀM ĐỘC GIẢ
// ============================================================
const deleteReader = async (readerId) => {
  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(readerId);
    if (!reader) {
      await transaction.rollback();
      return false;
    }

    await Reader.update({ deleted: true }, { where: { readerId }, transaction });
    await Account.update({ deleted: true }, { where: { accountId: reader.accountId }, transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi deleteReader:", err);
    throw err;
  }
};

// ============================================================
// ♻️ KHÔI PHỤC ĐỘC GIẢ
// ============================================================
const restoreReader = async (readerId) => {
  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(readerId);
    if (!reader) {
      await transaction.rollback();
      return false;
    }

    await Reader.update({ deleted: false }, { where: { readerId }, transaction });
    await Account.update({ deleted: false }, { where: { accountId: reader.accountId }, transaction });

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi restoreReader:", err);
    throw err;
  }
};

// ============================================================
// 🔹 LẤY ĐỘC GIẢ THEO ID — MỞ RỘNG (stats + memberCard)
// ============================================================
const getReaderById = async (readerId) => {
  // 1) Lấy reader + account + memberCard (kèm cardType)
  const r = await Reader.findOne({
    where: { readerId, deleted: false },
    include: [
      {
        model: Account,
        attributes: ["email", "phoneNumber", "status"],
      },
      {
        model: MemberCard,
        as: "memberCard",
        required: false,
        include: [
          {
            model: CardType,
            as: "cardType",
            required: false,
          },
        ],
      },
    ],
  });
  if (!r) return null;

  // 2) Tính các số đếm bằng 1 raw query (tối ưu)
  try {
    const loanDetailTable = LoanDetail.getTableName();
    const loanSlipTable = LoanSlip.getTableName();

    const today = new Date().toISOString().slice(0, 10);

    const sql =
      "SELECT " +
      "SUM(CASE WHEN ld.`status` = 'BORROWED' THEN 1 ELSE 0 END) AS `borrowedCount`, " +
      "SUM(CASE WHEN ld.`status` = 'PENDING' THEN 1 ELSE 0 END) AS `pendingCount`, " +
      "SUM(CASE WHEN ld.`status` = 'WAITING_FOR_PICKUP' THEN 1 ELSE 0 END) AS `waitingForPickupCount`, " +
      "SUM(CASE WHEN ld.`status` = 'BORROWED' AND DATE(ls.`dueDate`) < DATE(:today) THEN 1 ELSE 0 END) AS `overdueCount` " +
      "FROM `" + loanDetailTable + "` ld " +
      "JOIN `" + loanSlipTable + "` ls ON ld.`loanSlipId` = ls.`loanSlipId` " +
      "WHERE ls.`readerId` = :readerId " +
      "AND (ld.`deleted` IS NULL OR ld.`deleted` = 0) " +
      "AND (ls.`deleted` IS NULL OR ls.`deleted` = 0);";

    const results = await Reader.sequelize.query(sql, {
      replacements: { readerId, today },
      type: QueryTypes.SELECT,
    });

    const counts = results?.[0] || {
      borrowedCount: 0,
      pendingCount: 0,
      waitingForPickupCount: 0,
      overdueCount: 0,
    };

    const memberCard = r.memberCard
      ? {
        memberCardId: r.memberCard.memberCardId,
        cardNumber: r.memberCard.cardNumber,
        cardTypeId: r.memberCard.cardTypeId,
        cardType: r.memberCard.cardType
          ? {
            cardTypeId: r.memberCard.cardType.cardTypeId,
            typeName: r.memberCard.cardType.typeName,
            maxBorrowLimit: r.memberCard.cardType.maxBorrowLimit,
            borrowDuration: r.memberCard.cardType.borrowDuration,
          }
          : null,
        balance: r.memberCard.balance,
        issueDate: r.memberCard.issueDate,
        expiryDate: r.memberCard.expiryDate,
        status: r.memberCard.status,
      }
      : null;

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

      // --- bổ sung ---
      stats: {
        borrowedCount: Number(counts.borrowedCount || 0),
        pendingCount: Number(counts.pendingCount || 0),
        waitingForPickupCount: Number(counts.waitingForPickupCount || 0),
        overdueCount: Number(counts.overdueCount || 0),
      },
      memberCard,
    };
  } catch (err) {
    console.warn("⚠️ Raw stats query thất bại, fallback sang count() riêng lẻ. Lỗi:", err.message);

    // Fallback (nếu raw query gặp lỗi): dùng count() từng cái
    const today = new Date().toISOString().slice(0, 10);

    const borrowedCount = await LoanDetail.count({
      where: { status: "BORROWED", deleted: 0 },
      include: [
        {
          model: LoanSlip,
          where: { readerId, deleted: 0 },
          attributes: [],
        },
      ],
    });

    const pendingCount = await LoanDetail.count({
      where: { status: "PENDING", deleted: 0 },
      include: [
        {
          model: LoanSlip,
          where: { readerId, deleted: 0 },
          attributes: [],
        },
      ],
    });

    const waitingForPickupCount = await LoanDetail.count({
      where: { status: "WAITING_FOR_PICKUP", deleted: 0 },
      include: [
        {
          model: LoanSlip,
          where: { readerId, deleted: 0 },
          attributes: [],
        },
      ],
    });

    const overdueCount = await LoanDetail.count({
      where: { status: "BORROWED", deleted: 0 },
      include: [
        {
          model: LoanSlip,
          where: {
            readerId,
            deleted: 0,
            dueDate: { [Op.lt]: today },
          },
          attributes: [],
        },
      ],
    });

    const memberCard = r.memberCard
      ? {
        memberCardId: r.memberCard.memberCardId,
        cardNumber: r.memberCard.cardNumber,
        cardTypeId: r.memberCard.cardTypeId,
        cardType: r.memberCard.cardType
          ? {
            cardTypeId: r.memberCard.cardType.cardTypeId,
            typeName: r.memberCard.cardType.typeName,
            maxBorrowLimit: r.memberCard.cardType.maxBorrowLimit,
            borrowDuration: r.memberCard.cardType.borrowDuration,
          }
          : null,
        balance: r.memberCard.balance,
        issueDate: r.memberCard.issueDate,
        expiryDate: r.memberCard.expiryDate,
        status: r.memberCard.status,
      }
      : null;

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

      // --- bổ sung ---
      stats: {
        borrowedCount,
        pendingCount,
        waitingForPickupCount,
        overdueCount,
      },
      memberCard,
    };
  }
};

// ------------------ Khoá / Mở khoá tài khoản độc giả ------------------
/**
 * Khoá tài khoản của reader (set Account.status = 'locked').
 * Trả về: { success: true } nếu thành công, ném lỗi nếu có vấn đề.
 */
const lockReaderAccount = async (readerId, reason = null) => {
  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(readerId, { transaction });
    if (!reader) {
      await transaction.rollback();
      return { success: false, message: "Không tìm thấy độc giả" };
    }

    // Lấy accountId từ reader
    const accountId = reader.accountId;
    if (!accountId) {
      await transaction.rollback();
      return { success: false, message: "Reader không có account liên kết" };
    }

    // Cập nhật trạng thái tài khoản
    await Account.update(
      { status: "locked" }, // Nếu bạn muốn dùng 'disabled' hoặc tên khác, đổi ở đây
      { where: { accountId }, transaction }
    );

    // (Tuỳ chọn) bạn có thể lưu lý do khoá vào 1 bảng log/notification — bỏ qua ở đây.

    await transaction.commit();
    return { success: true, message: "Khoá tài khoản thành công" };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi lockReaderAccount:", err);
    throw err;
  }
};

/**
 * Mở khoá tài khoản của reader (set Account.status = 'active').
 */
const unlockReaderAccount = async (readerId) => {
  const transaction = await Reader.sequelize.transaction();
  try {
    const reader = await Reader.findByPk(readerId, { transaction });
    if (!reader) {
      await transaction.rollback();
      return { success: false, message: "Không tìm thấy độc giả" };
    }

    const accountId = reader.accountId;
    if (!accountId) {
      await transaction.rollback();
      return { success: false, message: "Reader không có account liên kết" };
    }

    await Account.update(
      { status: "active" },
      { where: { accountId }, transaction }
    );

    await transaction.commit();
    return { success: true, message: "Mở khoá tài khoản thành công" };
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Lỗi unlockReaderAccount:", err);
    throw err;
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
