/**
 * seedTestUser.js
 * Creates a test user that can log into the cedLoan app.
 * Run from backend/: node scripts/seedTestUser.js
 */

require("dotenv").config();
const { sequelize } = require("../config/database");
const { User } = require("../models");

const TEST_USER = {
  phoneNumber: "+233244000001",
  pin: "1234", // will be hashed by the User model beforeCreate hook
  firstName: "Test",
  lastName: "User",
  dateOfBirth: new Date("1990-05-15"),
  gender: "male",
  address: {
    street: "1 Test Street",
    city: "Accra",
    region: "Greater Accra",
    country: "Ghana",
  },
  authMethod: "phone-pin",
  isPhoneVerified: true,
  registrationComplete: true,
  kycComplete: false,
  mustChangePinOnLogin: false,
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    const [user, created] = await User.findOrCreate({
      where: { phoneNumber: TEST_USER.phoneNumber },
      defaults: TEST_USER,
    });

    if (created) {
      console.log("\n✅ Test user created successfully!\n");
    } else {
      // Update PIN in case it changed
      await user.update({ pin: TEST_USER.pin });
      console.log("\n✅ Test user already exists — PIN reset.\n");
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  cedLoan Login Credentials");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  Phone : ${TEST_USER.phoneNumber}`);
    console.log(`  PIN   : ${TEST_USER.pin}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("  Also accepts: 0244000001 (local format)\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
