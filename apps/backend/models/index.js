/**
 * models/index.js
 *
 * Central registry for all Sequelize models.
 * Import from here in routes / middleware / services:
 *
 *   const { User, Loan, Payment, ... } = require('../models');
 *
 * Schemas (PostgreSQL namespaces):
 *   cedi_auth        → Role, User, Admin
 *   cedi_loans       → LoanLevel, LoanTerm, Loan, LoanClearance
 *   cedi_payments    → Payment
 *   cedi_notifications → Notification
 *   cedi_config      → AppConfig, Content
 */

// ── Auth namespace ────────────────────────────────────────────────────────────
const Role = require("./auth/Role");
const User = require("./auth/User");
const Admin = require("./auth/Admin");
const AppUsageLog = require("./auth/AppUsageLog");

// ── Loans namespace ───────────────────────────────────────────────────────────
const LoanLevel = require("./loans/LoanLevel");
const LoanTerm = require("./loans/LoanTerm");
const Loan = require("./loans/Loan");
const LoanClearance = require("./loans/LoanClearance");

// ── Payments namespace ────────────────────────────────────────────────────────
const Payment = require("./payments/Payment");

// ── Notifications namespace ───────────────────────────────────────────────────
const Notification = require("./notifications/Notification");

// ── Config namespace ──────────────────────────────────────────────────────────
const AppConfig = require("./config/AppConfig");
const Content = require("./config/Content");

// ── Associations ──────────────────────────────────────────────────────────────
// Called once from config/database.js after all schemas are created.
function initAssociations() {
  // Admin → Role  (many-to-one)
  Admin.belongsTo(Role, { foreignKey: "roleId", as: "Role" });
  Role.hasMany(Admin, { foreignKey: "roleId", as: "Admins" });

  // Admin → Admin  (self-referencing audit trail)
  Admin.belongsTo(Admin, { foreignKey: "createdById", as: "CreatedBy" });
  Admin.belongsTo(Admin, {
    foreignKey: "lastModifiedById",
    as: "LastModifiedBy",
  });

  // Loan → User
  Loan.belongsTo(User, { foreignKey: "userId", as: "User" });
  User.hasMany(Loan, { foreignKey: "userId", as: "Loans" });

  // Loan → Admin (assigned officer, reviewer, pre-collection, collection)
  Loan.belongsTo(Admin, {
    foreignKey: "assignedOfficerId",
    as: "AssignedOfficer",
  });
  Loan.belongsTo(Admin, { foreignKey: "reviewedById", as: "ReviewedBy" });
  Loan.belongsTo(Admin, {
    foreignKey: "precollectionOfficerId",
    as: "PrecollectionOfficer",
  });
  Loan.belongsTo(Admin, {
    foreignKey: "collectionOfficerId",
    as: "CollectionOfficer",
  });

  // Payment → User & Loan
  Payment.belongsTo(User, { foreignKey: "userId", as: "User" });
  Payment.belongsTo(Loan, { foreignKey: "loanId", as: "Loan" });
  User.hasMany(Payment, { foreignKey: "userId", as: "Payments" });
  Loan.hasMany(Payment, { foreignKey: "loanId", as: "Payments" });

  // LoanClearance → User, Loan, Admin
  LoanClearance.belongsTo(User, { foreignKey: "userId", as: "User" });
  LoanClearance.belongsTo(Loan, { foreignKey: "loanId", as: "Loan" });
  LoanClearance.belongsTo(Admin, {
    foreignKey: "submittedById",
    as: "SubmittedBy",
  });
  LoanClearance.belongsTo(Admin, {
    foreignKey: "reviewedById",
    as: "ReviewedBy",
  });

  // Notification → User, Admin
  Notification.belongsTo(User, {
    foreignKey: "recipientUserId",
    as: "RecipientUser",
  });
  Notification.belongsTo(Admin, {
    foreignKey: "recipientAdminId",
    as: "RecipientAdmin",
  });
  Notification.belongsTo(Admin, { foreignKey: "createdById", as: "CreatedBy" });

  // AppConfig → Admin (updatedBy)
  AppConfig.belongsTo(Admin, { foreignKey: "updatedById", as: "UpdatedBy" });

  // Content → User/Admin (updatedBy stored as UUID; use User or Admin depending on context)
  Content.belongsTo(Admin, { foreignKey: "updatedById", as: "UpdatedBy" });

  // LoanLevel / LoanTerm audit FKs
  LoanLevel.belongsTo(Admin, { foreignKey: "createdById", as: "CreatedBy" });
  LoanLevel.belongsTo(Admin, {
    foreignKey: "lastUpdatedById",
    as: "LastUpdatedBy",
  });

  // AppUsageLog → Admin
  AppUsageLog.belongsTo(Admin, { foreignKey: "adminId", as: "Admin" });
  Admin.hasMany(AppUsageLog, { foreignKey: "adminId", as: "UsageLogs" });
}

module.exports = {
  // Auth
  Role,
  User,
  Admin,
  AppUsageLog,
  // Loans
  LoanLevel,
  LoanTerm,
  Loan,
  LoanClearance,
  // Payments
  Payment,
  // Notifications
  Notification,
  // Config
  AppConfig,
  Content,
  // Setup function
  initAssociations,
};
