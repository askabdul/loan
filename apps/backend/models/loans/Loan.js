const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Loan = sequelize.define(
  "Loan",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Auto-generated 6-digit display ID
    loanId: {
      type: DataTypes.STRING(6),
      unique: true,
      validate: { is: /^\d{6}$/ },
    },
    // ── FKs (set in associations) ────────────────────────────────────
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // ── Loan Details ─────────────────────────────────────────────────
    loanLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: { min: 100, max: 50000 },
    },
    purpose: {
      type: DataTypes.ENUM(
        "business",
        "education",
        "medical",
        "home-improvement",
        "debt-consolidation",
        "emergency",
        "other",
      ),
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 24 },
    },
    termInDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 730 },
    },
    // ── Financial Rates ──────────────────────────────────────────────
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 2,
    },
    serviceFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 1,
    },
    administrationFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.5,
    },
    commitmentFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.5,
    },
    // ── Calculated Amounts ───────────────────────────────────────────
    totalInterest: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    serviceFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    administrationFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    commitmentFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    monthlyPayment: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    // ── Auto-approval ────────────────────────────────────────────────
    isAutoApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    autoApprovalReason: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    // ── Status ───────────────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM(
        "pending",
        "under-review",
        "approved",
        "rejected",
        "hanged-up",
        "disbursed",
        "active",
        "completed",
        "defaulted",
        "cancelled",
        "overdue",
      ),
      defaultValue: "pending",
    },
    assignmentStatus: {
      type: DataTypes.ENUM("unassigned", "assigned", "hung-up", "hung-down"),
      defaultValue: "unassigned",
    },
    collectionStatus: {
      type: DataTypes.ENUM(
        "pending-assignment",
        "assigned",
        "processed",
        "hung-up",
        "hung-down",
        "completed",
      ),
      defaultValue: "pending-assignment",
    },
    precollectionStatus: {
      type: DataTypes.ENUM(
        "pending-assignment",
        "assigned",
        "processed",
        "hung-up",
        "hung-down",
        "completed",
      ),
      defaultValue: "pending-assignment",
    },
    // ── Important Dates ──────────────────────────────────────────────
    applicationDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    approvalDate: DataTypes.DATE,
    disbursementDate: DataTypes.DATE,
    dueDate: DataTypes.DATE,
    completionDate: DataTypes.DATE,
    // ── Repayment Tracking ───────────────────────────────────────────
    remainingBalance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    totalPaid: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    lastPaymentDate: DataTypes.DATE,
    nextPaymentDate: DataTypes.DATE,
    // ── Overdue Information ──────────────────────────────────────────
    isOverdue: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    overdueAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    overdueDays: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    overdueFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 2,
    },
    totalOverdueFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    // ── Extension Fields ─────────────────────────────────────────────
    extensionDays: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    extensionFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    extensionPopUrl: DataTypes.STRING,
    extendedDueDate: DataTypes.DATE,
    extensionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastExtensionDate: DataTypes.DATE,
    // ── Notes & Remarks (stored as JSONB arrays) ──────────────────────
    adminNotes: {
      type: DataTypes.JSONB,
      defaultValue: [], // [{ note, addedBy, addedAt }]
    },
    // Contact notes logged by credit-review / collection / pre-collection officers
    contactNotes: {
      type: DataTypes.JSONB,
      defaultValue: [], // [{ note, addedBy, addedAt, outcome }]
    },
    precollectionRemarks: {
      type: DataTypes.JSONB,
      defaultValue: [], // [{ remark, addedBy, addedAt, callOutcome }]
    },
    collectionRemarks: {
      type: DataTypes.JSONB,
      defaultValue: [], // [{ remark, addedBy, addedAt, callOutcome }]
    },
    rejectionReason: DataTypes.TEXT,
    // ── Pre-collection / Collection Reserve ─────────────────────────
    // Set when an officer "hangs up" / reserves a case for up to 10 days
    reservedAt: DataTypes.DATE,
    reservedByOfficerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // ── Extension Workflow ────────────────────────────────────────────
    // extensionStatus tracks the lifecycle of a single extension request
    extensionStatus: {
      type: DataTypes.ENUM("none", "pending", "approved", "rejected"),
      defaultValue: "none",
    },
    extensionReason: DataTypes.TEXT,
    extensionRequestDate: DataTypes.DATE,
    extensionApprovedDate: DataTypes.DATE,
    extensionRejectionReason: DataTypes.TEXT,
    extensionRejectedDate: DataTypes.DATE,
    // ── Assignment / Review FKs ──────────────────────────────────────
    assignedOfficerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    assignmentDate: DataTypes.DATE,
    reviewedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewDate: DataTypes.DATE,
    reviewRemarks: DataTypes.TEXT,
    precollectionOfficerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    precollectionAssignmentDate: DataTypes.DATE,
    collectionOfficerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    collectionAssignmentDate: DataTypes.DATE,
    // ── Terms Acceptance ─────────────────────────────────────────────
    termsAccepted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    termsAcceptedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "cedi_loans",
    tableName: "loans",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["user_id", "status"] },
      { fields: ["status", "created_at"] },
      { fields: ["due_date", "status"] },
      { fields: ["loan_id"] },
      { fields: ["is_overdue", "status"] },
      { fields: ["loan_level", "status"] },
    ],
    hooks: {
      beforeCreate: async (loan) => {
        // Generate unique 6-digit loanId
        if (!loan.loanId) {
          let unique = false;
          while (!unique) {
            const candidate = String(
              Math.floor(100000 + Math.random() * 900000),
            );
            const exists = await Loan.findOne({ where: { loanId: candidate } });
            if (!exists) {
              loan.loanId = candidate;
              unique = true;
            }
          }
        }
        // Pre-calculate amounts
        Loan._calculateAmounts(loan);
      },
      beforeUpdate: (loan) => {
        if (
          loan.changed("amount") ||
          loan.changed("duration") ||
          loan.changed("interestRate")
        ) {
          Loan._calculateAmounts(loan);
        }
      },
    },
  },
);

