// src/model/Review.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Review = sequelize.define("Review", {
  reviewId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: "reviewId",
  },
  readerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: "readerId",
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: "documentId",
  },
  rating: {
    type: DataTypes.TINYINT,
    allowNull: true,
    field: "rating",
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: "comment",
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: "created_at",
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: "updated_at",
  },
}, {
  tableName: "Reviews",
  timestamps: false,
});

module.exports = Review;
