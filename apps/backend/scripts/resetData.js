/**
 * resetData.js
 * Wipes all transactional data (loans, payments, notifications, app_usage_logs)
 * while preserving: roles, admins, users, loan_levels, loan_terms, app_configs, content.
 * Run from backend/: node scripts/resetData.js
 */

require("dotenv").config();
const { sequelize } = require("../config/database");
const {
  LoanClearance,
  Loan,
  Payment,
  Notification,
  AppUsageLog,
} = require("../models");

async function reset() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected\n");

    await sequelize.transaction(async (t) => {
      const opts = { where: {}, truncate: true, cascade: true, transaction: t };

      const lc = await LoanClearance.destroy({ where: {}, transaction: t });
      console.log(`🗑  loan_clearances:  ${lc} rows deleted`);

      const p = await Payment.destroy({ where: {}, transaction: t });
      console.log(`🗑  payments:         ${p} rows deleted`);

      const n = await Notification.destroy({ where: {}, transaction: t });
      console.log(`🗑  notifications:    ${n} rows deleted`);

      const al = await AppUsageLog.destroy({ where: {}, transaction: t });
      console.log(`🗑  app_usage_logs:   ${al} rows deleted`);

      const lo = await Loan.destroy({ where: {}, transaction: t });
      console.log(`🗑  loans:            ${lo} rows deleted`);
    });

    console.log(
      "\n✅ All transactional data wiped. Users, admins, roles, config untouched.",
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err.message);
    process.exit(1);
  }
}

reset();
