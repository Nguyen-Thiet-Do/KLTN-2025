/**
 * Unit test cho src/service/auth.forgot.service.js
 * Mock Account, ResetOTP, bcrypt, mailService.
 */

jest.mock('../model', () => ({
  Account: {
    findOne: jest.fn(),
    scope: jest.fn(() => ({
      findOne: jest.fn()
    }))
  },
  ResetOTP: {
    create: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.mock('../utils/generateOTP', () => () => "999999");

jest.mock('../service/mailService', () => ({
  sendOtpEmail: jest.fn(() => Promise.resolve()),
  sendEmail: jest.fn(() => Promise.resolve())
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(() => Promise.resolve("hashedPassword")),
  compare: jest.fn(() => Promise.resolve(true))
}));

const forgotService = require('../service/auth.forgot.service');
const { Account, ResetOTP } = require('../model');

describe("forgotService - sendOTP", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Email không tồn tại → trả về success=false", async () => {
    Account.findOne.mockResolvedValue(null);

    const res = await forgotService.sendOTP("no@gmail.com");
    expect(res.success).toBe(false);
  });

  test("Email hợp lệ → gửi OTP thành công", async () => {
    Account.findOne.mockResolvedValue({ accountId: 1, email: "a@gmail.com" });
    ResetOTP.create.mockResolvedValue(true);

    const res = await forgotService.sendOTP("a@gmail.com");
    expect(res.success).toBe(true);
  });

});


describe("forgotService - verifyOTP", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Thiếu thông tin → fail", async () => {
    const res = await forgotService.verifyOTP(null, null);
    expect(res.success).toBe(false);
  });

  test("OTP không tồn tại → fail", async () => {
    ResetOTP.findOne.mockResolvedValue(null);

    const res = await forgotService.verifyOTP("a@gmail.com", "111111");
    expect(res.success).toBe(false);
  });

  test("OTP hợp lệ → success", async () => {
    const fakeOtp = {
      otp: "111111",
      used: false,
      expiresAt: new Date(Date.now() + 10000),
      save: jest.fn()
    };

    ResetOTP.findOne.mockResolvedValue(fakeOtp);

    const res = await forgotService.verifyOTP("a@gmail.com", "111111");
    expect(res.success).toBe(true);
  });

});


describe("forgotService - resetPassword", () => {

  beforeEach(() => jest.clearAllMocks());

  test("Email không hợp lệ → fail", async () => {
    const res = await forgotService.resetPassword("", "newpass");
    expect(res.success).toBe(false);
  });

  test("Không tìm thấy account → fail", async () => {
    Account.scope = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null)
    }));

    const res = await forgotService.resetPassword("no@gmail.com", "newpass123");
    expect(res.success).toBe(false);
  });

  test("Reset password thành công", async () => {
    const fakeAccount = { save: jest.fn(), email: "a@gmail.com" };

    Account.scope = jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(fakeAccount)
    }));

    const res = await forgotService.resetPassword("a@gmail.com", "newpass123");
    expect(res.success).toBe(true);
  });

});
