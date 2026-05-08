const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Payment = sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    loanId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    paymentType: {
      type: DataTypes.ENUM("full", "partial"),
      allowNull: false,
    },
    mobileMoneyProvider: {
      type: DataTypes.ENUM("MTN", "Hubtel", "AirtelTigo"),
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    transactionId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    externalTransactionId: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ),
      defaultValue: "pending",
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: "mobile_money",
    },
    initiatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completedAt: DataTypes.DATE,
    failedAt: DataTypes.DATE,
    // { responseCode, responseMessage, rawResponse }
    gatewayResponse: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    transactionFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    failureReason: DataTypes.TEXT,
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // [{ note, addedBy, addedAt }]
    adminNotes: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    // { userAgent, ipAddress, deviceInfo }
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    schema: "cedi_payments",
    tableName: "payments",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["user_id", "loan_id"] },
      { fields: ["status", "created_at"] },
      {
        unique: true,
        fields: ["transaction_id"],
        where: { transaction_id: { [require("sequelize").Op.ne]: null } },
      },
    ],
    hooks: {
      beforeCreate: (payment) => {
        if (!payment.transactionId) {
          const ts = Date.now().toString();
          const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
          payment.transactionId = `TXN-${ts}-${rand}`;
        }
      },
    },
  },
);

// ── Instance Methods ──────────────────────────────────────────────────────────
Payment.prototype.getPaymentReference = function () {
  return `PAY-${this.id.toString().slice(-8).toUpperCase()}`;
};

Payment.prototype.markAsCompleted = async function (
  externalTxnId,
  gatewayResponse,
) {
  const updates = { status: "completed", completedAt: new Date() };
  if (externalTxnId) updates.externalTransactionId = externalTxnId;
  if (gatewayResponse) updates.gatewayResponse = gatewayResponse;
  await this.update(updates);
};

Payment.prototype.markAsFailed = async function (reason, gatewayResponse) {
  const updates = {
    status: "failed",
    failedAt: new Date(),
    failureReason: reason,
    retryCount: (this.retryCount || 0) + 1,
  };
  if (gatewayResponse) updates.gatewayResponse = gatewayResponse;
  await this.update(updates);
};

Payment.prototype.retry = async function () {
  if ((this.retryCount || 0) >= 3)
    throw new Error("Maximum retry attempts exceeded");
  await this.update({
    status: "pending",
    failedAt: null,
    failureReason: null,
    retryCount: (this.retryCount || 0) + 1,
  });
};

module.exports = Payment;
