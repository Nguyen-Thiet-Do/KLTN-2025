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
    if (roleId === 3) {
      const reader = await Reader.findOne({ where: { accountId } });
      if (reader) {
        profileData = reader.toJSON();
        profileType = "reader";

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

  if (!_verifyOtp(normalizedEmail, otp)) {
    throw Object.assign(new Error('OTP_INVALID_OR_EXPIRED'), { statusCode: 400 });
  }

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
// 🎫 COMPLETE REGISTRATION
// =============================
async function completeRegistrationService({ readerId, cardTypeId, action = 'SKIP', extraInfo = {} }) {
  if (!readerId || !cardTypeId) {
    throw Object.assign(new Error('MISSING_FIELDS'), { statusCode: 400 });
  }

  const cardType = await CardType.findOne({ where: { cardTypeId, deleted: false } });
  if (!cardType) {
    throw Object.assign(new Error('CARD_TYPE_NOT_FOUND'), { statusCode: 404 });
  }

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

  const orderCode = Date.now();

  const payment = await Payment.create({
    loanSlipId: null,
    violationId: null,
    readerId,
    librarianId: Number(process.env.SYSTEM_LIBRARIAN_ID || 120401),
    paymentType: 'CARD_PURCHASE',
    amount: Number(cardType.price),
    paymentMethod: 'PAYOS_QR',
    paymentDate: null,
    transactionCode: String(orderCode),
    status: 'PENDING',
    note: `cardType:${cardType.cardTypeId}`
  });

  console.log(`💳 Payment created: ${payment.paymentId} | orderCode: ${orderCode}`);

  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const returnUrl = `${baseUrl}/pay/return`;
  const cancelUrl = `${baseUrl}/pay/cancel`;

  let payosResp;
  try {
    payosResp = await payosService.createPaymentLink({
      orderCode: orderCode,
      amount: Number(cardType.price),
      description: `Thanh toán thẻ thành viên`,
      returnUrl,
      cancelUrl,
      items: [{
        name: cardType.cardTypeName || cardType.typeName || 'Membership Card',
        quantity: 1,
        price: Number(cardType.price)
      }]
    });

    console.log('✅ PayOS response:', JSON.stringify(payosResp, null, 2));

  } catch (err) {
    console.error('❌ PayOS create failed:', err.message);

    await payment.update({
      status: 'FAILED',
      note: (payment.note || '') + '|payos_create_failed:' + err.message
    });

    throw Object.assign(new Error('PAYOS_CREATE_FAILED'), { statusCode: 500 });
  }

  const payosData = payosResp?.data || payosResp || {};

  await payment.update({
    note: (payment.note || '') + `|payos:${JSON.stringify({
      paymentLinkId: payosData.paymentLinkId || payosData.id,
      checkoutUrl: payosData.checkoutUrl,
      qrCode: payosData.qrCode || payosData.qr
    })}`
  });

  return {
    ok: true,
    paymentId: payment.paymentId,
    orderCode: orderCode,
    amount: payment.amount,
    payos: {
      checkoutUrl: payosData.checkoutUrl,
      qrCode: payosData.qrCode || payosData.qr,
      paymentLinkId: payosData.paymentLinkId || payosData.id
    }
  };
}

// =============================
// 💳 FINALIZE PAYMENT AND CREATE MEMBER CARD (FIXED)
// =============================
// =============================
// 💳 FINALIZE PAYMENT AND CREATE MEMBER CARD (WITH EMAIL NOTIFICATION)
// =============================
async function finalizePaymentAndCreateMemberCard(paymentOrId) {
  try {
    let payment = paymentOrId;
    if (!payment || !payment.paymentId) {
      payment = await Payment.findByPk(paymentOrId);
    }

    if (!payment) {
      console.error('❌ Payment not found');
      throw new Error('PAYMENT_NOT_FOUND');
    }

    console.log('💳 Processing payment:', {
      paymentId: payment.paymentId,
      readerId: payment.readerId,
      status: payment.status,
      note: payment.note
    });

    // ✅ KIỂM TRA CARD TRƯỚC (quan trọng nhất)
    const existingCard = await MemberCard.findOne({
      where: {
        readerId: payment.readerId,
        status: 'ACTIVE',
        deleted: false
      }
    });

    if (existingCard) {
      console.log('✅ Member card already exists:', existingCard.memberCardId);
      return { payment, memberCard: existingCard };
    }

    // ✅ Nếu chưa có card, kiểm tra note có cardTypeId không
    const note = payment.note || '';
    const m = /cardType:(\d+)/.exec(note);
    const cardTypeId = m ? Number(m[1]) : null;

    console.log('🔍 Extracted cardTypeId:', cardTypeId, 'from note:', note);

    if (!cardTypeId) {
      console.warn('❌ No cardTypeId found in payment note');
      return { payment, memberCard: null };
    }

    // ✅ Get CardType
    const cardType = await CardType.findByPk(cardTypeId);

    if (!cardType) {
      console.error('❌ CardType not found:', cardTypeId);
      throw new Error('CARD_TYPE_NOT_FOUND');
    }

    console.log('📋 CardType found:', {
      cardTypeId: cardType.cardTypeId,
      typeName: cardType.cardTypeName || cardType.typeName,
      duration: cardType.duration
    });

    // ✅ Generate card details
    const cardNumber = generateCardNumber();
    const today = new Date();
    const issueDate = today.toISOString().slice(0, 10);
    const expiryDate = new Date(today.getTime() + (cardType.duration || 365) * 24 * 3600 * 1000).toISOString().slice(0, 10);

    console.log('🎫 Creating MemberCard:', {
      readerId: payment.readerId,
      cardNumber,
      cardTypeId,
      issueDate,
      expiryDate
    });

    // ✅ Create MemberCard
    const card = await MemberCard.create({
      readerId: payment.readerId,
      cardNumber,
      cardTypeId,
      balance: Number(payment.amount),
      issueDate,
      expiryDate,
      status: 'ACTIVE',
      note: `created_via_payment_${payment.paymentId}`
    });

    console.log('✅ MemberCard created successfully:', {
      memberCardId: card.memberCardId,
      cardNumber: card.cardNumber,
      readerId: card.readerId
    });

    // ✅ Update payment note
    const newNote = note + `|created_card:${card.memberCardId}`;
    await payment.update({ note: newNote });

    console.log('✅ Payment updated with card info');

    // === Send confirmation email (best-effort: log errors but don't break flow) ===
    try {
      // Try to get reader and account info
      let readerEmail = null;
      let readerFullName = '';

      const reader = await Reader.findByPk(card.readerId);
      if (reader) {
        readerFullName = reader.fullName || '';
        if (reader.accountId) {
          const account = await Account.findByPk(reader.accountId);
          if (account && account.email) {
            readerEmail = account.email;
          }
        }
      }

      // Fallback: if readerEmail not found, try payment.readerId (in case different)
      if (!readerEmail && payment.readerId) {
        const r2 = await Reader.findByPk(payment.readerId);
        if (r2) {
          if (!readerFullName) readerFullName = r2.fullName || '';
          if (r2.accountId) {
            const a2 = await Account.findByPk(r2.accountId);
            if (a2 && a2.email) readerEmail = a2.email;
          }
        }
      }

      if (readerEmail) {
        // prepare mail data
        const mailData = {
          fullName: readerFullName || '',
          cardNumber: card.cardNumber,
          cardTypeName: cardType.cardTypeName || cardType.typeName || '',
          amount: Number(payment.amount) || 0,
          issueDate: card.issueDate,
          expiryDate: card.expiryDate,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@booktechv2.net',
          supportPhone: process.env.SUPPORT_PHONE || '0123-456-789',
          year: new Date().getFullYear()
        };

        try {
          // mailService.sendMemberCardIssuedEmail should be available (ensure imported)
          await mailService.sendMemberCardIssuedEmail(readerEmail, mailData);
          console.log('✅ Confirmation email sent to', readerEmail);
        } catch (mailErr) {
          console.error('❌ Failed to send confirmation email:', mailErr?.message || mailErr);
          // Do NOT throw — keep flow intact
        }
      } else {
        console.warn('⚠️ No reader email found — skipping member card confirmation email.');
      }
    } catch (prepareMailErr) {
      console.error('❌ Error while preparing/sending member card email:', prepareMailErr?.message || prepareMailErr);
      // Do not throw
    }

    // ✅ Return fresh data
    const updatedPayment = await Payment.findByPk(payment.paymentId);

    return {
      payment: updatedPayment,
      memberCard: card
    };

  } catch (error) {
    console.error('❌ finalizePaymentAndCreateMemberCard ERROR:', {
      message: error.message,
      stack: error.stack,
      paymentId: paymentOrId?.paymentId || paymentOrId
    });
    throw error;
  }
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