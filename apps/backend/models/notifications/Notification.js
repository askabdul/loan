const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        "info",
        "success",
        "warning",
        "error",
        "loan_status",
        "payment",
        "system",
      ),
      defaultValue: "info",
    },
    // Recipient — one of: user, admin, role, broadcast
    recipientUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    recipientAdminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    recipientRole: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isBroadcast: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Arbitrary extra data for the notification
    data: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    readAt: DataTypes.DATE,
    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "urgent"),
      defaultValue: "medium",
    },
    expiresAt: DataTypes.DATE,
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "cedi_notifications",
    tableName: "notifications",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["recipient_user_id", "created_at"] },
      { fields: ["recipient_admin_id", "created_at"] },
      { fields: ["recipient_role", "created_at"] },
      { fields: ["is_broadcast", "created_at"] },
      { fields: ["is_read"] },
      { fields: ["expires_at"] },
    ],
  },
);

module.exports = Notification;
