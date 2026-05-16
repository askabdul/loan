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
