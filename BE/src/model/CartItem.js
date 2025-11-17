const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CartItem = sequelize.define("CartItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id'
  },
  readerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'readerId'
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'documentId'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'createdAt'
  }
}, {
  tableName: "CartItems",
  timestamps: false,
});

module.exports = CartItem;
