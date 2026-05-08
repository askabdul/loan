const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../../config/database");

const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // ── Authentication ────────────────────────────────────────────────
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    username: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: { is: /^[a-zA-Z0-9_]+$/ },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // ── Personal Details ─────────────────────────────────────────────
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phoneNumber: DataTypes.STRING(20),
    dateJoined: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    dateOfExpiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    employeeNumber: {
      type: DataTypes.STRING(6),
      unique: true,
      validate: { is: /^\d{6}$/ },
    },
    // ── Role FK (set in associations) ────────────────────────────────
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { tableName: "roles", schema: "cedi_auth" },
        key: "id",
      },
    },
    // ── Custom permission overrides on top of role defaults ───────────
    // Structure mirrors Role.permissions — null values are ignored/not overriding
    customPermissions: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    // ── Role-based data assignments ───────────────────────────────────
    // { loanApplicationIds: [], collectionCaseIds: [], precollectionCaseIds: [], regions: [], branches: [] }
    assignments: {
      type: DataTypes.JSONB,
      defaultValue: {},
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
    lastLogin: DataTypes.DATE,
    passwordChangedAt: DataTypes.DATE,
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lockUntil: DataTypes.DATE,
    // ── Audit ────────────────────────────────────────────────────────
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    lastModifiedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "cedi_auth",
    tableName: "admins",
    underscored: true,
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["password"] },
    },
    scopes: {
      withPassword: { attributes: {} }, // include all fields including password
    },
    indexes: [
      { fields: ["email"] },
      { fields: ["username"] },
      { fields: ["role_id"] },
      { fields: ["is_active"] },
    ],
    hooks: {
      beforeCreate: async (admin) => {
        // Generate unique 6-digit employee number
        if (!admin.employeeNumber) {
          let unique = false;
          while (!unique) {
            const candidate = String(
              Math.floor(100000 + Math.random() * 900000),
            );
            const exists = await Admin.findOne({
              where: { employeeNumber: candidate },
            });
            if (!exists) {
              admin.employeeNumber = candidate;
              unique = true;
            }
          }
        }
        if (admin.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          admin.password = await bcrypt.hash(admin.password, rounds);
          admin.passwordChangedAt = new Date(Date.now() - 1000);
        }
      },
      beforeUpdate: async (admin) => {
        if (admin.changed("password") && admin.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
          admin.password = await bcrypt.hash(admin.password, rounds);
          admin.passwordChangedAt = new Date(Date.now() - 1000);
        }
      },
    },
  },
);

// ── Instance Methods ──────────────────────────────────────────────────────────
Admin.prototype.correctPassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

Admin.prototype.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changed = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changed;
  }
  return false;
};

Admin.prototype.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

Admin.prototype.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

Admin.prototype.incLoginAttempts = async function () {
  // Expired lock — reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.update({ loginAttempts: 1, lockUntil: null });
    return;
  }
  const newAttempts = (this.loginAttempts || 0) + 1;
  const updates = { loginAttempts: newAttempts };
  if (newAttempts >= 5 && !this.isLocked()) {
    updates.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 h
  }
  await this.update(updates);
};

Admin.prototype.resetLoginAttempts = async function () {
  await this.update({ loginAttempts: 0, lockUntil: null });
};

/**
 * Merge role permissions with custom overrides.
 * Returns a plain object identical in shape to Role.permissions.
 */
Admin.prototype.getEffectivePermissions = async function () {
  const role = this.Role || (await this.getRole());
  if (!role) throw new Error("Admin role not found");

  const base = role.permissions || {};
  const custom = this.customPermissions || {};

  const merge = (baseObj, overrideObj) => {
    const result = { ...baseObj };
    for (const key of Object.keys(overrideObj)) {
      if (overrideObj[key] !== null && overrideObj[key] !== undefined) {
        if (
          typeof overrideObj[key] === "object" &&
          !Array.isArray(overrideObj[key])
        ) {
          result[key] = merge(result[key] || {}, overrideObj[key]);
        } else {
          result[key] = overrideObj[key];
        }
      }
    }
    return result;
  };

  return merge(base, custom);
};

Admin.prototype.canAccessMenu = async function (menuName) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  return !!(perms.menus && perms.menus[menuName]);
};

Admin.prototype.canPerformAction = async function (action) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  return !!(perms.actions && perms.actions[action]);
};

Admin.prototype.hasDataAccess = async function (access) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  return !!(perms.dataAccess && perms.dataAccess[access]);
};
// Supports one-param ("viewAllLoans") and two-param ("loans", "amount") call styles
Admin.prototype.canAccessData = async function (dataType, accessLevel = null) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  if (!perms.dataAccess) return false;
  if (accessLevel) {
    return !!(
      perms.dataAccess[dataType] && perms.dataAccess[dataType][accessLevel]
    );
  }
  return !!perms.dataAccess[dataType];
};

Admin.prototype.canAccessSubMenu = async function (menuName, subMenuName) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  return !!(
    perms.subMenus &&
    perms.subMenus[menuName] &&
    perms.subMenus[menuName][subMenuName]
  );
};
module.exports = Admin;
