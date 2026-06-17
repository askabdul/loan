/**
 * scripts/resetTestData.js
 *
 * Wipes all user-generated data so you can test with real phone numbers and
 * real money from scratch. Safe to re-run any time.
 *
 * What is DELETED:
 *   - All payments
 *   - All loan clearances
 *   - All loans
 *   - All notifications
 *   - All app usage logs
 *   - All users
 *
 * What is KEPT (platform config — do NOT delete these):
 *   - Roles
 *   - Admins
 *   - Loan levels
 *   - Loan terms
 *   - App config
 *
 * Usage:
 *   node scripts/resetTestData.js
 *   node scripts/resetTestData.js --confirm   (skip the interactive prompt)
 */

require("dotenv").config();
const { sequelize } = require("../config/database");
const readline = require("readline");

const TABLES_IN_ORDER = [
  // Delete dependents before parents (FK order)
  { schema: "cedi_payments",      table: "payments" },
  { schema: "cedi_loans",         table: "loan_clearances" },
  { schema: "cedi_loans",         table: "loans" },
  { schema: "cedi_notifications", table: "notifications" },
  { schema: "cedi_auth",          table: "app_usage_logs" },
  { schema: "cedi_auth",          table: "users" },
];

async function confirm() {
  if (process.argv.includes("--confirm")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      "\n⚠️  This will permanently delete ALL users, loans, and payments.\n" +
      "   Admins, roles, and app config are NOT touched.\n\n" +
      "   Type  yes  to continue: ",
      (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase() === "yes");
      },
    );
  });
}

async function reset() {
  await sequelize.authenticate();
  console.log("✅ Connected to database\n");

  const go = await confirm();
  if (!go) {
    console.log("Aborted — nothing was deleted.");
    process.exit(0);
  }

  console.log("\n🗑️  Deleting test data...\n");

  for (const { schema, table } of TABLES_IN_ORDER) {
    const [result] = await sequelize.query(
      `DELETE FROM "${schema}"."${table}"`,
    );
    const count = result?.rowCount ?? "?";
    console.log(`   ${schema}.${table}: ${count} rows deleted`);
  }

  // Reset loan-level completion counters on users (already deleted, but also
  // reset loan_levels.current_borrowers if tracked there)
  try {
    await sequelize.query(
      `UPDATE cedi_loans.loan_levels SET current_borrowers = 0 WHERE current_borrowers > 0`,
    );
    console.log("   cedi_loans.loan_levels: borrower counts reset to 0");
  } catch {
    // column may not exist — not fatal
  }

  console.log("\n✅ Reset complete. All users, loans and payments have been wiped.");
  console.log("   Run the seed scripts if you need fresh config/roles:\n");
  console.log("     node scripts/seedRoles.js");
  console.log("     node scripts/seedLoanLevels.js");
  console.log("     node scripts/seedAllConfigs.js");
  console.log("     node scripts/seedSuperAdmin.js\n");
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Reset failed:", err.message);
    process.exit(1);
  });
