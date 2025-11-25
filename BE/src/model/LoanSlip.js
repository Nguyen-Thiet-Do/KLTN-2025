// src/model/LoanSlip.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoanSlip = sequelize.define('LoanSlip', {
  loanSlipId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'loanSlipId' },
  readerId: { type: DataTypes.INTEGER, allowNull: false, field: 'readerId' },
  librarianId: { type: DataTypes.INTEGER, allowNull: true, field: 'librarianId' },
  loanDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'loanDate' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'dueDate' },
  status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'OPEN', field: 'status' },

  // cột renewalCount đã tồn tại trong DB (theo file SQL)
  renewalCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'renewalCount',
    comment: 'Số lần phiếu này đã được gia hạn (theo phiếu)'
  },

  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, {
  tableName: 'LoanSlips',
  timestamps: false
});

module.exports = LoanSlip;