// ── Internal calculation helper ───────────────────────────────────────────────
Loan._calculateAmounts = (loan) => {
  const amt = parseFloat(loan.amount) || 0;
  const dur = parseInt(loan.duration) || 1;
  const rate = parseFloat(loan.interestRate) || 0;
  const svcPct = parseFloat(loan.serviceFeePct) || 0;
  const admPct = parseFloat(loan.administrationFeePct) || 0;
  const comPct = parseFloat(loan.commitmentFeePct) || 0;

  loan.serviceFee = Math.round(((amt * svcPct) / 100) * 100) / 100;
  loan.administrationFee = Math.round(((amt * admPct) / 100) * 100) / 100;
  loan.commitmentFee = Math.round(((amt * comPct) / 100) * 100) / 100;
  loan.totalInterest = Math.round(((amt * rate * dur) / 100) * 100) / 100;
  loan.totalAmount =
    Math.round(
      (amt +
        loan.totalInterest +
        loan.serviceFee +
        loan.administrationFee +
        loan.commitmentFee) *
        100,
    ) / 100;
  loan.monthlyPayment =
    dur > 0 ? Math.round((loan.totalAmount / dur) * 100) / 100 : 0;

  if (!loan.remainingBalance && loan.status === "approved") {
    loan.remainingBalance = loan.totalAmount;
  }
};

// ── Instance Methods ──────────────────────────────────────────────────────────
Loan.prototype.getReferenceNumber = function () {
  return `CEDI-${this.id.toString().slice(-8).toUpperCase()}`;
};

Loan.prototype.updateOverdueStatus = function () {
  if (
    this.status === "active" &&
    this.nextPaymentDate &&
    new Date() > this.nextPaymentDate
  ) {
    this.isOverdue = true;
    this.overdueDays = Math.floor(
      (new Date() - new Date(this.nextPaymentDate)) / (1000 * 60 * 60 * 24),
    );
    const daily =
      (parseFloat(this.remainingBalance) * parseFloat(this.overdueFeePct)) /
      100;
    this.totalOverdueFee = Math.round(daily * this.overdueDays * 100) / 100;
  }
};

Loan.prototype.canExtend = function () {
  return this.status === "active";
};

Loan.prototype.calculateExtensionFee = function () {
  const totalRate =
    (parseFloat(this.interestRate) +
      parseFloat(this.serviceFeePct) +
      parseFloat(this.administrationFeePct) +
      parseFloat(this.commitmentFeePct)) /
    100;
  return parseFloat(this.amount) * totalRate;
};

module.exports = Loan;
