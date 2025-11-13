// src/model/Librarian.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Librarian = sequelize.define('Librarian', {
  librarianId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'librarianId' },
  accountId: { type: DataTypes.INTEGER, allowNull: false, field: 'accountId' },
  roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'roleId' },
  fullName: { type: DataTypes.STRING(150), allowNull: false, field: 'fullName' },
  dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true, field: 'dateOfBirth' },
  gender: { type: DataTypes.STRING(20), allowNull: true, field: 'gender' },
  hireDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'hireDate' },
  cccd: { type: DataTypes.STRING(20), allowNull: true, field: 'cccd' },
  address: { type: DataTypes.STRING(255), allowNull: true, field: 'address' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Librarians', timestamps: false });

module.exports = Librarian;
