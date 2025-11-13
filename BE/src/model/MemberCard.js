const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MemberCard = sequelize.define('MemberCard', {
  memberCardId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'memberCardId'
  },

  readerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'readerId'
  },

  cardNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'cardNumber'
  },

  cardTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'cardTypeId'
  },

  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'balance'
  },

  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'issueDate'
  },

  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'expiryDate'
  },

  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'ACTIVE',
    field: 'status'
  },

  note: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'note'
  },

  deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'deleted'
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },

}, {
  tableName: 'MemberCards',
  timestamps: false
});

module.exports = MemberCard;
