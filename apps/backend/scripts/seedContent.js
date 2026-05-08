/**
 * scripts/seedContent.js — Sequelize version
 */
require('dotenv').config();
const connectDB = require('../config/database');
const { Content } = require('../models');

const defaultContent = [
  {
    key: 'faq_1',
    type: 'faq',
    title: 'How do I apply for a loan?',
    content: 'Download the CEDI Loan app, register your account, complete your profile and apply for a loan. The process takes only a few minutes.',
    order: 1,
    isActive: true,
  },
  {
    key: 'faq_2',
    type: 'faq',
    title: 'What are the loan requirements?',
    content: 'You must be 18+ years old, have a valid Ghana national ID, and a registered mobile money wallet.',
    order: 2,
    isActive: true,
  },
  {
    key: 'faq_3',
    type: 'faq',
    title: 'How long does approval take?',
    content: 'Loan applications are typically reviewed within 24 hours. Approved borrowers at higher levels may receive instant approval.',
    order: 3,
    isActive: true,
  },
  {
    key: 'faq_4',
    type: 'faq',
    title: 'How do I repay my loan?',
    content: 'Repayments are made via mobile money (MTN MoMo or AirtelTigo Money) directly through the app.',
    order: 4,
    isActive: true,
  },
  {
    key: 'process_guide_1',
    type: 'process_guide',
    title: 'Step 1: Register',
    content: 'Create your CEDI Loan account with your phone number and valid national ID.',
    order: 1,
    isActive: true,
  },
  {
    key: 'process_guide_2',
    type: 'process_guide',
    title: 'Step 2: Complete Profile',
    content: 'Fill in your personal, employment and financial information to increase your credit limit.',
    order: 2,
    isActive: true,
  },
  {
    key: 'process_guide_3',
    type: 'process_guide',
    title: 'Step 3: Apply',
    content: 'Select your desired loan amount and repayment term, then submit your application.',
    order: 3,
    isActive: true,
  },
  {
    key: 'process_guide_4',
    type: 'process_guide',
    title: 'Step 4: Receive Funds',
    content: 'Once approved, funds are disbursed directly to your mobile money wallet.',
    order: 4,
    isActive: true,
  },
  {
    key: 'contact_info',
    type: 'contact_info',
    title: 'Contact Information',
    content: {
      phone: '+233000000000',
      email: 'support@cedi.com',
      whatsapp: '+233000000000',
      address: 'Accra, Ghana',
      hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    },
    order: 1,
    isActive: true,
  },
];

async function seedContent() {
  await connectDB();
  console.log('Seeding content...');

  for (const item of defaultContent) {
    const [, created] = await Content.upsert({ ...item, metadata: {} });
    console.log(`${created ? 'Created' : 'Updated'} content: ${item.key}`);
  }

  console.log('✅ Content seeded.');
  process.exit(0);
}

seedContent().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
