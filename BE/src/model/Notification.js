// src/model/Notification.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  notificationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'notificationID' },
  readerId: { type: DataTypes.INTEGER, allowNull: false, field: 'readerId' },
  type: { type: DataTypes.STRING(100), allowNull: true, field: 'type' },
  title: { type: DataTypes.STRING(200), allowNull: true, field: 'title' },
  content: { type: DataTypes.TEXT, allowNull: true, field: 'content' },
  priority: { type: DataTypes.STRING(50), allowNull: true, field: 'priority' },
  link: { type: DataTypes.STRING(500), allowNull: true, field: 'link' },
  isRead: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, field: 'isRead' },
  readAt: { type: DataTypes.DATE, allowNull: true, field: 'readAt' },
  emailAt: { type: DataTypes.DATE, allowNull: true, field: 'emailAt' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, { tableName: 'Notifications', timestamps: false });

module.exports = Notification;
