#!/usr/bin/env node

/**
 * Script to update API URL for different environments
 * Usage: node scripts/update-api-url.js <environment> <api-url>
 * 
 * Examples:
 * node scripts/update-api-url.js local http://localhost:5000/api
 * node scripts/update-api-url.js production https://your-backend.herokuapp.com/api
 * node scripts/update-api-url.js staging https://staging-backend.railway.app/api
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/update-api-url.js <environment> <api-url>');
  console.log('\nExamples:');
  console.log('  node scripts/update-api-url.js local http://localhost:5000/api');
  console.log('  node scripts/update-api-url.js production https://your-backend.herokuapp.com/api');
  console.log('  node scripts/update-api-url.js staging https://staging-backend.railway.app/api');
  process.exit(1);
}

const environment = args[0];
const apiUrl = args[1];

// Validate URL format
try {
  new URL(apiUrl);
} catch (error) {
  console.error('❌ Invalid URL format:', apiUrl);
  process.exit(1);
}

// Determine which .env file to update
let envFile;
switch (environment.toLowerCase()) {
  case 'local':
  case 'development':
  case 'dev':
    envFile = '.env';
    break;
  case 'production':
  case 'prod':
    envFile = '.env.production';
    break;
  case 'staging':
  case 'stage':
    envFile = '.env.staging';
    break;
  default:
    envFile = `.env.${environment}`;
}

const envPath = path.join(process.cwd(), envFile);

// Read existing .env file or create new one
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Update or add REACT_APP_API_URL
const apiUrlRegex = /^REACT_APP_API_URL=.*$/m;
const newApiUrlLine = `REACT_APP_API_URL=${apiUrl}`;

if (apiUrlRegex.test(envContent)) {
  // Update existing line
  envContent = envContent.replace(apiUrlRegex, newApiUrlLine);
  console.log(`✅ Updated REACT_APP_API_URL in ${envFile}`);
} else {
  // Add new line
  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `\n# Backend API URL\n${newApiUrlLine}\n`;
  console.log(`✅ Added REACT_APP_API_URL to ${envFile}`);
}

// Write back to file
fs.writeFileSync(envPath, envContent);

console.log(`\n📝 Environment: ${environment}`);
console.log(`🔗 API URL: ${apiUrl}`);
console.log(`📁 File: ${envFile}`);
console.log('\n🔄 Remember to restart your development server or rebuild for production!');

// Show next steps
if (environment === 'production') {
  console.log('\n📦 Next steps for production:');
  console.log('  1. npm run build');
  console.log('  2. Deploy the build folder to your hosting platform');
} else {
  console.log('\n🚀 Next steps for development:');
  console.log('  1. Restart your development server (Ctrl+C then npm start)');
  console.log('  2. Test your API connections');
}