const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_LOAN_LIFECYCLE_SETTINGS = {
  autoDisburseOnApproval: true,
  activateLoanOnDisbursement: true,
  overdueDayCountMode: "calendar_midnight",
  loanExtensionDailyFeeRate: 0.02,
  maxExtensionDaysPerRequest: 30,
  maxExtensionCount: 3,
  maxOverdueDaysForExtension: 30,
  reserveReleaseDays: 10,
  dashboardRefreshIntervalSeconds: 60,
  dashboardCacheTtlSeconds: 30,
};

const SETTINGS_CACHE_TTL_MS = 15 * 1000;
let runtimeSettingsCache = null;
let runtimeSettingsCacheAt = 0;

const normalizeBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized))
      return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized))
      return false;
  }
  return fallback;
};

const normalizeMode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "elapsed_24h") return "elapsed_24h";
  return "calendar_midnight";
};

const normalizeNumber = (value, fallback, { min, max } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  let normalized = parsed;
  if (typeof min === "number") normalized = Math.max(min, normalized);
  if (typeof max === "number") normalized = Math.min(max, normalized);
  return normalized;
};

const startOfDay = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateOverdueDays = ({ dueDate, now = new Date(), mode }) => {
  if (!dueDate) return 0;

  const dueDateObject = new Date(dueDate);
  const nowObject = new Date(now);
  if (Number.isNaN(dueDateObject.getTime()) || Number.isNaN(nowObject.getTime())) {
    return 0;
  }

  if (nowObject < dueDateObject) return 0;

  const effectiveMode = normalizeMode(mode);
  if (effectiveMode === "elapsed_24h") {
    return Math.max(1, Math.ceil((nowObject - dueDateObject) / ONE_DAY_MS));
  }

  const nowStart = startOfDay(nowObject);
  const dueStart = startOfDay(dueDateObject);
  const calendarDays = Math.floor((nowStart - dueStart) / ONE_DAY_MS);
  return Math.max(1, calendarDays);
};

const getLoanLifecycleSettings = async () => {
  const settings = await getPlatformRuntimeSettings();

  return {
    autoDisburseOnApproval: settings.autoDisburseOnApproval,
    activateLoanOnDisbursement: settings.activateLoanOnDisbursement,
    overdueDayCountMode: settings.overdueDayCountMode,
  };
};

const getPlatformRuntimeSettings = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (
    !forceRefresh &&
    runtimeSettingsCache &&
    now - runtimeSettingsCacheAt < SETTINGS_CACHE_TTL_MS
  ) {
    return runtimeSettingsCache;
  }

  const { AppConfig } = require("../models");

  const [
    autoDisburseConfig,
    activateOnDisbursementConfig,
    overdueModeConfig,
    extensionDailyRateConfig,
    maxExtensionDaysConfig,
    maxExtensionCountConfig,
    maxOverdueExtensionDaysConfig,
    reserveReleaseDaysConfig,
    dashboardRefreshIntervalConfig,
    dashboardCacheTtlConfig,
  ] = await Promise.all([
    AppConfig.getConfig("auto_disburse_on_approval"),
    AppConfig.getConfig("activate_loan_on_disbursement"),
    AppConfig.getConfig("overdue_day_count_mode"),
    AppConfig.getConfig("loan_extension_daily_fee_rate"),
    AppConfig.getConfig("max_extension_days_per_request"),
    AppConfig.getConfig("max_extension_count"),
    AppConfig.getConfig("max_overdue_days_for_extension"),
    AppConfig.getConfig("reserve_release_days"),
    AppConfig.getConfig("dashboard_refresh_interval_seconds"),
    AppConfig.getConfig("dashboard_cache_ttl_seconds"),
  ]);

  runtimeSettingsCache = {
    autoDisburseOnApproval: normalizeBoolean(
      autoDisburseConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.autoDisburseOnApproval,
    ),
    activateLoanOnDisbursement: normalizeBoolean(
      activateOnDisbursementConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.activateLoanOnDisbursement,
    ),
    overdueDayCountMode: normalizeMode(
      overdueModeConfig?.value ||
        DEFAULT_LOAN_LIFECYCLE_SETTINGS.overdueDayCountMode,
    ),
    loanExtensionDailyFeeRate: normalizeNumber(
      extensionDailyRateConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.loanExtensionDailyFeeRate,
      { min: 0, max: 1 },
    ),
    maxExtensionDaysPerRequest: normalizeNumber(
      maxExtensionDaysConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.maxExtensionDaysPerRequest,
      { min: 1, max: 365 },
    ),
    maxExtensionCount: normalizeNumber(
      maxExtensionCountConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.maxExtensionCount,
      { min: 1, max: 20 },
    ),
    maxOverdueDaysForExtension: normalizeNumber(
      maxOverdueExtensionDaysConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.maxOverdueDaysForExtension,
      { min: 0, max: 3650 },
    ),
    reserveReleaseDays: normalizeNumber(
      reserveReleaseDaysConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.reserveReleaseDays,
      { min: 1, max: 365 },
    ),
    dashboardRefreshIntervalSeconds: normalizeNumber(
      dashboardRefreshIntervalConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.dashboardRefreshIntervalSeconds,
      { min: 10, max: 3600 },
    ),
    dashboardCacheTtlSeconds: normalizeNumber(
      dashboardCacheTtlConfig?.value,
      DEFAULT_LOAN_LIFECYCLE_SETTINGS.dashboardCacheTtlSeconds,
      { min: 5, max: 600 },
    ),
  };
  runtimeSettingsCacheAt = now;

  return runtimeSettingsCache;
};

module.exports = {
  DEFAULT_LOAN_LIFECYCLE_SETTINGS,
  getPlatformRuntimeSettings,
  getLoanLifecycleSettings,
  calculateOverdueDays,
};
