/**
 * scripts/seedSuperAdmin.js — Sequelize version
 */
require("dotenv").config();
const connectDB = require("../config/database");
const { Admin, Role } = require("../models");

async function seedSuperAdmin() {
  await connectDB();

  const superAdminRole = await Role.findOne({ where: { name: "super-admin" } });
  if (!superAdminRole) {
    console.error(
      "Super Administrator role not found. Run seedRoles.js first.",
    );
    process.exit(1);
  }

  const [, created] = await Admin.findOrCreate({
    where: { email: "superadmin@cedi.com" },
    defaults: {
      firstName: "Super",
      lastName: "Administrator",
      designation: "Super Administrator",
      username: "superadmin",
      email: "superadmin@cedi.com",
      phoneNumber: "+233000000000",
      password: "SuperAdmin123!", // hashed by beforeCreate hook
      roleId: superAdminRole.id,
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  console.log(
    created
      ? "✅ Super Administrator created."
      : "ℹ️  Super Administrator already exists.",
  );
  console.log("📧 Email: superadmin@cedi.com");
  console.log("🔑 Password: SuperAdmin123!");
  console.log("⚠️  Change the password after first login.");
  process.exit(0);
}

seedSuperAdmin().catch((err) => {
  console.error("❌ Seed error:", err.message);
  process.exit(1);
});
