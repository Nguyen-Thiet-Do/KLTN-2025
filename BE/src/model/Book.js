// src/model/Book.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Book = sequelize.define('Book', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, field: 'documentId' },
  isbn: { type: DataTypes.STRING(30), allowNull: true, field: 'isbn' },
  edition: { type: DataTypes.INTEGER, allowNull: true, field: 'edition' },
  pageCount: { type: DataTypes.INTEGER, allowNull: true, field: 'pageCount' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Books', timestamps: false });

module.exports = Book;
