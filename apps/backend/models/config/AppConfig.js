const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

// Full list of valid config keys — mirrors the original AppConfig enum
const CONFIG_KEYS = [
  "terms_and_conditions",
  "privacy_policy",
  "about_us",
  "contact_info",
  "faq_content",
  "process_guide",
  "loan_guide",
  "repayment_guide",
  "interest_rate_7_days",
  "interest_rate_14_days",
  "interest_rate_30_days",
  "service_fee_7_days",
  "service_fee_14_days",
  "service_fee_30_days",
  "admin_fee_7_days",
  "admin_fee_14_days",
  "admin_fee_30_days",
  "commitment_fee_7_days",
  "commitment_fee_14_days",
  "commitment_fee_30_days",
  "loan_terms_available",
  "max_loan_amount",
  "min_loan_amount",
  "default_credit_limit",
  "auto_approval_limit",
  "require_collateral",
  "max_loan_term",
  "min_credit_score",
  "processing_fee_flat",
  "processing_fee_percentage",
  "credit_score_range_min",
  "credit_score_range_max",
  "credit_score_default",
  "support_phone",
  "support_email",
  "support_whatsapp",
  "office_address",
  "business_hours",
  "emergency_contact",
  "app_name",
  "app_tagline",
  "app_description",
  "company_name",
  "company_logo_url",
  "app_version",
  "maintenance_mode",
  "max_file_upload_size",
  "session_timeout",
  "enable_notifications",
  "default_language",
  "enable_realtime_updates",
  "password_min_length",
  "require_password_complexity",
  "max_login_attempts",
  "lockout_duration",
  "enable_two_factor",
  "auto_disburse_on_approval",
  "activate_loan_on_disbursement",
  "overdue_day_count_mode",
  "loan_extension_daily_fee_rate",
  "max_extension_days_per_request",
  "max_extension_count",
  "max_overdue_days_for_extension",
  "reserve_release_days",
  "dashboard_refresh_interval_seconds",
  "dashboard_cache_ttl_seconds",
  "jwt_expiry",
  "session_secret",
  // Generic keys not in original enum — stored freely
  "interestRate",
  "autoApprovalLimit",
  "requireCollateral",
  "maxLoanTerm",
  "minCreditScore",
  "processingFee",
  "appName",
  "maintenanceMode",
  "maxFileUploadSize",
  "sessionTimeout",
  "enableNotifications",
  "defaultLanguage",
  "passwordMinLength",
  "requirePasswordComplexity",
  "maxLoginAttempts",
  "lockoutDuration",
  "enableTwoFactor",
  // Term-specific fee rates (canonical: {type}_{term}_days)
  "interest_rate_7_days",
  "service_fee_7_days",
  "admin_fee_7_days",
  "commitment_fee_7_days",
  "interest_rate_14_days",
  "service_fee_14_days",
  "admin_fee_14_days",
  "commitment_fee_14_days",
  "interest_rate_30_days",
  "service_fee_30_days",
  "admin_fee_30_days",
  "commitment_fee_30_days",
  "overdue_fee_daily_pct",
  "enable_extension",
  // Contact info
  "support_phone",
  "support_email",
  "support_whatsapp",
  "office_address",
  "business_hours",
  "emergency_contact",
  // App branding
  "app_tagline",
  "app_description",
  "company_name",
  "company_logo_url",
  "app_version",
];

const AppConfig = sequelize.define(
  "AppConfig",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    // Value is stored as JSONB — supports strings, numbers, booleans, objects, arrays
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    category: {
      type: DataTypes.STRING(100),
      defaultValue: "general",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    requiresRestart: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    updatedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "cedi_config",
    tableName: "app_configs",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["key"] },
      { fields: ["is_active"] },
      { fields: ["category"] },
    ],
  },
);

// ── Static helpers matching original Mongoose static methods ──────────────────
AppConfig.getConfig = async function (key) {
  return AppConfig.findOne({ where: { key, isActive: true } });
};

AppConfig.updateConfig = async function (key, value, adminId) {
  const [config, created] = await AppConfig.findOrCreate({
    where: { key },
    defaults: { value, updatedById: adminId },
  });
  if (!created) {
    await config.update({ value, updatedById: adminId });
  }
  return config;
};

module.exports = AppConfig;
