// src/model/LoanDetail.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoanDetail = sequelize.define('LoanDetail', {
  loanDetailId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'loanDetailId' },
  loanSlipId: { type: DataTypes.INTEGER, allowNull: false, field: 'loanSlipId' },
  documentCopyId: { type: DataTypes.INTEGER, allowNull: true, field: 'documentCopyId' },
  returnDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'returnDate' },
  conditionBorrow: { type: DataTypes.STRING(100), allowNull: true, field: 'conditionBorrow' },
  conditionReturn: { type: DataTypes.STRING(100), allowNull: true, field: 'conditionReturn' },
  fineAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'fineAmount' },
  renewalCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'renewalCount' },
  status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'BORROWED', field: 'status' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'LoanDetails', timestamps: false });

module.exports = LoanDetail;
