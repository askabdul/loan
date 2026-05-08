require('dotenv').config();
const mongoose = require('mongoose');
const AppConfig = require('../models/AppConfig');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// All configuration data
const allConfigs = [
  // Loan Configuration
  {
    key: 'interestRate',
    value: 12.5,
    description: 'Default annual interest rate percentage'
  },
  {
    key: 'autoApprovalLimit',
    value: 50000,
    description: 'Maximum loan amount for automatic approval'
  },
  {
    key: 'requireCollateral',
    value: true,
    description: 'Whether collateral is required for loans'
  },
  {
    key: 'maxLoanTerm',
    value: 60,
    description: 'Maximum loan term in months'
  },
  {
    key: 'minCreditScore',
    value: 600,
    description: 'Minimum credit score required'
  },
  {
    key: 'processingFee',
    value: 2.5,
    description: 'Processing fee percentage'
  },
  
  // System Configuration
  {
    key: 'appName',
    value: 'CEDI Loan Management System',
    description: 'Application name displayed in the interface'
  },
  {
    key: 'maintenanceMode',
    value: false,
    description: 'Enable maintenance mode to restrict access'
  },
  {
    key: 'maxFileUploadSize',
    value: 10,
    description: 'Maximum file upload size in MB'
  },
  {
    key: 'sessionTimeout',
    value: 30,
    description: 'Session timeout in minutes'
  },
  {
    key: 'enableNotifications',
    value: true,
    description: 'Enable system notifications'
  },
  {
    key: 'defaultLanguage',
    value: 'en',
    description: 'Default system language'
  },
  
  // Security Settings
  {
    key: 'passwordMinLength',
    value: 8,
    description: 'Minimum password length'
  },
  {
    key: 'requirePasswordComplexity',
    value: true,
    description: 'Require complex passwords with special characters'
  },
  {
    key: 'maxLoginAttempts',
    value: 5,
    description: 'Maximum failed login attempts before lockout'
  },
  {
    key: 'lockoutDuration',
    value: 15,
    description: 'Account lockout duration in minutes'
  },
  {
    key: 'enableTwoFactor',
    value: false,
    description: 'Enable two-factor authentication'
  },
  {
    key: 'jwtSecret',
    value: 'your-secret-key-here',
    description: 'JWT secret key for token generation'
  },
  
  // Email Configuration
  {
    key: 'smtpHost',
    value: 'smtp.gmail.com',
    description: 'SMTP server hostname'
  },
  {
    key: 'smtpPort',
    value: 587,
    description: 'SMTP server port'
  },
  {
    key: 'smtpUsername',
    value: 'your-email@gmail.com',
    description: 'SMTP username'
  },
  {
    key: 'smtpPassword',
    value: 'your-app-password',
    description: 'SMTP password'
  },
  {
    key: 'fromEmail',
    value: 'noreply@cediloan.com',
    description: 'Default sender email address'
  },
  {
    key: 'fromName',
    value: 'CEDI Loan System',
    description: 'Default sender name'
  },
  {
    key: 'enableSSL',
    value: true,
    description: 'Enable SSL/TLS for email'
  },
  
  // API Configuration
  {
    key: 'rateLimitWindow',
    value: 15,
    description: 'Rate limit window in minutes'
  },
  {
    key: 'rateLimitMax',
    value: 100,
    description: 'Maximum requests per window'
  },
  {
    key: 'enableCors',
    value: true,
    description: 'Enable Cross-Origin Resource Sharing'
  },
  {
    key: 'corsOrigins',
    value: 'http://localhost:3000,http://localhost:3001',
    description: 'Allowed CORS origins (comma-separated)'
  },
  {
    key: 'apiVersion',
    value: 'v1',
    description: 'Current API version'
  },
  
  // Database Configuration
  {
    key: 'connectionPoolSize',
    value: 10,
    description: 'Database connection pool size'
  },
  {
    key: 'queryTimeout',
    value: 30000,
    description: 'Database query timeout in milliseconds'
  },
  {
    key: 'enableQueryLogging',
    value: false,
    description: 'Enable database query logging'
  },
  {
    key: 'backupRetentionDays',
    value: 30,
    description: 'Number of days to retain database backups'
  }
];

// Seed configurations
const seedConfigs = async () => {
  try {
    console.log('Starting configuration seeding...');
    
    for (const config of allConfigs) {
      const existingConfig = await AppConfig.findOne({ key: config.key });
      
      if (!existingConfig) {
        await AppConfig.create(config);
        console.log(`+ Created config: ${config.key}`);
      } else {
        console.log(`- Config already exists: ${config.key}`);
      }
    }
    
    console.log('Configuration seeding completed!');
  } catch (error) {
    console.error('Error seeding configurations:', error);
    throw error;
  }
};

// Run the seeding
const runSeed = async () => {
  try {
    await connectDB();
    await seedConfigs();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
};

// Execute if run directly
if (require.main === module) {
  runSeed();
}

module.exports = { seedConfigs, allConfigs };