// src/model/Renawal.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// DB table name is 'Renawals'
const Renewal = sequelize.define('Renewal', {
  renewalId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'renewalId' },
  loanDetailId: { type: DataTypes.INTEGER, allowNull: false, field: 'loanDetailId' },
  oldDueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'oldDueDate' },
  newDueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'newDueDate' },
  reason: { type: DataTypes.STRING(300), allowNull: true, field: 'reason' },
  librairianId: { type: DataTypes.INTEGER, allowNull: false, field: 'librairianId' },
  status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'APPROVED', field: 'status' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Renewals', timestamps: false });

module.exports = Renewal;
