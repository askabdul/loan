/**
 * scripts/seedConfig.js — Sequelize version
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { AppConfig } = require('../models');

const defaultConfigs = [
  { key: 'app_name',          value: 'CEDI Loan',           category: 'general',   isPublic: true  },
  { key: 'app_tagline',       value: 'Fast & Reliable Loans', category: 'general', isPublic: true  },
  { key: 'company_name',      value: 'CEDI Financial Services', category: 'general', isPublic: true },
  { key: 'support_email',     value: 'support@cedi.com',    category: 'contact',   isPublic: true  },
  { key: 'support_phone',     value: '+233000000000',        category: 'contact',   isPublic: true  },
  { key: 'support_whatsapp',  value: '+233000000000',        category: 'contact',   isPublic: true  },
  { key: 'office_address',    value: 'Accra, Ghana',         category: 'contact',   isPublic: true  },
  { key: 'business_hours',    value: 'Mon-Fri 8am-5pm',      category: 'contact',   isPublic: true  },
  { key: 'min_loan_amount',   value: 50,                     category: 'loans',     isPublic: false },
  { key: 'max_loan_amount',   value: 2000,                   category: 'loans',     isPublic: false },
  { key: 'default_credit_limit', value: 100,                 category: 'loans',     isPublic: false },
  { key: 'maintenance_mode',  value: false,                  category: 'system',    isPublic: false, requiresRestart: true },
  { key: 'enable_notifications', value: true,                category: 'system',    isPublic: false },
  { key: 'max_login_attempts',value: 5,                      category: 'security',  isPublic: false },
  { key: 'lockout_duration',  value: 30,                     category: 'security',  isPublic: false },
  { key: 'session_timeout',   value: 3600,                   category: 'security',  isPublic: false },
  { key: 'password_min_length', value: 8,                    category: 'security',  isPublic: false },
];

async function seedConfig() {
  await connectDB();
  console.log('Seeding app config...');

  for (const cfg of defaultConfigs) {
    const [, created] = await AppConfig.upsert({ ...cfg, isActive: true });
    console.log(`${created ? 'Created' : 'Updated'} config: ${cfg.key}`);
  }

  console.log('✅ App config seeded.');
  process.exit(0);
}

seedConfig().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
