// src/model/Publisher.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Publisher = sequelize.define('Publisher', {
  publisherId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'publisherId' },
  name: { type: DataTypes.STRING(200), allowNull: false, field: 'name' },
  note: { type: DataTypes.STRING(500), allowNull: true, field: 'note' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Publishers', timestamps: false });

module.exports = Publisher;
