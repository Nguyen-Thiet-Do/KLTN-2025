// src/model/DocumentGenreMap.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentGenreMap = sequelize.define('DocumentGenreMap', {
  documentId: { type: DataTypes.INTEGER, primaryKey: true, field: 'documentId' },
  genreId: { type: DataTypes.INTEGER, primaryKey: true, field: 'genreId' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'DocumentGenreMaps', timestamps: false });

module.exports = DocumentGenreMap;
