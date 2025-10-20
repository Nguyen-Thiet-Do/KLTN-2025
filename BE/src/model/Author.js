// src/model/Author.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Author = sequelize.define('Author', {
  authorId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'authorId' },
  fullName: { type: DataTypes.STRING(200), allowNull: false, field: 'fullName' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Authors', timestamps: false });

module.exports = Author;
