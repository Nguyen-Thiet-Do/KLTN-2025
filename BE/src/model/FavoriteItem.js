const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FavoriteItem = sequelize.define("FavoriteItem", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  readerId: { type: DataTypes.INTEGER, allowNull: false },
  documentId: { type: DataTypes.INTEGER, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: "FavoriteItems",
  timestamps: false
});

module.exports = FavoriteItem;
