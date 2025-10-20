// service/authService.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const { Account, Reader, Librarian } = require("../model/index");

// =============================
// 🔐 TOKEN HANDLERS
// =============================

// Generate Access Token
const generateAccessToken = (account) => {
  return jwt.sign(
    {
      accountId: account.accountId,
      email: account.email,
      roleId: account.roleId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Generate Refresh Token
const generateRefreshToken = (account) => {
  return jwt.sign(
    {
      accountId: account.accountId,
      email: account.email,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
};

// =============================
// 👤 GET FULL PROFILE (safe)
// =============================
const getFullProfile = async (accountId, roleId) => {
  const account = await Account.findByPk(accountId);
  if (!account) return null;

  const accountData = account.toJSON();
  let profileData = null;
  let profileType = null;

  try {
    if (roleId === 3) {
      const reader = await Reader.findOne({ where: { accountId } });
      if (reader) {
        profileData = reader.toJSON();
        profileType = "reader";
      } else {
        console.warn(`⚠️ Không tìm thấy Reader cho accountId=${accountId}`);
      }
    } else if (roleId === 2) {
      const librarian = await Librarian.findOne({ where: { accountId } });
      if (librarian) {
        profileData = librarian.toJSON();
        profileType = "librarian";
      } else {
        console.warn(`⚠️ Không tìm thấy Librarian cho accountId=${accountId}`);
      }
    }
  } catch (err) {
    console.error("❌ Lỗi khi lấy profile:", err.message);
  }

  return {
    account: accountData,
    profile: profileData,
    profileType,
  };
};

// =============================
// 🚪 LOGIN SERVICE
// =============================
const loginService = async (account) => {
  console.log("⚙️ [loginService] account nhận được:", account);

  const accessToken = generateAccessToken(account);
  const refreshToken = generateRefreshToken(account);

  // Cập nhật refresh_token trong DB
  await Account.scope("withSecrets").update(
    { refresh_token: refreshToken },
    { where: { accountId: account.accountId } }
  );

  // Lấy thông tin đầy đủ (đã fix lỗi null)
  const fullProfile = await getFullProfile(account.accountId, account.roleId);

  return {
    ...fullProfile,
    accessToken,
    refreshToken,
  };
};

// =============================
// 🔁 REFRESH TOKEN
// =============================
const refreshTokenService = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const account = await Account.scope("withSecrets").findOne({
    where: { accountId: decoded.accountId },
  });

  if (!account || account.refresh_token !== refreshToken) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (account.status !== "active") {
    throw new Error("INACTIVE_ACCOUNT");
  }

  const newAccessToken = generateAccessToken(account);
  const newRefreshToken = generateRefreshToken(account);

  await Account.scope("withSecrets").update(
    { refresh_token: newRefreshToken },
    { where: { accountId: account.accountId } }
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// =============================
// 🚪 LOGOUT SERVICE
// =============================
const logoutService = async (accountId) => {
  await Account.scope("withSecrets").update(
    { refresh_token: null },
    { where: { accountId } }
  );
};

// =============================
// 📝 REGISTER READER
// =============================
const registerReaderService = async (userData) => {
  const {
    email,
    password,
    phoneNumber,
    fullName,
    dateOfBirth,
    gender,
    cccd,
    address,
    note,
  } = userData;

  if (!email || !password || !fullName) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("INVALID_EMAIL");
  }

  if (password.length < 6) {
    throw new Error("WEAK_PASSWORD");
  }

  const existingAccount = await Account.findOne({ where: { email } });
  if (existingAccount) {
    throw new Error("EMAIL_EXISTS");
  }

  if (cccd) {
    const existingReader = await Reader.findOne({ where: { cccd } });
    if (existingReader) {
      throw new Error("CCCD_EXISTS");
    }
  }

  const transaction = await sequelize.transaction();

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

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

    const reader = await Reader.create(
      {
        accountId: account.accountId,
        roleId: 3,
        fullName,
        dateOfBirth: dateOfBirth || null,
        gender: gender !== undefined ? gender : null,
        cccd: cccd || null,
        address: address || null,
        totalBorrow: 0,
        note: note || null,
      },
      { transaction }
    );

    await transaction.commit();

    const accessToken = generateAccessToken(account);
    const refreshToken = generateRefreshToken(account);

    await Account.scope("withSecrets").update(
      { refresh_token: refreshToken },
      { where: { accountId: account.accountId } }
    );

    return {
      account: {
        accountId: account.accountId,
        email: account.email,
        phoneNumber: account.phoneNumber,
        status: account.status,
        roleId: account.roleId,
      },
      profile: {
        readerId: reader.readerId,
        fullName: reader.fullName,
        dateOfBirth: reader.dateOfBirth,
        gender: reader.gender,
        cccd: reader.cccd,
        address: reader.address,
        totalBorrow: reader.totalBorrow,
      },
      profileType: "reader",
      accessToken,
      refreshToken,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// =============================
// EXPORT
// =============================
module.exports = {
  loginService,
  refreshTokenService,
  logoutService,
  getFullProfile,
  registerReaderService,
};
