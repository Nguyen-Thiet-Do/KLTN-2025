// src/model/Reader.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reader = sequelize.define('Reader', {
  readerId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'readerId' },
  accountId: { type: DataTypes.INTEGER, allowNull: false, field: 'accountId' },
  roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'roleId' },
  fullName: { type: DataTypes.STRING(150), allowNull: false, field: 'fullName' },
  dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true, field: 'dateOfBirth' },
  gender: { type: DataTypes.STRING(20), allowNull: true, field: 'gender' },
  cccd: { type: DataTypes.STRING(20), allowNull: true, field: 'cccd' },
  address: { type: DataTypes.STRING(255), allowNull: true, field: 'address' },
  totolBorrow: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'totolBorrow' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Readers', timestamps: false });

module.exports = Reader;
