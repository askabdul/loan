/**
 * scripts/seedLoanLevels.js
 *
 * Business rules (confirmed):
 *   - All loans are 7-day flat terms (admin can add more via LoanConfiguration)
 *   - Total fee = 45% of principal:
 *       Interest 9% + Service 12% + Admin 12% + Commitment 12% = 45%
 *   - Upfront deduction = 20% of principal
 *   - Customer RECEIVES: principal × 80%  (e.g. GHS 100 → receives GHS 80)
 *   - Customer REPAYS: total obligation - upfront deduction
 *       e.g. GHS 100 + GHS 45 - GHS 20 = GHS 125
 *   - Overdue: 2% simple daily on remaining unpaid balance
 *   - No loan extensions (disabled via AppConfig enable_extension=false)
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { LoanLevel } = require('../models');

// Fee rates are identical across all levels — rates change only if admin edits them
const FEE_RATES = {
  interestRate: 9,           // % of principal
  serviceFeePct: 12,         // % of principal
  administrationFeePct: 12,  // % of principal
  commitmentFeePct: 12,      // % of principal
  // Total fees = 45%; separate upfront deduction defaults to 20%.
};

const loanLevels = [
  {
    level: 1,
    name: 'Level 1',
    description: 'Entry level — fixed GHS 100',
    minAmount: 100,
    maxAmount: 100,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 0,
    autoApproval: { enabled: false, maxAmount: 0, conditions: { minCompletedLoans: 0, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 2,
    name: 'Level 2',
    description: 'After 1 completed loan',
    minAmount: 100,
    maxAmount: 200,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 1,
    autoApproval: { enabled: true, maxAmount: 150, conditions: { minCompletedLoans: 1, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 3,
    name: 'Level 3',
    description: 'After 2 completed loans',
    minAmount: 150,
    maxAmount: 250,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 2,
    autoApproval: { enabled: true, maxAmount: 200, conditions: { minCompletedLoans: 2, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 4,
    name: 'Level 4',
    description: 'After 3 completed loans',
    minAmount: 200,
    maxAmount: 300,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 3,
    autoApproval: { enabled: true, maxAmount: 250, conditions: { minCompletedLoans: 3, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 5,
    name: 'Level 5',
    description: 'After 4 completed loans',
    minAmount: 200,
    maxAmount: 400,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 4,
    autoApproval: { enabled: true, maxAmount: 300, conditions: { minCompletedLoans: 4, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 6,
    name: 'Level 6',
    description: 'After 5 completed loans',
    minAmount: 300,
    maxAmount: 450,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 5,
    autoApproval: { enabled: true, maxAmount: 380, conditions: { minCompletedLoans: 5, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
  {
    level: 7,
    name: 'Level 7',
    description: 'After 6 completed loans — top tier',
    minAmount: 400,
    maxAmount: 500,
    availableTerms: [7],
    minDuration: 7,
    maxDuration: 7,
    requiresFullRepayment: true,
    minimumLoansCompleted: 6,
    autoApproval: { enabled: true, maxAmount: 450, conditions: { minCompletedLoans: 6, minRepaymentRate: 100 } },
    isActive: true,
    ...FEE_RATES,
  },
];

async function seedLoanLevels() {
  await connectDB();
  console.log('Seeding loan levels…');
  for (const data of loanLevels) {
    const [, created] = await LoanLevel.upsert(data);
    const tag = created ? 'Created' : 'Updated';
    console.log(`${tag} Level ${data.level}: ${data.name}  GHS ${data.minAmount}–${data.maxAmount}`);
  }
  console.log('✅ Loan levels seeded (7-day flat, 45% total fee + 20% upfront deduction).');
  process.exit(0);
}

seedLoanLevels().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
