const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Account = sequelize.define(
  "Account",
  {
    accountId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: "accountId",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      field: "email",
    },
    phoneNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "phoneNumber",
    },
    passwordHash: {
      type: DataTypes.STRING(256),
      allowNull: false,
      field: "password",
    },
    status: {
      type: DataTypes.ENUM("active", "locked", "inactive"),
      allowNull: true,
      defaultValue: "active",
      field: "status",
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "roleId",
    },

    // ✅ Thêm cột deleted để hỗ trợ xóa mềm
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "deleted",
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "refresh_token",
    },
  },
  {
    tableName: "accounts",
    timestamps: false,

    // Ẩn mật khẩu mặc định
    defaultScope: {
      attributes: { exclude: ["passwordHash", "refresh_token"] },
    },

    // ✅ Scope để Passport có thể truy cập mật khẩu đầy đủ
    scopes: {
      withSecrets: {
        attributes: { exclude: [] },
      },
    },
  }
);

module.exports = Account;
