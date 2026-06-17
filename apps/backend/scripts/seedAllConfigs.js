require('dotenv').config();
const connectDB = require('../config/database');
const { AppConfig } = require('../models');

const allConfigs = [
  // Loan Configuration
  {
    key: 'interestRate',
    value: 12.5,
    description: 'Default annual interest rate percentage',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'autoApprovalLimit',
    value: 50000,
    description: 'Maximum loan amount for automatic approval',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'requireCollateral',
    value: true,
    description: 'Whether collateral is required for loans',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'maxLoanTerm',
    value: 60,
    description: 'Maximum loan term in months',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'minCreditScore',
    value: 600,
    description: 'Minimum credit score required',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'processingFee',
    value: 2.5,
    description: 'Processing fee percentage',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'auto_disburse_on_approval',
    value: true,
    description: 'Automatically disburse loan immediately after approval',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'activate_loan_on_disbursement',
    value: true,
    description: 'Set loan status to active immediately once disbursed',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'overdue_day_count_mode',
    value: 'calendar_midnight',
    description:
      'How overdue days are counted: calendar_midnight or elapsed_24h',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'loan_extension_daily_fee_rate',
    value: 0.02,
    description: 'Daily extension fee rate as decimal (0.02 = 2%)',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'max_extension_days_per_request',
    value: 30,
    description: 'Maximum extension days allowed per request',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'max_extension_count',
    value: 3,
    description: 'Maximum number of extension approvals allowed per loan',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'max_overdue_days_for_extension',
    value: 30,
    description: 'Maximum overdue days after which extension is disallowed',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'reserve_release_days',
    value: 10,
    description: 'Days before hung-up reserved cases are auto-released',
    category: 'loans',
    isPublic: false,
  },
  {
    key: 'dashboard_refresh_interval_seconds',
    value: 60,
    description: 'Admin dashboard auto-refresh interval in seconds',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'dashboard_cache_ttl_seconds',
    value: 30,
    description: 'WebSocket dashboard cache TTL in seconds',
    category: 'system',
    isPublic: false,
  },

  // Term-specific fee rates — canonical format: {type}_{term}_days
  // These are read by cedLoan fee calculator (ConfigContext.getLoanConfig)
  // and also writable via /api/config-new/admin/loan-calculations/:termDays
  // Fee breakdown: 45% total deducted upfront from disbursement
  // Interest (9%) + Service (12%) + Admin (12%) + Commitment (12%) = 45%
  { key: 'interest_rate_7_days',   value: 9,  description: 'Interest rate % for 7-day loans (flat, deducted upfront)',    category: 'loans', isPublic: true },
  { key: 'service_fee_7_days',     value: 12, description: 'Service fee % for 7-day loans (deducted upfront)',           category: 'loans', isPublic: true },
  { key: 'admin_fee_7_days',       value: 12, description: 'Administration fee % for 7-day loans (deducted upfront)',    category: 'loans', isPublic: true },
  { key: 'commitment_fee_7_days',  value: 12, description: 'Commitment fee % for 7-day loans (deducted upfront)',        category: 'loans', isPublic: true },
  { key: 'interest_rate_14_days',  value: 12, description: 'Interest rate % for 14-day loans',   category: 'loans', isPublic: true },
  { key: 'service_fee_14_days',    value: 5,  description: 'Service fee % for 14-day loans',      category: 'loans', isPublic: true },
  { key: 'admin_fee_14_days',      value: 2,  description: 'Admin fee % for 14-day loans',        category: 'loans', isPublic: true },
  { key: 'commitment_fee_14_days', value: 1,  description: 'Commitment fee % for 14-day loans',   category: 'loans', isPublic: true },
  { key: 'interest_rate_30_days',  value: 18, description: 'Interest rate % for 30-day loans',   category: 'loans', isPublic: true },
  { key: 'service_fee_30_days',    value: 5,  description: 'Service fee % for 30-day loans',      category: 'loans', isPublic: true },
  { key: 'admin_fee_30_days',      value: 2,  description: 'Admin fee % for 30-day loans',        category: 'loans', isPublic: true },
  { key: 'commitment_fee_30_days', value: 1,  description: 'Commitment fee % for 30-day loans',   category: 'loans', isPublic: true },
  { key: 'overdue_fee_daily_pct',  value: 2,  description: 'Daily overdue penalty % on remaining balance (simple, accrues nightly)', category: 'loans', isPublic: false },
  { key: 'upfront_deduction_pct', value: 20, description: '% of principal withheld from disbursement upfront (e.g. 20 → customer gets 80% of loan amount)', category: 'loans', isPublic: false },
  // Extension feature — disabled by business decision; toggle here if ever re-enabled
  { key: 'enable_extension',       value: false, description: 'Enable loan extension feature (currently disabled)', category: 'loans', isPublic: false },
  // Contact Information (served publicly to cedLoan)
  {
    key: 'support_phone',
    value: '',
    description: 'Customer support phone number',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'support_email',
    value: '',
    description: 'Customer support email address',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'support_whatsapp',
    value: '',
    description: 'WhatsApp support number',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'office_address',
    value: '',
    description: 'Physical office address',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'business_hours',
    value: 'Monday – Friday, 8am – 5pm',
    description: 'Customer support operating hours',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'emergency_contact',
    value: '',
    description: '24/7 emergency contact number',
    category: 'system',
    isPublic: true,
  },
  // App Branding
  {
    key: 'app_tagline',
    value: 'Fast, Simple Loans',
    description: 'Short tagline displayed in the customer app',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'app_description',
    value: 'CEDI Loan provides fast, accessible mobile money loans in Ghana.',
    description: 'App description shown in customer-facing surfaces',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'company_name',
    value: 'CEDI Finance Ltd',
    description: 'Legal company name',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'company_logo_url',
    value: '',
    description: 'URL to the company/app logo',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'app_version',
    value: '1.0.0',
    description: 'Current application version string',
    category: 'system',
    isPublic: true,
  },

  // System Configuration
  {
    key: 'appName',
    value: 'CEDI Loan Management System',
    description: 'Application name displayed in the interface',
    category: 'system',
    isPublic: true,
  },
  {
    key: 'maintenanceMode',
    value: false,
    description: 'Enable maintenance mode to restrict access',
    category: 'system',
    isPublic: false,
    requiresRestart: true,
  },
  {
    key: 'maxFileUploadSize',
    value: 10,
    description: 'Maximum file upload size in MB',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'sessionTimeout',
    value: 30,
    description: 'Session timeout in minutes',
    category: 'security',
    isPublic: false,
  },
  {
    key: 'enableNotifications',
    value: true,
    description: 'Enable system notifications',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'defaultLanguage',
    value: 'en',
    description: 'Default system language',
    category: 'system',
    isPublic: true,
  },

  // Security Settings
  {
    key: 'passwordMinLength',
    value: 8,
    description: 'Minimum password length',
    category: 'security',
    isPublic: false,
  },
  {
    key: 'requirePasswordComplexity',
    value: true,
    description: 'Require complex passwords with special characters',
    category: 'security',
    isPublic: false,
  },
  {
    key: 'maxLoginAttempts',
    value: 5,
    description: 'Maximum failed login attempts before lockout',
    category: 'security',
    isPublic: false,
  },
  {
    key: 'lockoutDuration',
    value: 15,
    description: 'Account lockout duration in minutes',
    category: 'security',
    isPublic: false,
  },
  {
    key: 'enableTwoFactor',
    value: false,
    description: 'Enable two-factor authentication',
    category: 'security',
    isPublic: false,
  },

  // Email Configuration
  {
    key: 'smtpHost',
    value: 'smtp.gmail.com',
    description: 'SMTP server hostname',
    category: 'email',
    isPublic: false,
  },
  {
    key: 'smtpPort',
    value: 587,
    description: 'SMTP server port',
    category: 'email',
    isPublic: false,
  },
  {
    key: 'smtpUsername',
    value: 'your-email@gmail.com',
    description: 'SMTP username',
    category: 'email',
    isPublic: false,
  },
  {
    key: 'smtpPassword',
    value: 'your-app-password',
    description: 'SMTP password',
    category: 'email',
    isPublic: false,
  },
  {
    key: 'fromEmail',
    value: 'noreply@cediloan.com',
    description: 'Default sender email address',
    category: 'email',
    isPublic: false,
  },
  {
    key: 'fromName',
    value: 'CEDI Loan System',
    description: 'Default sender name',
    category: 'email',
    isPublic: true,
  },
  {
    key: 'enableSSL',
    value: true,
    description: 'Enable SSL/TLS for email',
    category: 'email',
    isPublic: false,
  },

  // API Configuration
  {
    key: 'rateLimitWindow',
    value: 15,
    description: 'Rate limit window in minutes',
    category: 'api',
    isPublic: false,
  },
  {
    key: 'rateLimitMax',
    value: 100,
    description: 'Maximum requests per window',
    category: 'api',
    isPublic: false,
  },
  {
    key: 'enableCors',
    value: true,
    description: 'Enable Cross-Origin Resource Sharing',
    category: 'api',
    isPublic: false,
  },
  {
    key: 'corsOrigins',
    value: 'http://localhost:3000,http://localhost:3001',
    description: 'Allowed CORS origins (comma-separated)',
    category: 'api',
    isPublic: false,
  },
  {
    key: 'apiVersion',
    value: 'v1',
    description: 'Current API version',
    category: 'api',
    isPublic: true,
  },

  // Database Configuration
  {
    key: 'connectionPoolSize',
    value: 10,
    description: 'Database connection pool size',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'queryTimeout',
    value: 30000,
    description: 'Database query timeout in milliseconds',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'enableQueryLogging',
    value: false,
    description: 'Enable database query logging',
    category: 'system',
    isPublic: false,
  },
  {
    key: 'backupRetentionDays',
    value: 30,
    description: 'Number of days to retain database backups',
    category: 'system',
    isPublic: false,
  },
];

async function seedAllConfigs() {
  await connectDB();
  console.log('Seeding all app configs...');

  for (const config of allConfigs) {
    await AppConfig.upsert({
      ...config,
      isActive: true,
      requiresRestart: config.requiresRestart || false,
    });
    console.log(`✔ ${config.key}`);
  }

  console.log('✅ Configuration seeding completed.');
}

async function runSeed() {
  try {
    await seedAllConfigs();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { seedAllConfigs, allConfigs };
