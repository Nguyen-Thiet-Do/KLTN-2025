// src/model/CardType.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CardType = sequelize.define('CardType', {
  cardTypeId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'cardTypeId' },
  typeName: { type: DataTypes.STRING(50), allowNull: false, field: 'typeName' }, // FREE / PREMIUM
  price: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0.00, field: 'price' },
  duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 365, field: 'duration' }, // days
  canBorrowHome: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'canBorrowHome' },
  maxBorrowLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'maxBorrowLimit' },
  borrowDuration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'borrowDuration' },
  canReadOnsite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'canReadOnsite' },
  canSearchCatalog: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'canSearchCatalog' },
  canReadEbook: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'canReadEbook' },

  // mapping đúng với DB columns (snake_case)
  renewalLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'renewal_limit',
    comment: 'Số lần tối đa được phép gia hạn (lấy từ DB renewal_limit)'
  },
  renewalDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7,
    field: 'renewal_days',
    comment: 'Số ngày cộng thêm mỗi lần gia hạn (lấy từ DB renewal_days)'
  },

  description: { type: DataTypes.TEXT, allowNull: true, field: 'description' },
  deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'deleted' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
}, {
  tableName: 'CardTypes',
  timestamps: false
});

module.exports = CardType;
