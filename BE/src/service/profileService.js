// src/services/reader.service.js
const { Reader, Account, MemberCard, CardType, LoanSlip } = require("../model");
const { Op } = require("sequelize");

/**
 * LẤY THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID (bao gồm cả Account)
 * Bổ sung: memberCard, loanCounts (pending / waitingPickup / borrowing / activeTotal), returnedCount
 */
const getReaderByAccountId = async (accountId) => {
  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
      include: [
        {
          model: Account,
          required: true,
        },
        // include memberCard cùng cardType (nếu có)
        {
          model: MemberCard,
          as: "memberCard",
          required: false,
          where: { deleted: false },
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

    if (!reader) return null;

    // Chuyển về object thuần
    const r = reader.get({ plain: true });

    // --- Tính thống kê phiếu mượn ---
    // Các trạng thái dùng mặc định — nếu DB của bạn dùng tên khác hãy sửa ở đây
    const BORROWING_STATUSES = ["BORROWING", "BORROWED", "OVERDUE"];

    const [
      pendingCount,
      waitingPickupCount,
      borrowingCount,
      returnedCount,
    ] = await Promise.all([
      LoanSlip.count({
        where: {
          readerId: r.readerId,
          deleted: false,
          status: "PENDING",
        },
      }).catch(() => 0),

      LoanSlip.count({
        where: {
          readerId: r.readerId,
          deleted: false,
          status: "WAITING_FOR_PICKUP",
        },
      }).catch(() => 0),

      LoanSlip.count({
        where: {
          readerId: r.readerId,
          deleted: false,
          status: BORROWING_STATUSES,
        },
      }).catch(() => 0),

      LoanSlip.count({
        where: {
          readerId: r.readerId,
          deleted: false,
          status: "RETURNED",
        },
      }).catch(() => 0),
    ]);

    const activeTotal = Number(pendingCount) + Number(waitingPickupCount) + Number(borrowingCount);

    // --- Build response (giữ các trường cũ, thêm mới) ---
    return {
      // ------- Reader fields -------
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

      // ------- Flattened Account fields (tiện cho FE) -------
      email: r.Account?.email ?? null,
      phoneNumber: r.Account?.phoneNumber ?? null,
      status: r.Account?.status ?? null,
      roleId_account: r.Account?.roleId ?? null,
      created_at_account: r.Account?.created_at ?? null,
      updated_at_account: r.Account?.updated_at ?? null,

      // ------- Nested Account object (nếu cần dùng nhóm) -------
      account: r.Account ?? null,

      // ------- Member card (nếu có) -------
      memberCard: r.memberCard ?? null, // đã include cardType nếu có

      // ------- Loan counts -------
      loanCounts: {
        pending: Number(pendingCount) || 0,
        waitingPickup: Number(waitingPickupCount) || 0,
        borrowing: Number(borrowingCount) || 0,
        activeTotal: Number(activeTotal) || 0,
      },

      // ------- Returned count -------
      returnedCount: Number(returnedCount) || 0,
    };
  } catch (error) {
    console.error("❌ Lỗi getReaderByAccountId:", error);
    throw error;
  }
};

/**
 * CẬP NHẬT THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID
 * - Chỉ sửa bảng Readers (được phép chỉnh)
 */
const updateReaderByAccountId = async (accountId, data) => {
  const ALLOWED_FIELDS = ["fullName", "gender", "dateOfBirth", "address", "cccd", "note"];

  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
    });

    if (!reader) return null;

    const patch = {};
    for (const key of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
        patch[key] = data[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return await getReaderByAccountId(accountId);
    }

    await reader.update(patch);

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
