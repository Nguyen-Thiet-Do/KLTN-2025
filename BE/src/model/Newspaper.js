// src/model/Newspaper.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Newspaper = sequelize.define('Newspaper', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, field: 'documentId' },
  issn: { type: DataTypes.STRING(30), allowNull: true, field: 'issn' },
  issueDate: { type: DataTypes.DATE, allowNull: true, field: 'issueDate' },
  issueNumber: { type: DataTypes.INTEGER, allowNull: true, field: 'issueNumber' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Newspapers', timestamps: false });

module.exports = Newspaper;
