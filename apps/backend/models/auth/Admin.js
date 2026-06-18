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

  const merged = merge(base, custom);

  merged.menus = merged.menus || {};
  if (
    Object.prototype.hasOwnProperty.call(merged.menus, "preCollection") ||
    Object.prototype.hasOwnProperty.call(merged.menus, "precollection")
  ) {
    merged.menus.preCollection =
      Boolean(merged.menus.preCollection) || Boolean(merged.menus.precollection);
  }
  delete merged.menus.precollection;

  merged.subMenus = merged.subMenus || {};
  const preCollectionSubMenus = merged.subMenus.preCollection || {};
  const precollectionSubMenus = merged.subMenus.precollection || {};
  const mergedSubMenuKeys = Array.from(
    new Set([
      ...Object.keys(preCollectionSubMenus),
      ...Object.keys(precollectionSubMenus),
    ]),
  );
  if (mergedSubMenuKeys.length > 0) {
    merged.subMenus.preCollection = mergedSubMenuKeys.reduce((acc, key) => {
      acc[key] =
        Boolean(preCollectionSubMenus[key]) ||
        Boolean(precollectionSubMenus[key]);
      return acc;
    }, {});
  }
  delete merged.subMenus.precollection;

  if (
    role?.name === "precollection-officer" &&
    merged.subMenus?.preCollection?.allList === true
  ) {
    merged.subMenus.preCollection.list = true;
  }

  return merged;
};

Admin.prototype.canAccessMenu = async function (menuName) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  const normalizeKey = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const menuAliasGroups = {
    user: ["user", "usermanagement"],
    order: ["order", "loanmanagement"],
    precollection: ["precollection"],
    collection: ["collection"],
    creditreview: ["creditreview"],
    fundmanagement: ["fundmanagement"],
    appconfiguration: ["appconfiguration", "systemconfig", "config"],
    datastatistics: ["datastatistics", "dashboard", "analytics"],
    system: ["system", "adminmanagement"],
    contentmanagement: ["contentmanagement", "content"],
    notificationmanagement: ["notificationmanagement", "notifications"],
  };
  const normalizeMenuGroup = (value) => {
    const key = normalizeKey(value);
    const group = Object.entries(menuAliasGroups).find(([, aliases]) =>
      aliases.includes(key),
    );
    return group ? group[0] : key;
  };

  const direct = !!(perms.menus && perms.menus[menuName]);
  if (direct) return true;

  const targetKey = normalizeMenuGroup(menuName);
  return Object.entries(perms.menus || {}).some(
    ([key, value]) => value === true && normalizeMenuGroup(key) === targetKey,
  );
};

Admin.prototype.canPerformAction = async function (action) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();

  const actionAliases = {
    updateConfiguration: [
      "updateConfig",
      "editConfig",
      "systemConfig",
      "manageSystemConfig",
    ],
    manageRoles: ["createRole", "editRole", "deleteRole", "manageUserRoles"],
    assignLoan: ["assignLoans", "reassignLoan"],
    editUsers: ["edit_user"],
    edit_user: ["editUsers"],
    updateLoanStatus: [
      "approveLoans",
      "rejectLoans",
      "hangUpLoans",
      "approveLoan",
      "rejectLoan",
      "hangUpApplication",
      "updateLoan",
    ],
    createUser: ["createUsers"],
    createUsers: ["createUser"],
    resetPin: ["resetPassword", "reset_password"],
    reset_password: ["resetPassword", "resetPin"],
    updateContent: ["editContent"],
    editContent: ["updateContent"],
    manageNotifications: ["viewNotifications", "editNotifications"],
    loan_clearance: ["loanClearance"],
    loanClearance: ["loan_clearance"],
    viewReports: ["viewStatistics"],
    viewStatistics: ["viewReports"],
  };

  if (perms.actions && perms.actions[action]) return true;

  const aliases = actionAliases[action] || [];
  return aliases.some((alias) => !!(perms.actions && perms.actions[alias]));
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
  const normalizeKey = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  if (accessLevel) {
    const direct = !!(
      perms.dataAccess[dataType] && perms.dataAccess[dataType][accessLevel]
    );
    if (direct) return true;

    const dottedKey = `${dataType}.${accessLevel}`;
    if (perms.dataAccess[dottedKey] === true) return true;

    const targetKey = normalizeKey(dottedKey);
    return Object.entries(perms.dataAccess || {}).some(
      ([key, value]) => value === true && normalizeKey(key) === targetKey,
    );
  }
  if (perms.dataAccess[dataType] === true) return true;

  const targetKey = normalizeKey(dataType);
  return Object.entries(perms.dataAccess || {}).some(
    ([key, value]) => value === true && normalizeKey(key) === targetKey,
  );
};

Admin.prototype.canAccessSubMenu = async function (menuName, subMenuName) {
  const role = this.Role || (await this.getRole());
  if (role && role.name === "super-admin") return true;
  const perms = await this.getEffectivePermissions();
  const normalizeKey = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const menuAliasGroups = {
    user: ["user", "usermanagement"],
    order: ["order", "loanmanagement"],
    precollection: ["precollection"],
    collection: ["collection"],
    creditreview: ["creditreview"],
    fundmanagement: ["fundmanagement"],
    appconfiguration: ["appconfiguration", "systemconfig", "config"],
    datastatistics: ["datastatistics", "dashboard", "analytics"],
    system: ["system", "adminmanagement"],
    contentmanagement: ["contentmanagement", "content"],
    notificationmanagement: ["notificationmanagement", "notifications"],
  };
  const normalizeMenuGroup = (value) => {
    const key = normalizeKey(value);
    const group = Object.entries(menuAliasGroups).find(([, aliases]) =>
      aliases.includes(key),
    );
    return group ? group[0] : key;
  };

  if (
    perms.subMenus &&
    perms.subMenus[menuName] &&
    perms.subMenus[menuName][subMenuName] === true
  ) {
    return true;
  }

  const hasMenuAccess = await this.canAccessMenu(menuName);
  const directMenuSubMenus = perms.subMenus?.[menuName];
  if (hasMenuAccess && !directMenuSubMenus) {
    return true;
  }

  const targetMenu = normalizeMenuGroup(menuName);
  const targetSubMenu = normalizeKey(subMenuName);
  const subMenuEntries = Object.entries(perms.subMenus || {}).filter(
    ([key]) => normalizeMenuGroup(key) === targetMenu,
  );
  if (subMenuEntries.length === 0) return hasMenuAccess;

  const hasAnyExplicitSubMenu = subMenuEntries.some(([, subMenus]) =>
    Object.values(subMenus || {}).some((value) => value === true),
  );

  if (!hasAnyExplicitSubMenu && hasMenuAccess) {
    if (targetSubMenu === "list") {
      return true;
    }
  }

  if (targetMenu === "precollection" && targetSubMenu === "list") {
    const hasAllList = subMenuEntries.some(([, subMenus]) => {
      if (!subMenus) return false;
      return Object.entries(subMenus || {}).some(
        ([key, value]) => value === true && normalizeKey(key) === "alllist",
      );
    });
    if (hasAllList && hasMenuAccess) {
      return true;
    }
  }

  return subMenuEntries.some(([, subMenus]) => {
    if (!subMenus) return hasMenuAccess;
    return Object.entries(subMenus || {}).some(
      ([key, value]) => value === true && normalizeKey(key) === targetSubMenu,
    );
  });
};
module.exports = Admin;
