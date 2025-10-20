// src/model/Magazine.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Magazine = sequelize.define('Magazine', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, field: 'documentId' },
  issn: { type: DataTypes.STRING(30), allowNull: true, field: 'issn' },
  volume: { type: DataTypes.INTEGER, allowNull: true, field: 'volume' },
  issue: { type: DataTypes.INTEGER, allowNull: true, field: 'issue' },
  period: { type: DataTypes.STRING(50), allowNull: true, field: 'period' },
  coverDate: { type: DataTypes.DATE, allowNull: true, field: 'coverDate' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Magazines', timestamps: false });

module.exports = Magazine;
