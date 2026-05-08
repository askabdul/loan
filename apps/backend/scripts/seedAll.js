/**
 * scripts/seedAll.js
 *
 * Runs all seed scripts in the correct order.
 * Usage: node scripts/seedAll.js
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { Role, Admin, LoanLevel, AppConfig, Content } = require('../models');

// ── Role data (inline — mirrors seedRoles.js) ─────────────────────────────────
const defaultRoles = [
  { name: 'super-admin',          displayName: 'Super Administrator',    hierarchy: 1, isActive: true, permissions: { menus: { dashboard: true }, dataAccess: { viewAllLoans: true, viewAllUsers: true }, actions: { createAdmin: true, deleteAdmin: true, manageRoles: true, systemConfig: true, approveLoan: true, rejectLoan: true } } },
  { name: 'admin',                displayName: 'Administrator',          hierarchy: 2, isActive: true, permissions: { menus: { dashboard: true, creditReview: true }, dataAccess: { viewAllLoans: true, approveLoans: true }, actions: { approveLoan: true, rejectLoan: true } } },
  { name: 'local-manager',        displayName: 'Local Manager',          hierarchy: 3, isActive: true, permissions: { menus: { dashboard: true }, dataAccess: { viewAllLoans: true }, actions: {} } },
  { name: 'review-lead',          displayName: 'Review Lead',            hierarchy: 4, isActive: true, permissions: { menus: { creditReview: true }, dataAccess: { viewAllLoans: true, approveLoans: true }, actions: { approveLoan: true, rejectLoan: true, assignLoan: true } } },
  { name: 'review-officer',       displayName: 'Review Officer',         hierarchy: 5, isActive: true, permissions: { menus: { creditReview: true }, dataAccess: { viewAssignedLoans: true }, actions: {} } },
  { name: 'collection-lead',      displayName: 'Collection Lead',        hierarchy: 6, isActive: true, permissions: { menus: { collection: true }, dataAccess: { viewAllLoans: true }, actions: { assignLoan: true } } },
  { name: 'collection-officer',   displayName: 'Collection Officer',     hierarchy: 7, isActive: true, permissions: { menus: { collection: true }, dataAccess: { viewAssignedLoans: true }, actions: {} } },
  { name: 'precollection-lead',   displayName: 'Pre-Collection Lead',    hierarchy: 8, isActive: true, permissions: { menus: { precollection: true }, dataAccess: { viewAllLoans: true }, actions: {} } },
  { name: 'precollection-officer',displayName: 'Pre-Collection Officer', hierarchy: 9, isActive: true, permissions: { menus: { precollection: true }, dataAccess: { viewAssignedLoans: true }, actions: {} } },
  { name: 'customer-service',     displayName: 'Customer Service',       hierarchy: 10, isActive: true, permissions: { menus: { dashboard: true }, dataAccess: { viewAllUsers: true }, actions: {} } },
];

const loanLevels = [
  { level: 1, name: 'Starter',  minAmount: 50,   maxAmount: 100,  interestRate: 15, processingFeeRate: 5,   insuranceFeeRate: 2,   availableTerms: [7],               minimumLoansCompleted: 0,  autoApproval: { enabled: false, maxAmount: 0,    conditions: { minCompletedLoans: 0, minRepaymentRate: 100 } }, isActive: true },
  { level: 2, name: 'Bronze',   minAmount: 100,  maxAmount: 200,  interestRate: 12, processingFeeRate: 4,   insuranceFeeRate: 2,   availableTerms: [7, 14],           minimumLoansCompleted: 1,  autoApproval: { enabled: true,  maxAmount: 150,  conditions: { minCompletedLoans: 1, minRepaymentRate: 100 } }, isActive: true },
  { level: 3, name: 'Silver',   minAmount: 200,  maxAmount: 500,  interestRate: 10, processingFeeRate: 3,   insuranceFeeRate: 1.5, availableTerms: [7, 14, 30],       minimumLoansCompleted: 3,  autoApproval: { enabled: true,  maxAmount: 300,  conditions: { minCompletedLoans: 2, minRepaymentRate: 95  } }, isActive: true },
  { level: 4, name: 'Gold',     minAmount: 500,  maxAmount: 1000, interestRate: 8,  processingFeeRate: 2,   insuranceFeeRate: 1,   availableTerms: [14, 30, 60, 90],  minimumLoansCompleted: 5,  autoApproval: { enabled: true,  maxAmount: 750,  conditions: { minCompletedLoans: 4, minRepaymentRate: 95  } }, isActive: true },
  { level: 5, name: 'Platinum', minAmount: 1000, maxAmount: 2000, interestRate: 6,  processingFeeRate: 1.5, insuranceFeeRate: 0.5, availableTerms: [30,60,90,120,180],minimumLoansCompleted: 10, autoApproval: { enabled: true,  maxAmount: 1500, conditions: { minCompletedLoans: 8, minRepaymentRate: 98  } }, isActive: true },
];

const defaultConfigs = [
  { key: 'app_name',           value: 'CEDI Loan',                  category: 'general',   isPublic: true  },
  { key: 'app_tagline',        value: 'Fast & Reliable Loans',       category: 'general',   isPublic: true  },
  { key: 'company_name',       value: 'CEDI Financial Services',     category: 'general',   isPublic: true  },
  { key: 'support_email',      value: 'support@cedi.com',            category: 'contact',   isPublic: true  },
  { key: 'support_phone',      value: '+233000000000',               category: 'contact',   isPublic: true  },
  { key: 'min_loan_amount',    value: 50,                            category: 'loans',     isPublic: false },
  { key: 'max_loan_amount',    value: 2000,                          category: 'loans',     isPublic: false },
  { key: 'maintenance_mode',   value: false,                         category: 'system',    isPublic: false },
  { key: 'enable_notifications', value: true,                        category: 'system',    isPublic: false },
  { key: 'max_login_attempts', value: 5,                             category: 'security',  isPublic: false },
  { key: 'lockout_duration',   value: 30,                            category: 'security',  isPublic: false },
];

async function run() {
  console.log('🌱 Starting full database seed...\n');
  await connectDB();

  // 1. Roles
  console.log('--- Seeding roles ---');
  for (const r of defaultRoles) {
    await Role.upsert(r);
    console.log(`  ✔ ${r.displayName}`);
  }

  // 2. Super admin
  console.log('\n--- Seeding super admin ---');
  const superRole = await Role.findOne({ where: { name: 'super-admin' } });
  await Admin.findOrCreate({
    where: { email: 'superadmin@cedi.com' },
    defaults: {
      firstName: 'Super', lastName: 'Administrator', username: 'superadmin',
      email: 'superadmin@cedi.com', phoneNumber: '+233000000000',
      password: 'SuperAdmin123!', roleId: superRole.id,
      isActive: true, emailVerified: true, phoneVerified: true,
    },
  });
  console.log('  ✔ superadmin@cedi.com');

  // 3. Loan levels
  console.log('\n--- Seeding loan levels ---');
  for (const l of loanLevels) {
    await LoanLevel.upsert(l);
    console.log(`  ✔ Level ${l.level}: ${l.name}`);
  }

  // 4. App config
  console.log('\n--- Seeding app config ---');
  for (const c of defaultConfigs) {
    await AppConfig.upsert({ ...c, isActive: true });
    console.log(`  ✔ ${c.key}`);
  }

  console.log('\n✅ All seeds complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
