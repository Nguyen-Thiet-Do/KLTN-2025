// service/authService.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const { generateRandomCode, generateCardNumber } = require('../utils/helpers');
const mailService = require('./mailService');
const payosService = require('./payosService');

const {
  Account,
  Reader,
  Librarian,
  MemberCard,
  CardType,
  LoanSlip,
  Payment,
} = require("../model/index");

// =============================
// 🔐 TOKEN HANDLERS
// =============================
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
    // =================
    // READER
    // =================
    if (roleId === 3) {
      const reader = await Reader.findOne({ where: { accountId } });
      if (reader) {
        profileData = reader.toJSON();
        profileType = "reader";

        // --- Lấy thẻ thành viên hiện tại (nếu có) ---
        let memberCardData = null;
        try {
          const memberCard = await MemberCard.findOne({
            where: {
              readerId: profileData.readerId,
              status: "ACTIVE",
              deleted: false,
            },
            include: [{ model: CardType, as: "cardType" }],
            order: [["created_at", "DESC"]],
          });

          if (memberCard) {
            const mc = memberCard.toJSON();
            memberCardData = {
              memberCardId: mc.memberCardId,
              cardNumber: mc.cardNumber,
              cardTypeId: mc.cardTypeId,
              balance: mc.balance,
              status: mc.status,
              issueDate: mc.issueDate || mc.created_at,
              expiryDate: mc.expiryDate || mc.expiry_date || null,
              note: mc.note || null,
              created_at: mc.created_at,
              updated_at: mc.updated_at,
              cardType: mc.cardType || null,
            };
          }
        } catch (err) {
          console.warn("MemberCard include CardType failed:", err.message);
          try {
            const memberCard = await MemberCard.findOne({
              where: {
                readerId: profileData.readerId,
                status: "ACTIVE",
                deleted: false,
              },
              order: [["created_at", "DESC"]],
            });
            if (memberCard) {
              const mc = memberCard.toJSON();
              memberCardData = {
                memberCardId: mc.memberCardId,
                cardNumber: mc.cardNumber,
                cardTypeId: mc.cardTypeId,
                balance: mc.balance,
                status: mc.status,
                issueDate: mc.issueDate || mc.created_at,
                expiryDate: mc.expiryDate || mc.expire_date || null,
                note: mc.note || null,
                created_at: mc.created_at,
                updated_at: mc.updated_at,
              };
            }
          } catch (e) {
            console.warn("Fallback MemberCard findOne failed:", e.message);
          }
        }

        // --- Đếm số phiếu mượn theo trạng thái ---
        const pendingCount = await LoanSlip.count({
          where: {
            readerId: profileData.readerId,
            deleted: false,
            status: "PENDING",
          },
        }).catch(() => 0);

        const waitingPickupCount = await LoanSlip.count({
          where: {
            readerId: profileData.readerId,
            deleted: false,
            status: "WAITING_FOR_PICKUP",
          },
        }).catch(() => 0);

        const borrowingStatuses = ["BORROWING", "BORROWED", "OVERDUE"];
        const borrowingCount = await LoanSlip.count({
          where: {
            readerId: profileData.readerId,
            deleted: false,
            status: borrowingStatuses,
          },
        }).catch(() => 0);

        const activeLoansCount = pendingCount + waitingPickupCount + borrowingCount;

        const returnedCount = await LoanSlip.count({
          where: {
            readerId: profileData.readerId,
            deleted: false,
            status: "RETURNED",
          },
        }).catch(() => 0);

        profileData = {
          ...profileData,
          memberCard: memberCardData,
          loanCounts: {
            pending: pendingCount,
            waitingPickup: waitingPickupCount,
            borrowing: borrowingCount,
            activeTotal: activeLoansCount,
          },
          returnedCount,
        };
      } else {
        console.warn(`⚠️ Không tìm thấy Reader cho accountId=${accountId}`);
      }

      // =================
      // LIBRARIAN (role 2) hoặc ADMIN (role 1)
      // =================
    } else if (roleId === 2 || roleId === 1) {
      const librarian = await Librarian.findOne({ where: { accountId } });
      if (librarian) {
        profileData = librarian.toJSON();
        profileType = roleId === 1 ? "admin" : "librarian";
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

  await Account.scope("withSecrets").update(
    { refresh_token: refreshToken },
    { where: { accountId: account.accountId } }
  );

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

  if (account.status !== "active" && account.status !== "ACTIVE") {
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
// 📝 REGISTER READER (Legacy - keep for compatibility)
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
// 🔐 IN-MEMORY OTP STORE (FIXED)
// =============================
const OTP_STORE = new Map();

/**
 * Lưu OTP với email được normalize (lowercase + trim)
 */
function _saveOtp(email, otp, ttl = 10 * 60 * 1000, meta = {}) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const expiresAt = Date.now() + ttl;

  OTP_STORE.set(normalizedEmail, {
    otp: String(otp),
    expiresAt,
    meta
  });

  console.log(`💾 OTP saved for: ${normalizedEmail}`);
  console.log(`   OTP: ${otp}`);
  console.log(`   Expires: ${new Date(expiresAt).toISOString()}`);
}

/**
 * Verify OTP với email được normalize
 */
function _verifyOtp(email, otp) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const row = OTP_STORE.get(normalizedEmail);

  console.log(`🔍 Verifying OTP for: ${normalizedEmail}`);
  console.log(`   Stored OTP: ${row?.otp || 'NOT_FOUND'}`);
  console.log(`   Input OTP: ${otp}`);
  console.log(`   Expires at: ${row ? new Date(row.expiresAt).toISOString() : 'N/A'}`);

  if (!row) {
    console.log('❌ OTP not found in store');
    return false;
  }

  if (Date.now() > row.expiresAt) {
    console.log('❌ OTP expired');
    OTP_STORE.delete(normalizedEmail);
    return false;
  }

  const storedOtp = String(row.otp).trim();
  const inputOtp = String(otp).trim();

  if (storedOtp !== inputOtp) {
    console.log(`❌ OTP mismatch: stored="${storedOtp}" vs input="${inputOtp}"`);
    return false;
  }

  console.log('✅ OTP valid - deleting from store');
  OTP_STORE.delete(normalizedEmail);
  return true;
}

// =============================
// 📧 SEND REGISTRATION OTP
// =============================
async function sendRegistrationOtpService(email) {
  if (!email) {
    throw Object.assign(new Error('MISSING_EMAIL'), { statusCode: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if email exists (case-insensitive)
  const existing = await Account.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalizedEmail
    )
  });

  if (existing) {
    throw Object.assign(new Error('EMAIL_EXISTS'), { statusCode: 409 });
  }

  const otp = generateRandomCode(6);
  _saveOtp(normalizedEmail, otp);

  await mailService.sendOtpEmail(email, otp);

  return { ok: true, message: 'OTP_SENT' };
}

// =============================
// ✅ VERIFY OTP AND CREATE ACCOUNT
// =============================
async function verifyOtpAndCreateAccountService(payload) {
  const {
    email,
    otp,
    password,
    fullName,
    phoneNumber,
    dateOfBirth,
    gender,
    cccd,
    address
  } = payload;

  if (!email || !otp || !password || !fullName) {
    throw Object.assign(new Error('MISSING_FIELDS'), { statusCode: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Verify OTP
  if (!_verifyOtp(normalizedEmail, otp)) {
    throw Object.assign(new Error('OTP_INVALID_OR_EXPIRED'), { statusCode: 400 });
  }

  // Double-check email (case-insensitive)
  const ex = await Account.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalizedEmail
    )
  });

  if (ex) {
    throw Object.assign(new Error('EMAIL_EXISTS'), { statusCode: 409 });
  }

  if (cccd) {
    const er = await Reader.findOne({ where: { cccd } });
    if (er) {
      throw Object.assign(new Error('CCCD_EXISTS'), { statusCode: 409 });
    }
  }

  const tx = await sequelize.transaction();

  try {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const account = await Account.create({
      email: normalizedEmail,
      phoneNumber: phoneNumber || null,
      passwordHash,
      status: 'active',
      roleId: 3
    }, { transaction: tx });

    const reader = await Reader.create({
      accountId: account.accountId,
      roleId: 3,
      fullName,
      dateOfBirth: dateOfBirth || null,
      gender: typeof gender !== 'undefined' ? gender : null,
      cccd: cccd || null,
      address: address || null,
      totalBorrow: 0
    }, { transaction: tx });

    await tx.commit();

    console.log(`✅ Account created: ${account.email} | Reader: ${reader.readerId}`);

    return {
      account: {
        accountId: account.accountId,
        email: account.email
      },
      reader: {
        readerId: reader.readerId,
        fullName: reader.fullName
      }
    };
  } catch (err) {
    await tx.rollback();
    console.error('❌ Transaction failed:', err.message);
    throw err;
  }
}

// =============================
// 🎫 COMPLETE REGISTRATION (FIXED)
// =============================
async function completeRegistrationService({ readerId, cardTypeId, action = 'SKIP', extraInfo = {} }) {
  if (!readerId || !cardTypeId) {
    throw Object.assign(new Error('MISSING_FIELDS'), { statusCode: 400 });
  }

  const cardType = await CardType.findOne({ where: { cardTypeId, deleted: false } });
  if (!cardType) {
    throw Object.assign(new Error('CARD_TYPE_NOT_FOUND'), { statusCode: 404 });
  }

  // ============================================================
  // SKIP hoặc MIỄN PHÍ → Tạo thẻ ngay
  // ============================================================
  if (action === 'SKIP' || Number(cardType.price) <= 0) {
    const cardNumber = generateCardNumber();
    const today = new Date();
    const issueDate = today.toISOString().slice(0, 10);
    const expiryDate = new Date(
      today.getTime() + (cardType.duration || 365) * 24 * 3600 * 1000
    ).toISOString().slice(0, 10);

    const mc = await MemberCard.create({
      readerId,
      cardNumber,
      cardTypeId: cardType.cardTypeId,
      balance: 0.0,
      issueDate,
      expiryDate,
      status: 'ACTIVE',
      note: 'created_via_registration_skip_or_free'
    });

    return { ok: true, free: true, memberCard: mc };
  }

  // ============================================================
  // TRẢ PHÍ → Tạo Payment và gọi PayOS
  // ============================================================

  // ✅ Tạo orderCode là số nguyên từ timestamp
  const orderCode = Date.now();

  // Tạo Payment record ngay
  const payment = await Payment.create({
    loanSlipId: null,
    violationId: null,
    readerId,
    librarianId: Number(process.env.SYSTEM_LIBRARIAN_ID || 120401),
    paymentType: 'CARD_PURCHASE',
    amount: Number(cardType.price),
    paymentMethod: 'PAYOS_QR',
    paymentDate: null,
    transactionCode: String(orderCode), // ✅ Lưu dạng string
    status: 'PENDING',
    note: `cardType:${cardType.cardTypeId}`
  });

  console.log(`💳 Payment created: ${payment.paymentId} | orderCode: ${orderCode}`);

  // ✅ URL không có query params (PayOS sẽ tự động thêm)
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const returnUrl = `${baseUrl}/pay/return`;
  const cancelUrl = `${baseUrl}/pay/cancel`;

  let payosResp;
  try {
    // ✅ Gọi PayOS với orderCode là số nguyên
    payosResp = await payosService.createPaymentLink({
      orderCode: orderCode, // ✅ Number, không phải string
      amount: Number(cardType.price),
      description: `Mua thẻ ${cardType.typeName || cardType.cardTypeName}`,
      returnUrl,
      cancelUrl
    });

    console.log('✅ PayOS response:', JSON.stringify(payosResp, null, 2));

  } catch (err) {
    console.error('❌ PayOS create failed:', err.message);

    // Đánh dấu payment thất bại
    await payment.update({
      status: 'FAILED',
      note: (payment.note || '') + '|payos_create_failed:' + err.message
    });

    throw Object.assign(new Error('PAYOS_CREATE_FAILED'), { statusCode: 500 });
  }

  // ✅ Lưu thông tin PayOS vào Payment
  const payosData = payosResp?.data || payosResp || {};

  await payment.update({
    note: (payment.note || '') + `|payos:${JSON.stringify({
      paymentLinkId: payosData.paymentLinkId || payosData.id,
      checkoutUrl: payosData.checkoutUrl,
      qrCode: payosData.qrCode || payosData.qr
    })}`
  });

  // ✅ Trả về đầy đủ thông tin cho client
  return {
    ok: true,
    paymentId: payment.paymentId,
    orderCode: orderCode, // ✅ Trả về để client có thể tracking
    amount: payment.amount,
    payos: {
      checkoutUrl: payosData.checkoutUrl,
      qrCode: payosData.qrCode || payosData.qr,
      paymentLinkId: payosData.paymentLinkId || payosData.id
    }
  };
}

// =============================
// 💳 FINALIZE PAYMENT AND CREATE MEMBER CARD
// =============================
async function finalizePaymentAndCreateMemberCard(paymentOrId) {
  let payment = paymentOrId;
  if (!payment || !payment.paymentId) {
    payment = await Payment.findByPk(paymentOrId);
  }
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  if (String(payment.status).toUpperCase() === 'COMPLETED' || String(payment.status).toUpperCase() === 'PAID') {
    return payment;
  }

  const note = payment.note || '';
  const m = /cardType:(\d+)/.exec(note);
  const cardTypeId = m ? Number(m[1]) : null;

  if (!cardTypeId) {
    await payment.update({ status: 'COMPLETED', note: note + '|no_cardType_found' });
    return payment;
  }

  const existing = await MemberCard.findOne({
    where: { readerId: payment.readerId, status: 'ACTIVE', deleted: false }
  });

  if (existing) {
    const newNote = note + `|existing_card:${existing.memberCardId}`;
    await payment.update({ status: 'COMPLETED', note: newNote });
    return { payment: await Payment.findByPk(payment.paymentId), memberCard: existing };
  }

  const cardType = await CardType.findByPk(cardTypeId);
  const cardNumber = generateCardNumber();
  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const expiryDate = new Date(today.getTime() + (cardType.duration || 365) * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const card = await MemberCard.create({
    readerId: payment.readerId,
    cardNumber,
    cardTypeId,
    balance: 0.0,
    issueDate,
    expiryDate,
    status: 'ACTIVE',
    note: `created_via_payment_${payment.paymentId}`
  });

  const newNote = note + `|created_card:${card.memberCardId}`;
  await payment.update({ status: 'COMPLETED', note: newNote });

  return { payment: await Payment.findByPk(payment.paymentId), memberCard: card };
}

// =============================
// EXPORT
// =============================
module.exports = {
  loginService,
  refreshTokenService,
  logoutService,
  getFullProfile,
  registerReaderService,
  sendRegistrationOtpService,
  verifyOtpAndCreateAccountService,
  completeRegistrationService,
  finalizePaymentAndCreateMemberCard
};