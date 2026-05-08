const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const AppUsageLog = sequelize.define(
  "AppUsageLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { tableName: "admins", schema: "cedi_auth" },
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    sessionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    loginTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    logoutTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalActiveMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    totalBackgroundMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    backgroundEvents: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
  },
  {
    sequelize,
    modelName: "AppUsageLog",
    tableName: "app_usage_logs",
    schema: "cedi_auth",
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ["admin_id", "session_date"], unique: true }],
  },
);

module.exports = AppUsageLog;
