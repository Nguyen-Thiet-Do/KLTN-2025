/**
 * Unit test cho src/service/authService.js
 * Mock toàn bộ Model + mailService + helper để không cần DB thật.
 */

jest.mock('../model/index', () => ({
  Account: {
    findOne: jest.fn(),
    create: jest.fn(),
    scope: jest.fn(() => ({
      update: jest.fn(),
      findOne: jest.fn()
    }))
  },
  Reader: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  MemberCard: { findOne: jest.fn() },
  CardType: { findOne: jest.fn() },
  LoanSlip: { count: jest.fn() },
  Payment: { create: jest.fn(), findByPk: jest.fn() }
}));

jest.mock('../config/database', () => ({
  transaction: jest.fn(() => ({ commit: jest.fn(), rollback: jest.fn() })),
  where: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
}));

jest.mock('../utils/helpers', () => ({
  generateRandomCode: jest.fn(() => '123456'),
  generateCardNumber: jest.fn(() => 'CARD0001')
}));

jest.mock('../service/mailService', () => ({
  sendOtpEmail: jest.fn(() => Promise.resolve()),
  sendMemberCardIssuedEmail: jest.fn(() => Promise.resolve()),
  sendEmail: jest.fn(() => Promise.resolve())
}));

const authService = require('../service/authService');
const { Account, Reader } = require('../model/index');

describe("authService - sendRegistrationOtpService", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Thiếu email → báo lỗi", async () => {
    await expect(authService.sendRegistrationOtpService())
      .rejects.toThrow("MISSING_EMAIL");
  });

  test("Email đã tồn tại → báo lỗi EMAIL_EXISTS", async () => {
    Account.findOne.mockResolvedValue({ accountId: 1 });

    await expect(authService.sendRegistrationOtpService("abc@gmail.com"))
      .rejects.toThrow("EMAIL_EXISTS");
  });

  test("Gửi OTP thành công", async () => {
    Account.findOne.mockResolvedValue(null);

    const res = await authService.sendRegistrationOtpService("new@gmail.com");
    expect(res.ok).toBe(true);
    expect(res.message).toBe("OTP_SENT");
  });

});


describe("authService - verifyOtpAndCreateAccountService", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Thiếu trường → lỗi MISSING_FIELDS", async () => {
    await expect(authService.verifyOtpAndCreateAccountService({ email: "a@gmail.com" }))
      .rejects.toThrow("MISSING_FIELDS");
  });

  test("OTP không hợp lệ → báo lỗi", async () => {
    const data = {
      email: "a@gmail.com",
      otp: "000000",
      password: "123456",
      fullName: "Tester"
    };

    await expect(authService.verifyOtpAndCreateAccountService(data))
      .rejects.toThrow("OTP_INVALID_OR_EXPIRED");
  });

});


describe("authService - registerReaderService", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Thiếu thông tin → báo lỗi", async () => {
    await expect(authService.registerReaderService({ email: null }))
      .rejects.toThrow("MISSING_REQUIRED_FIELDS");
  });

  test("Email sai format → báo lỗi", async () => {
    await expect(authService.registerReaderService({
      email: "invalid",
      password: "123456",
      fullName: "Test"
    })).rejects.toThrow("INVALID_EMAIL");
  });

  test("Password yếu → báo lỗi", async () => {
    await expect(authService.registerReaderService({
      email: "ok@gmail.com",
      password: "123",
      fullName: "Test"
    })).rejects.toThrow("WEAK_PASSWORD");
  });

  test("Email đã tồn tại → báo lỗi EMAIL_EXISTS", async () => {
    Account.findOne.mockResolvedValue({ accountId: 1 });

    await expect(authService.registerReaderService({
      email: "abc@gmail.com",
      password: "123456",
      fullName: "Test"
    })).rejects.toThrow("EMAIL_EXISTS");
  });

});
