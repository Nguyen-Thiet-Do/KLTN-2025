// src/model/LibraryRule.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LibraryRule = sequelize.define('LibraryRule', {
  libraryRuleId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'libraryRuleId' },
  accountId: { type: DataTypes.INTEGER, allowNull: false, field: 'accountId' },
  nameRule: { type: DataTypes.STRING(200), allowNull: false, field: 'nameRule' },
  description: { type: DataTypes.STRING(500), allowNull: true, field: 'description' },
  value: { type: DataTypes.STRING(200), allowNull: true, field: 'value' },
  type: { type: DataTypes.STRING(100), allowNull: true, field: 'type' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true, field: 'isActive' },
  effectiveFrom: { type: DataTypes.DATEONLY, allowNull: true, field: 'effectiveFrom' },
  effectiveTo: { type: DataTypes.DATEONLY, allowNull: true, field: 'effectiveTo' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'LibraryRules', timestamps: false });

module.exports = LibraryRule;
