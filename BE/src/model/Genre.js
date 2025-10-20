// src/model/Genre.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Genre = sequelize.define('Genre', {
  genreId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'genreId' },
  name: { type: DataTypes.STRING(150), allowNull: false, field: 'name' },
  documentType: { type: DataTypes.STRING(50), allowNull: true, field: 'documentType' },
  description: { type: DataTypes.STRING(500), allowNull: true, field: 'description' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Genres', timestamps: false });

module.exports = Genre;
