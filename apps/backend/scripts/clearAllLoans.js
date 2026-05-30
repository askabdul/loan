require('dotenv').config();

const connectDB = require('../config/database');
const { sequelize } = require('../config/database');
const { Loan, Payment, LoanClearance, Notification, User, Admin } = require('../models');

async function clearAllLoans() {
  const force = process.argv.includes('--force') || process.env.CLEAR_LOANS_FORCE === 'true';

  if (!force) {
    console.error('Refusing to run destructive reset without confirmation flag.');
    console.error('Run with: node scripts/clearAllLoans.js --force');
    process.exit(1);
  }

  await connectDB();

  const tx = await sequelize.transaction();
  try {
    const loanCount = await Loan.count({ transaction: tx });
    const paymentCount = await Payment.count({ transaction: tx });
    const clearanceCount = await LoanClearance.count({ transaction: tx });

    await LoanClearance.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
    await Payment.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });
    await Loan.destroy({ where: {}, truncate: true, cascade: true, transaction: tx });

    await Notification.destroy({
      where: {
        type: ['loan_status', 'payment'],
      },
      transaction: tx,
    });

    await User.update(
      {
        currentLoanLevel: 1,
        totalLoansCompleted: 0,
        totalAmountRepaid: 0,
        totalAmountBorrowed: 0,
        levelProgressionHistory: [],
      },
      { where: {}, transaction: tx },
    );

    await Admin.update(
      {
        assignments: {},
      },
      { where: {}, transaction: tx },
    );

    await tx.commit();

    console.log('✅ Loan data reset completed.');
    console.log(`   Loans removed: ${loanCount}`);
    console.log(`   Payments removed: ${paymentCount}`);
    console.log(`   Loan clearances removed: ${clearanceCount}`);
    console.log('   User loan stats reset to defaults.');
    console.log('   Officer assignment snapshots cleared.');
  } catch (error) {
    await tx.rollback();
    console.error('❌ Failed to clear loan data:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

clearAllLoans();
