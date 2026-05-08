const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Auto-generated 6-digit display ID (not the PK)
    userId: {
      type: DataTypes.STRING(6),
      unique: true,
      validate: { is: /^\d{6}$/ },
    },
    // ── Authentication ────────────────────────────────────────────────
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pin: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authMethod: {
      type: DataTypes.ENUM("phone-pin", "email-password", "both"),
      defaultValue: "phone-pin",
    },
    // ── Personal Information ──────────────────────────────────────────
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: true,
    },
    // Address stored as JSONB { street, city, region, country }
    address: {
      type: DataTypes.JSONB,
      defaultValue: { country: "Ghana" },
    },
    // ── Work Information ──────────────────────────────────────────────
    employmentStatus: {
      type: DataTypes.ENUM(
        "employed",
        "self-employed",
        "unemployed",
        "student",
        "retired",
      ),
      allowNull: true,
    },
    employer: DataTypes.STRING,
    jobTitle: DataTypes.STRING,
    monthlyIncome: {
      type: DataTypes.DECIMAL(15, 2),
      validate: { min: 0 },
    },
    workAddress: DataTypes.STRING,
    yearsOfEmployment: DataTypes.INTEGER,
    // ── Education Information ─────────────────────────────────────────
    educationLevel: {
      type: DataTypes.ENUM(
        "primary",
        "secondary",
        "diploma",
        "bachelor",
        "master",
        "doctorate",
        "tertiary",
        "vocational",
        "postgraduate",
        "university",
        "other",
      ),
      allowNull: true,
    },
    educationInstitution: DataTypes.STRING,
    fieldOfStudy: DataTypes.STRING,
    graduationYear: DataTypes.INTEGER,
    // ── Emergency Contacts ────────────────────────────────────────────
    // Array of { name, relationship, phoneNumber, email }
    emergencyContacts: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    // ── ID Verification ───────────────────────────────────────────────
    idType: {
      type: DataTypes.ENUM(
        "national-id",
        "passport",
        "drivers-license",
        "voters-id",
      ),
      allowNull: true,
    },
    idNumber: DataTypes.STRING,
    idVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    idVerificationDate: DataTypes.DATE,
    idDocuments: {
      type: DataTypes.JSONB, // [{ url, uploadDate }]
      defaultValue: [],
    },
    // ── Loan Level Tracking ───────────────────────────────────────────
    currentLoanLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: { min: 1 },
    },
    totalLoansCompleted: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0 },
    },
    totalAmountRepaid: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    totalAmountBorrowed: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    // Array of { fromLevel, toLevel, progressionDate, reason, triggeredBy, notes }
    levelProgressionHistory: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    // ── Account Status ────────────────────────────────────────────────
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isPhoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    registrationComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // KYC Gate — set to true only after loan-application KYC steps are completed
    kycComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Forces PIN change on next login (set by admin for manually registered users)
    mustChangePinOnLogin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Audit trail: [{ field, oldValue, newValue, changedBy, changedAt }]
    changeLog: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    role: {
      type: DataTypes.ENUM("user", "admin"),
      defaultValue: "user",
    },
    lastLogin: DataTypes.DATE,
    passwordChangedAt: DataTypes.DATE,
  },
  {
    schema: "cedi_auth",
    tableName: "users",
    underscored: true,
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["password", "pin"] },
    },
    scopes: {
      withPin: { attributes: {} }, // include all fields including pin
      withPassword: { attributes: {} }, // include all fields including password
    },
    indexes: [
      { fields: ["phone_number"] },
      { fields: ["email"] },
      { fields: ["user_id"] },
      { fields: ["is_active"] },
    ],
    hooks: {
      beforeCreate: async (user) => {
        // Generate unique 6-digit userId
        if (!user.userId) {
          const { Op } = require("sequelize");
          let unique = false;
          while (!unique) {
            const candidate = String(
              Math.floor(100000 + Math.random() * 900000),
            );
            const exists = await User.findOne({ where: { userId: candidate } });
            if (!exists) {
              user.userId = candidate;
              unique = true;
            }
          }
        }
        // Hash password
        if (user.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          user.password = await bcrypt.hash(user.password, rounds);
        }
        // Hash PIN
        if (user.pin) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          user.pin = await bcrypt.hash(user.pin, rounds);
          user.passwordChangedAt = new Date(Date.now() - 1000);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password") && user.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          user.password = await bcrypt.hash(user.password, rounds);
          user.passwordChangedAt = new Date(Date.now() - 1000);
        }
        if (user.changed("pin") && user.pin) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          user.pin = await bcrypt.hash(user.pin, rounds);
        }
      },
    },
  },
);

// ── Instance Methods ──────────────────────────────────────────────────────────
User.prototype.correctPassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.correctPin = async function (candidatePin) {
  return bcrypt.compare(candidatePin, this.pin);
};

User.prototype.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changed = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changed;
  }
  return false;
};

User.prototype.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

module.exports = User;
