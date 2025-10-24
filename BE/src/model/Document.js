// src/model/Document.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'documentId' },
  categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'categoryId' },
  publisherId: { type: DataTypes.INTEGER, allowNull: true, field: 'publisherId' },
  title: { type: DataTypes.STRING(300), allowNull: false, field: 'title' },
  shelfLocation: { type: DataTypes.STRING(100), allowNull: true, field: 'shelfLocation' },
  language: { type: DataTypes.STRING(50), allowNull: true, field: 'language' },
  publicationYear: { type: DataTypes.INTEGER, allowNull: true, field: 'publicationYear' },
  coverPrice: { type: DataTypes.INTEGER, allowNull: true, field: 'coverPrice' },
  description: { type: DataTypes.TEXT, allowNull: true, field: 'description' },
  coverPhoto: { type: DataTypes.STRING(500), allowNull: true, field: 'coverPhoto' },
  ebookUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'ebookUrl' },
  numberOfCopy: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'numberOfCopy' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Documents', timestamps: false });

module.exports = Document;
