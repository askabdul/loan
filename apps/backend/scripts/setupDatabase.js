/**
 * scripts/setupDatabase.js
 *
 * Creates all PostgreSQL schemas and syncs Sequelize models.
 * Run once to initialise a fresh database.
 *
 *   DB_SYNC=force  node scripts/setupDatabase.js   ← drops + recreates all tables
 *   DB_SYNC=alter  node scripts/setupDatabase.js   ← alters tables to match models
 *   node scripts/setupDatabase.js                  ← schema creation only (no sync)
 */
require('dotenv').config();
const connectDB = require('../config/database');

async function setup() {
  console.log('🛠  Setting up database...');
  await connectDB();           // creates schemas, runs associations, syncs models
  console.log('✅ Database setup complete.');
  process.exit(0);
}

setup().catch((err) => {
  console.error('❌ Setup error:', err.message);
  process.exit(1);
});
