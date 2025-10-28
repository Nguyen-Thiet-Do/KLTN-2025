// src/services/reader.service.js
const { Reader, Account } = require("../model");
const { Op } = require("sequelize");

/**
 * LẤY THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID (bao gồm cả Account)
 */
const getReaderByAccountId = async (accountId) => {
  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
      include: [
        {
          model: Account,
          // dùng defaultScope của Account để tự loại passwordHash/refresh_token
          // nếu muốn lấy tất cả cột thì dùng scope: 'withSecrets' (không khuyến nghị)
          required: true,
        },
      ],
    });

    if (!reader) return null;

    // Chuyển về object thuần
    const r = reader.get({ plain: true });

    // Trả về dạng gộp + nested
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
      totolBorrow: r.totolBorrow,
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
    };
  } catch (error) {
    console.error("❌ Lỗi getReaderByAccountId:", error);
    throw error;
  }
};

/**
 * CẬP NHẬT THÔNG TIN ĐỘC GIẢ THEO ACCOUNT ID
 * - Chỉ sửa bảng Readers (được phép chỉnh): fullName, gender, dateOfBirth, address, cccd, note
 * - KHÔNG cập nhật bảng Account
 */
const updateReaderByAccountId = async (accountId, data) => {
  // Whitelist các trường Reader được phép sửa
  const ALLOWED_FIELDS = ["fullName", "gender", "dateOfBirth", "address", "cccd", "note"];

  try {
    const reader = await Reader.findOne({
      where: { accountId, deleted: false },
    });

    if (!reader) return null;

    // Lọc dữ liệu theo whitelist, bỏ qua undefined
    const patch = {};
    for (const key of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
        patch[key] = data[key];
      }
    }

    // Không có gì để cập nhật
    if (Object.keys(patch).length === 0) {
      // Trả về hiện trạng
      return await getReaderByAccountId(accountId);
    }

    await reader.update(patch);

    // Trả về thông tin mới nhất (bao gồm cả Account để FE hiển thị đồng bộ)
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
