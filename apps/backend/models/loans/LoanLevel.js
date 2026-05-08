const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const LoanLevel = sequelize.define(
  "LoanLevel",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: { min: 1 },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: DataTypes.TEXT,
    // ── Loan Limits ─────────────────────────────────────────────────
    maxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    minAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    // ── Progression Requirements ─────────────────────────────────────
    requiresFullRepayment: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    minimumLoansCompleted: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: { min: 0 },
    },
    // ── Rate Configuration ───────────────────────────────────────────
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: { min: 0, max: 50 },
    },
    serviceFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 1,
      validate: { min: 0, max: 5 },
    },
    administrationFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.5,
      validate: { min: 0, max: 2 },
    },
    commitmentFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.5,
      validate: { min: 0, max: 2 },
    },
    processingFeeRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },
    insuranceFeeRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },
    // ── Available Terms ──────────────────────────────────────────────
    // PostgreSQL integer array, e.g. [7, 14, 30]
    availableTerms: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      defaultValue: [7, 14, 30],
    },
    minDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: { min: 1 },
    },
    maxDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      validate: { min: 1 },
    },
    // ── Auto-approval ────────────────────────────────────────────────
    // { enabled: bool, maxAmount: number, conditions: { minCompletedLoans, minRepaymentRate } }
    autoApproval: {
      type: DataTypes.JSONB,
      defaultValue: {
        enabled: false,
        maxAmount: 0,
        conditions: { minCompletedLoans: 0, minRepaymentRate: 100 },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // ── Audit FKs ────────────────────────────────────────────────────
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    lastUpdatedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "cedi_loans",
    tableName: "loan_levels",
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ["level"] }, { fields: ["is_active"] }],
  },
);

// ── Static helpers ────────────────────────────────────────────────────────────
LoanLevel.getLevelByNumber = function (levelNumber) {
  return LoanLevel.findOne({ where: { level: levelNumber, isActive: true } });
};

LoanLevel.getNextLevel = function (currentLevelNumber) {
  return LoanLevel.findOne({
    where: { level: currentLevelNumber + 1, isActive: true },
  });
};

module.exports = LoanLevel;
