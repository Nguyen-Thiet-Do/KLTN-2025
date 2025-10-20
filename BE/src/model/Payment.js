// src/model/Payment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  paymentId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'paymentId' },
  loanSlipId: { type: DataTypes.INTEGER, allowNull: true, field: 'loanSlipId' },
  violationId: { type: DataTypes.INTEGER, allowNull: true, field: 'violationId' },
  readerId: { type: DataTypes.INTEGER, allowNull: false, field: 'readerId' },
  librarianId: { type: DataTypes.INTEGER, allowNull: false, field: 'librarianId' },
  paymentType: { type: DataTypes.STRING(100), allowNull: true, field: 'paymentType' },
  amount: { type: DataTypes.DECIMAL(12,2), allowNull: false, field: 'amount' },
  paymentMethod: { type: DataTypes.STRING(100), allowNull: true, field: 'paymentMethod' },
  paymentDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'paymentDate' },
  transactionCode: { type: DataTypes.STRING(100), allowNull: true, field: 'transactionCode' },
  status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'COMPLETED', field: 'status' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Payments', timestamps: false });

module.exports = Payment;
