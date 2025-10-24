// src/model/DocumentCopy.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentCopy = sequelize.define('DocumentCopy', {
  documentCopyId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'documentCopyId' },
  documentId: { type: DataTypes.INTEGER, allowNull: false, field: 'documentId' },
  barCode: { type: DataTypes.STRING(100), allowNull: false, field: 'barCode' },
  status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'AVAILABLE', field: 'status' },
  conditionNote: { type: DataTypes.STRING(500), allowNull: true, field: 'conditionNote' },
  entryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'entryDate' },
  conditionGrade: { type: DataTypes.STRING(50), allowNull: true, field: 'conditionGrade' },
  numberBorrow: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'numberBorrow' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'DocumentCopys', timestamps: false });

module.exports = DocumentCopy;
