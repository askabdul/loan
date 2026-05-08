require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

/**
 * Usage:
 *   node scripts/unlock-admin.js <email-or-username>
 *
 * Example:
 *   node scripts/unlock-admin.js superadmin@cedi.com
 *   node scripts/unlock-admin.js superadmin
 */

const input = process.argv[2];
if (!input) {
  console.error('Please provide an admin email or username.');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGODB_URI is not set in environment.');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const query = {
      $or: [
        { email: input.toLowerCase() },
        { username: input }
      ]
    };

    const admin = await Admin.findOne(query);
    if (!admin) {
      console.error('Admin not found for:', input);
      process.exit(1);
    }

    console.log(`Found admin: ${admin.email} (username: ${admin.username})`);
    console.log('Current lock status:', {
      loginAttempts: admin.loginAttempts,
      lockUntil: admin.lockUntil,
      isLocked: admin.isLocked,
      isActive: admin.isActive
    });

    // Reset login attempts and lock
    await admin.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });

    const refreshed = await Admin.findById(admin._id);
    console.log('Unlock complete. New status:', {
      loginAttempts: refreshed.loginAttempts,
      lockUntil: refreshed.lockUntil,
      isLocked: refreshed.isLocked
    });

    console.log('You can now attempt to log in again.');
  } catch (err) {
    console.error('Error unlocking admin:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();