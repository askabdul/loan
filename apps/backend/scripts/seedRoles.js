/**
 * scripts/seedRoles.js — Sequelize version
 *
 * Seeds the default admin roles into the cedi_auth.roles table.
 * Safe to run multiple times (upsert by name).
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { Role } = require('../models');

const defaultRoles = [
  {
    name: 'super-admin',
    displayName: 'Super Administrator',
    description: 'Full system access with all permissions',
    hierarchy: 1,
    isActive: true,
    permissions: {
      menus: {
        dashboard: true, user: true, marketing: true, notificationManagement: true,
        roleManagement: true, order: true, fundManagement: true, creditReview: true,
        preCollection: true, collection: true, overtimeMessage: true, config: true,
        dataStatistics: true, system: true, userManagement: true,
        contentManagement: true, systemConfig: true, reports: true,
        adminManagement: true, loanManagement: true,
      },
      subMenus: {
        user: { list: true, find: true, listOfUsers: true, findOne: true },
        creditReview: { list: true, approve: true, reject: true, assign: true, shiftList: true, count: true },
        preCollection: { list: true, remind: true, escalate: true, shiftList: true, assign: true, repayment: true, monitorCenter: true },
        collection: { list: true, contact: true, schedule: true, reports: true, shiftList: true, assign: true, repayment: true, monitorCenter: true },
        userManagement: { list: true, create: true, edit: true, block: true },
      },
      dataAccess: {
        viewAllLoans: true, viewAssignedLoans: true, viewAllUsers: true,
        editUserData: true, approveLoans: true, rejectLoans: true, assignLoans: true,
        exportData: true, viewPayments: true, editPayments: true,
        viewReports: true, viewStatistics: true, viewNotifications: true,
        editNotifications: true, viewConfig: true, editConfig: true,
        viewAllReports: true, viewFinancialData: true, viewSystemLogs: true,
        viewAuditTrail: true, manageSystemConfig: true, manageUserRoles: true,
        'users.personalInfo': true, 'users.phone': true, 'users.financialInfo': true,
        'users.loanHistory': true, 'users.workInfo': true,
        'loans.basic': true, 'loans.amount': true, 'loans.terms': true, 'loans.history': true, 'loans.documents': true,
        'payments.amount': true, 'payments.provider': true, 'payments.details': true,
      },
      actions: {
        createAdmin: true, editAdmin: true, deleteAdmin: true, manageRoles: true,
        systemConfig: true, createUser: true, editUser: true, deleteUser: true,
        blockUser: true, unblockUser: true, approveLoan: true, rejectLoan: true,
        assignLoan: true, processPayment: true, refundPayment: true,
        sendNotification: true, editNotification: true, deleteNotification: true,
        exportReports: true, viewAuditLogs: true, manageSystem: true,
        createRole: true, editRole: true, deleteRole: true, reassignLoan: true,
        createLoan: true, editLoan: true, deleteLoan: true,
      },
    },
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Administrative access without system config',
    hierarchy: 2,
    isActive: true,
    permissions: {
      menus: { dashboard: true, creditReview: true, collection: true, precollection: true, userManagement: true, reports: true },
      subMenus: {
        creditReview: { list: true, approve: true, reject: true, assign: true },
        collection: { list: true, contact: true, schedule: true, reports: true },
        userManagement: { list: true, create: true, edit: true, block: true },
      },
      dataAccess: { viewAllLoans: true, viewAssignedLoans: true, viewAllUsers: true, editUserData: true, approveLoans: true, rejectLoans: true, assignLoans: true, exportData: true },
      actions: { createAdmin: true, editAdmin: true, deleteAdmin: false, manageRoles: false, systemConfig: false },
    },
  },
  {
    name: 'local-manager',
    displayName: 'Local Manager',
    description: 'Regional management with oversight',
    hierarchy: 3,
    isActive: true,
    permissions: {
      menus: { dashboard: true, creditReview: true, collection: true, precollection: true, userManagement: true, reports: true },
      subMenus: {
        creditReview: { list: true, approve: true, reject: true, assign: true },
        collection: { list: true, schedule: true, reports: true },
        userManagement: { list: true, edit: true, block: true },
      },
      dataAccess: { viewAllLoans: true, viewAssignedLoans: true, viewAllUsers: true, editUserData: false, approveLoans: true, rejectLoans: true, assignLoans: true, exportData: true },
      actions: { createAdmin: false, editAdmin: false, deleteAdmin: false, manageRoles: false, systemConfig: false },
    },
  },
  {
    name: 'review-lead',
    displayName: 'Review Lead',
    description: 'Credit review team leader',
    hierarchy: 4,
    isActive: true,
    permissions: {
      menus: { dashboard: true, creditReview: true, reports: true },
      subMenus: { creditReview: { list: true, approve: true, reject: true, assign: true } },
      dataAccess: { viewAllLoans: true, viewAssignedLoans: true, approveLoans: true, rejectLoans: true, assignLoans: true, exportData: true },
      actions: { approveLoan: true, rejectLoan: true, assignLoan: true },
    },
  },
  {
    name: 'review-officer',
    displayName: 'Review Officer',
    description: 'Credit review officer — limited access',
    hierarchy: 5,
    isActive: true,
    permissions: {
      menus: { creditReview: true },
      subMenus: { creditReview: { list: true } },
      dataAccess: { viewAssignedLoans: true },
      actions: {},
    },
  },
  {
    name: 'collection-lead',
    displayName: 'Collection Lead',
    description: 'Collection team leader',
    hierarchy: 6,
    isActive: true,
    permissions: {
      menus: { dashboard: true, collection: true, reports: true },
      subMenus: { collection: { list: true, contact: true, schedule: true, reports: true } },
      dataAccess: { viewAllLoans: true, viewAssignedLoans: true, exportData: true },
      actions: { assignLoan: true },
    },
  },
  {
    name: 'collection-officer',
    displayName: 'Collection Officer',
    description: 'Collection officer — assigned cases only',
    hierarchy: 7,
    isActive: true,
    permissions: {
      menus: { collection: true },
      subMenus: { collection: { list: true, contact: true } },
      dataAccess: { viewAssignedLoans: true },
      actions: {},
    },
  },
  {
    name: 'precollection-lead',
    displayName: 'Pre-Collection Lead',
    description: 'Pre-collection team leader',
    hierarchy: 8,
    isActive: true,
    permissions: {
      menus: { dashboard: true, precollection: true, reports: true },
      subMenus: { precollection: { list: true, remind: true, escalate: true } },
      dataAccess: { viewAllLoans: true, viewAssignedLoans: true, exportData: true },
      actions: {},
    },
  },
  {
    name: 'precollection-officer',
    displayName: 'Pre-Collection Officer',
    description: 'Pre-collection officer with reminder capabilities',
    hierarchy: 9,
    isActive: true,
    permissions: {
      menus: { precollection: true },
      subMenus: { precollection: { list: true, remind: true } },
      dataAccess: { viewAssignedLoans: true },
      actions: {},
    },
  },
  {
    name: 'customer-service',
    displayName: 'Customer Service',
    description: 'Customer service representative',
    hierarchy: 10,
    isActive: true,
    permissions: {
      menus: { dashboard: true, userManagement: true },
      subMenus: { userManagement: { list: true } },
      dataAccess: { viewAllUsers: true },
      actions: {},
    },
  },
];

async function seedRoles() {
  await connectDB();
  console.log('Seeding roles...');

  for (const roleData of defaultRoles) {
    const [, created] = await Role.upsert(roleData);
    console.log(`${created ? 'Created' : 'Updated'} role: ${roleData.displayName}`);
  }

  console.log('✅ Role seeding complete.');
  process.exit(0);
}

seedRoles().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
