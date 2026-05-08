const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const LoanTerm = sequelize.define(
  "LoanTerm",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    termId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    durationDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 730 },
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    globallyAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // PostgreSQL UUID array of user IDs with specific access
    specificUsers: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
    },
    // PostgreSQL integer array, e.g. [1, 2, 3] — empty = all levels
    levelRestrictions: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      defaultValue: [],
    },
    // Interest and fee rates can be overridden per term
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    serviceFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    administrationFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    commitmentFeePct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    schema: "cedi_loans",
    tableName: "loan_terms",
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ["term_id"] }, { fields: ["enabled"] }],
  },
);

// ── Static helpers ────────────────────────────────────────────────────────────

/** All enabled, active terms ordered by sort_order then duration */
LoanTerm.getEnabledTerms = async function () {
  return LoanTerm.findAll({
    where: { enabled: true, isActive: true },
    order: [
      ["sort_order", "ASC"],
      ["duration_days", "ASC"],
    ],
  });
};

/** Terms available to a specific user based on their loan level */
LoanTerm.getAvailableTermsForUser = async function (userId, userLevel) {
  const { Op, literal } = require("sequelize");
  const orConditions = [
    // globally available with no level restriction
    {
      globallyAvailable: true,
      levelRestrictions: { [Op.eq]: literal("'{}'::integer[]") },
    },
    // globally available and level is in levelRestrictions
    {
      globallyAvailable: true,
      levelRestrictions: { [Op.contains]: [userLevel] },
    },
  ];
  // add user-specific check only for valid UUIDs
  if (
    userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    orConditions.push({ specificUsers: { [Op.contains]: [userId] } });
  }
  return LoanTerm.findAll({
    where: { enabled: true, isActive: true, [Op.or]: orConditions },
    order: [
      ["sort_order", "ASC"],
      ["duration_days", "ASC"],
    ],
  });
};

/** Terms available to a given level */
LoanTerm.getAvailableTermsForLevel = async function (level) {
  const { Op, literal } = require("sequelize");
  return LoanTerm.findAll({
    where: {
      enabled: true,
      isActive: true,
      [Op.or]: [
        { levelRestrictions: { [Op.eq]: literal("'{}'::integer[]") } },
        { levelRestrictions: { [Op.contains]: [level] } },
      ],
    },
    order: [
      ["sort_order", "ASC"],
      ["duration_days", "ASC"],
    ],
  });
};

/** Seed default loan terms if none exist */
LoanTerm.createDefaultTerms = async function () {
  const existing = await LoanTerm.count();
  if (existing > 0) return;
  const defaults = [
    {
      termId: "7d",
      durationDays: 7,
      displayName: "7 Days",
      description: "1-week loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [],
      sortOrder: 1,
    },
    {
      termId: "14d",
      durationDays: 14,
      displayName: "14 Days",
      description: "2-week loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [2, 3, 4, 5],
      sortOrder: 2,
    },
    {
      termId: "30d",
      durationDays: 30,
      displayName: "30 Days",
      description: "1-month loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [3, 4, 5],
      sortOrder: 3,
    },
    {
      termId: "60d",
      durationDays: 60,
      displayName: "60 Days",
      description: "2-month loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [4, 5],
      sortOrder: 4,
    },
    {
      termId: "90d",
      durationDays: 90,
      displayName: "90 Days",
      description: "3-month loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [4, 5],
      sortOrder: 5,
    },
    {
      termId: "180d",
      durationDays: 180,
      displayName: "180 Days",
      description: "6-month loan term",
      enabled: true,
      globallyAvailable: true,
      levelRestrictions: [5],
      sortOrder: 6,
    },
  ];
  await LoanTerm.bulkCreate(defaults, { ignoreDuplicates: true });
};

module.exports = LoanTerm;
