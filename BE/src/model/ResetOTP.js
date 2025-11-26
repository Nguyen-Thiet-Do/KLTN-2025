// src/model/ResetOTP.js (hoặc tương tự)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ResetOTP = sequelize.define('ResetOTP', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'reset_otps',
  timestamps: true, // ⭐ Bật timestamps để tự động tạo createdAt, updatedAt
});

module.exports = ResetOTP;