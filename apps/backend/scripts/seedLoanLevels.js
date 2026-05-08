/**
 * scripts/seedLoanLevels.js — Sequelize version
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { LoanLevel } = require('../models');

const loanLevels = [
  {
    level: 1, name: 'Starter', description: 'Entry level for new borrowers',
    minAmount: 50, maxAmount: 100, interestRate: 15, processingFeeRate: 5, insuranceFeeRate: 2,
    availableTerms: [7], minDuration: 7, maxDuration: 30,
    requiresFullRepayment: true, minimumLoansCompleted: 0,
    autoApproval: { enabled: false, maxAmount: 0, conditions: { minCompletedLoans: 0, minRepaymentRate: 100 } },
    isActive: true,
  },
  {
    level: 2, name: 'Bronze', description: 'For borrowers who completed their first loan',
    minAmount: 100, maxAmount: 200, interestRate: 12, processingFeeRate: 4, insuranceFeeRate: 2,
    availableTerms: [7, 14], minDuration: 7, maxDuration: 45,
    requiresFullRepayment: true, minimumLoansCompleted: 1,
    autoApproval: { enabled: true, maxAmount: 150, conditions: { minCompletedLoans: 1, minRepaymentRate: 100 } },
    isActive: true,
  },
  {
    level: 3, name: 'Silver', description: 'Experienced borrowers with good history',
    minAmount: 200, maxAmount: 500, interestRate: 10, processingFeeRate: 3, insuranceFeeRate: 1.5,
    availableTerms: [7, 14, 30], minDuration: 14, maxDuration: 60,
    requiresFullRepayment: true, minimumLoansCompleted: 3,
    autoApproval: { enabled: true, maxAmount: 300, conditions: { minCompletedLoans: 2, minRepaymentRate: 95 } },
    isActive: true,
  },
  {
    level: 4, name: 'Gold', description: 'Premium level for trusted borrowers',
    minAmount: 500, maxAmount: 1000, interestRate: 8, processingFeeRate: 2, insuranceFeeRate: 1,
    availableTerms: [14, 30, 60, 90], minDuration: 30, maxDuration: 90,
    requiresFullRepayment: true, minimumLoansCompleted: 5,
    autoApproval: { enabled: true, maxAmount: 750, conditions: { minCompletedLoans: 4, minRepaymentRate: 95 } },
    isActive: true,
  },
  {
    level: 5, name: 'Platinum', description: 'Highest level for VIP borrowers',
    minAmount: 1000, maxAmount: 2000, interestRate: 6, processingFeeRate: 1.5, insuranceFeeRate: 0.5,
    availableTerms: [30, 60, 90, 120, 180], minDuration: 30, maxDuration: 120,
    requiresFullRepayment: true, minimumLoansCompleted: 10,
    autoApproval: { enabled: true, maxAmount: 1500, conditions: { minCompletedLoans: 8, minRepaymentRate: 98 } },
    isActive: true,
  },
];

async function seedLoanLevels() {
  await connectDB();
  console.log('Seeding loan levels...');

  for (const data of loanLevels) {
    const [, created] = await LoanLevel.upsert(data);
    console.log(`${created ? 'Created' : 'Updated'} level ${data.level}: ${data.name}`);
  }

  console.log('✅ Loan levels seeded.');
  process.exit(0);
}

seedLoanLevels().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
