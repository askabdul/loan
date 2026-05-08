const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const LoanClearance = sequelize.define(
  "LoanClearance",
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
    paymentType: {
      type: DataTypes.ENUM("full", "partial"),
      allowNull: false,
    },
    amountCleared: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    popUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    submittedById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reviewedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "reviewed",
        "completed",
        "rejected",
        "withdrawn",
      ),
      defaultValue: "pending",
    },
    verificationPopUrl: DataTypes.STRING,
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    reviewedAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
    submissionNotes: DataTypes.TEXT,
    reviewNotes: DataTypes.TEXT,
    rejectionReason: DataTypes.TEXT,
    withdrawnAt: DataTypes.DATE,
    withdrawalReason: DataTypes.TEXT,
    originalLoanBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    remainingBalanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
  },
  {
    schema: "cedi_loans",
    tableName: "loan_clearances",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["user_id", "loan_id"] },
      { fields: ["status", "submitted_at"] },
      { fields: ["submitted_by_id", "status"] },
    ],
  },
);

// ── Instance Methods ──────────────────────────────────────────────────────────
LoanClearance.prototype.getClearanceReference = function () {
  return `CLR-${this.id.toString().slice(-6).toUpperCase()}`;
};

LoanClearance.prototype.markAsReviewed = async function (
  reviewerId,
  verificationPopUrl,
  notes,
) {
  await this.update({
    reviewedById: reviewerId,
    verificationPopUrl,
    reviewNotes: notes,
    status: "reviewed",
    reviewedAt: new Date(),
  });
};

LoanClearance.prototype.markAsCompleted = async function () {
  await this.update({ status: "completed", completedAt: new Date() });
};

LoanClearance.prototype.markAsRejected = async function (reason) {
  await this.update({
    status: "rejected",
    rejectionReason: reason,
    reviewedAt: new Date(),
  });
};

LoanClearance.prototype.withdraw = async function (reason) {
  if (this.status !== "pending")
    throw new Error("Can only withdraw pending clearance requests");
  await this.update({
    status: "withdrawn",
    withdrawnAt: new Date(),
    withdrawalReason: reason,
  });
};

module.exports = LoanClearance;
