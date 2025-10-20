// src/model/DocumentAuthorMap.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentAuthorMap = sequelize.define('DocumentAuthorMap', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, field: 'documentId' },
  authorId: { type: DataTypes.INTEGER, primaryKey: true, field: 'authorId' },
  role: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'main', field: 'role' },
  ord: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1, field: 'ord' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'DocumentAuthorMaps', timestamps: false });

module.exports = DocumentAuthorMap;
