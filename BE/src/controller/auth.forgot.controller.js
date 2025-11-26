// src/controllers/auth.forgot.controller.js

const service = require("../service/auth.forgot.service");

module.exports = {
  async sendOTP(req, res) {
    const { email } = req.body;
    const result = await service.sendOTP(email);
    res.status(result.success ? 200 : 400).json(result);
  },

  async verifyOTP(req, res) {
    const { email, otp } = req.body;
    const result = await service.verifyOTP(email, otp);
    res.status(result.success ? 200 : 400).json(result);
  },

  async resetPassword(req, res) {
    const { email, newPassword } = req.body;
    const result = await service.resetPassword(email, newPassword);
    res.status(result.success ? 200 : 400).json(result);
  },
};
