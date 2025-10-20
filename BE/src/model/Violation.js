// src/model/Violation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Violation = sequelize.define('Violation', {
  violationId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'violationId' },
  readerId: { type: DataTypes.INTEGER, allowNull: false, field: 'readerId' },
  loanDetailId: { type: DataTypes.INTEGER, allowNull: false, field: 'loanDetailId' },
  type: { type: DataTypes.STRING(100), allowNull: true, field: 'type' },
  severity: { type: DataTypes.STRING(50), allowNull: true, field: 'severity' },
  violationDescription: { type: DataTypes.STRING(500), allowNull: true, field: 'violationDescription' },
  fineAmount: { type: DataTypes.DECIMAL(12,2), allowNull: true, field: 'fineAmount' },
  paymentStatus: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'UNPAID', field: 'paymentStatus' },
  librarianId: { type: DataTypes.INTEGER, allowNull: false, field: 'librarianId' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Violations', timestamps: false });

module.exports = Violation;
