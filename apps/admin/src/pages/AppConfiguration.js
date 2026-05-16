import React, { useState, useEffect, useCallback } from "react";
import {
  FiSettings,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiDollarSign,
  FiShield,
  FiMail,
  FiGlobe,
  FiDatabase,
  FiEdit,
  FiEye,
  FiEyeOff,
  FiInfo,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";

const AppConfiguration = () => {
  const { hasActionPermission, isSuperAdmin } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("loan");
  const [showSensitive, setShowSensitive] = useState({});
  const [editMode, setEditMode] = useState({});
  const [tempValues, setTempValues] = useState({});

  const configTabs = [
    { id: "loan", label: "Loan Settings", icon: FiDollarSign },
    { id: "system", label: "System Settings", icon: FiSettings },
    { id: "security", label: "Security", icon: FiShield },
    { id: "email", label: "Email Configuration", icon: FiMail },
    { id: "api", label: "API Settings", icon: FiGlobe },
    { id: "database", label: "Database", icon: FiDatabase },
  ];

  const fetchConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getConfiguration();
      const configData = Array.isArray(response.data)
        ? response.data
        : Object.entries(response.config || {}).map(([key, value]) => ({ key, value }));

      // Transform array of config objects to categorized structure
      const categorizedConfig = {
        loan: {},
        system: {},
        security: {},
        email: {},
        api: {},
        database: {},
      };

      configData.forEach((config) => {
        const key = config.key;
        const value = config.value;

        // Categorize based on key prefixes or patterns
        if (
          key.includes("loan") ||
          key.includes("interest") ||
          key.includes("amount") ||
          key.includes("term")
        ) {
          categorizedConfig.loan[key] = value;
        } else if (
          key.includes("app") ||
          key.includes("system") ||
          key.includes("maintenance")
        ) {
          categorizedConfig.system[key] = value;
        } else if (
          key.includes("jwt") ||
          key.includes("password") ||
          key.includes("security") ||
          key.includes("auth")
        ) {
          categorizedConfig.security[key] = value;
        } else if (
          key.includes("smtp") ||
          key.includes("email") ||
          key.includes("mail")
        ) {
          categorizedConfig.email[key] = value;
        } else if (
          key.includes("api") ||
          key.includes("rate") ||
          key.includes("timeout")
        ) {
          categorizedConfig.api[key] = value;
        } else if (
          key.includes("db") ||
          key.includes("database") ||
          key.includes("connection") ||
          key.includes("pool")
        ) {
          categorizedConfig.database[key] = value;
        } else {
          // Default to system category for uncategorized items
          categorizedConfig.system[key] = value;
        }
      });

      setConfig(categorizedConfig);
    } catch (error) {
      console.error("Error fetching configuration:", error);
      showMessage("error", "Failed to fetch configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleSaveConfig = async (category, key, value) => {
    if (!isSuperAdmin() && !hasActionPermission("updateConfig")) {
      showMessage("error", "Insufficient permissions to update configuration");
      return;
    }

    try {
      setSaving(true);
      await apiService.updateConfig(key, value);

      // Update local state
      setConfig((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      }));

      setEditMode((prev) => ({ ...prev, [`${category}.${key}`]: false }));
      showMessage("success", "Configuration updated successfully");
    } catch (error) {
      console.error("Error updating configuration:", error);
      showMessage("error", "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleEditToggle = (category, key) => {
    const fieldKey = `${category}.${key}`;
    const isEditing = editMode[fieldKey];

    if (isEditing) {
      // Save the value
      const tempValue = tempValues[fieldKey];
      if (tempValue !== undefined) {
        handleSaveConfig(category, key, tempValue);
      }
    } else {
      // Enter edit mode
      setEditMode((prev) => ({ ...prev, [fieldKey]: true }));
      setTempValues((prev) => ({ ...prev, [fieldKey]: config[category][key] }));
    }
  };

  const handleInputChange = (category, key, value) => {
    const fieldKey = `${category}.${key}`;
    setTempValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const toggleSensitiveVisibility = (fieldKey) => {
    setShowSensitive((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const renderConfigField = (category, key, field) => {
    const fieldKey = `${category}.${key}`;
    const isEditing = editMode[fieldKey];
    const currentValue = isEditing
      ? tempValues[fieldKey]
      : config[category][key];
    const isSensitive = field.sensitive;
    const isVisible = showSensitive[fieldKey];
    const canEdit = isSuperAdmin() || hasActionPermission("updateConfig");

    return (
      <div
        key={key}
        className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <label className="text-sm font-semibold text-gray-700">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              {isSensitive && <FiShield size={12} className="text-amber-500" />}
            </div>
            {field.description && (
              <p className="text-xs text-gray-400 m-0">{field.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isSensitive && (
              <button
                onClick={() => toggleSensitiveVisibility(fieldKey)}
                title={isVisible ? "Hide" : "Show"}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                {isVisible ? <FiEyeOff size={13} /> : <FiEye size={13} />}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => handleEditToggle(category, key)}
                disabled={saving}
                title={isEditing ? "Save" : "Edit"}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
              >
                {isEditing ? <FiSave size={13} /> : <FiEdit size={13} />}
              </button>
            )}
          </div>
        </div>
        <div className="mt-3">
          {isEditing ? (
            <div>
              {field.type === "boolean" ? (
                <select
                  value={currentValue}
                  onChange={(e) =>
                    handleInputChange(category, key, e.target.value === "true")
                  }
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              ) : field.type === "number" ? (
                <input
                  type="number"
                  value={currentValue}
                  onChange={(e) =>
                    handleInputChange(category, key, parseFloat(e.target.value))
                  }
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              ) : field.type === "select" ? (
                <select
                  value={currentValue}
                  onChange={(e) =>
                    handleInputChange(category, key, e.target.value)
                  }
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={isSensitive && !isVisible ? "password" : "text"}
                  value={currentValue}
                  onChange={(e) =>
                    handleInputChange(category, key, e.target.value)
                  }
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              )}
            </div>
          ) : (
            <div>
              {field.type === "boolean" ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentValue ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                >
                  {currentValue ? "Enabled" : "Disabled"}
                </span>
              ) : isSensitive && !isVisible ? (
                <span className="text-sm text-gray-400 font-mono">
                  ••••••••
                </span>
              ) : (
                <span className="text-sm text-gray-700">
                  {field.type === "number" && field.unit
                    ? `${currentValue} ${field.unit}`
                    : String(currentValue ?? "")}
                </span>
              )}
            </div>
          )}
        </div>

        {field.warning && (
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-600">
            <FiAlertCircle size={12} />
            <span>{field.warning}</span>
          </div>
        )}
      </div>
    );
  };

  const renderConfigSection = (category, categoryConfig) => {
    if (!config[category]) return null;

    return (
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          {categoryConfig.description}
        </p>
        <div className="space-y-2">
          {Object.entries(categoryConfig.fields).map(([key, field]) =>
            renderConfigField(category, key, field),
          )}
        </div>
      </div>
    );
  };

  const configSchema = {
    loan: {
      title: "Loan Configuration",
      description:
        "Configure loan parameters, interest rates, and lending policies",
      fields: {
        minLoanAmount: {
          label: "Minimum Loan Amount",
          description: "The minimum amount that can be borrowed",
          type: "number",
          unit: "GHS",
          required: true,
          min: 0,
        },
        maxLoanAmount: {
          label: "Maximum Loan Amount",
          description: "The maximum amount that can be borrowed",
          type: "number",
          unit: "GHS",
          required: true,
          min: 0,
        },
        defaultInterestRate: {
          label: "Default Interest Rate",
          description: "Default annual interest rate for new loans",
          type: "number",
          unit: "%",
          required: true,
          min: 0,
          max: 100,
          step: 0.01,
        },
        maxLoanTerm: {
          label: "Maximum Loan Term",
          description: "Maximum loan duration in months",
          type: "number",
          unit: "months",
          required: true,
          min: 1,
        },
        processingFee: {
          label: "Processing Fee",
          description: "Fee charged for loan processing",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        autoApprovalLimit: {
          label: "Auto-Approval Limit",
          description: "Loans below this amount can be auto-approved",
          type: "number",
          unit: "GHS",
          min: 0,
        },
        requireCollateral: {
          label: "Require Collateral",
          description: "Whether collateral is required for loans",
          type: "boolean",
        },
      },
    },
    loanCalculations: {
      title: "Dynamic Loan Calculations",
      description:
        "Configure term-specific interest rates and fee structures for 7, 14, and 30-day loans",
      fields: {
        loan_7_days_interest_rate: {
          label: "7 Days - Interest Rate",
          description: "Interest rate for 7-day loans",
          type: "number",
          unit: "%",
          required: true,
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_7_days_service_fee: {
          label: "7 Days - Service Fee",
          description: "Service fee percentage for 7-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_7_days_admin_fee: {
          label: "7 Days - Admin Fee",
          description: "Administration fee percentage for 7-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_7_days_commitment_fee: {
          label: "7 Days - Commitment Fee",
          description: "Commitment fee percentage for 7-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_14_days_interest_rate: {
          label: "14 Days - Interest Rate",
          description: "Interest rate for 14-day loans",
          type: "number",
          unit: "%",
          required: true,
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_14_days_service_fee: {
          label: "14 Days - Service Fee",
          description: "Service fee percentage for 14-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_14_days_admin_fee: {
          label: "14 Days - Admin Fee",
          description: "Administration fee percentage for 14-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_14_days_commitment_fee: {
          label: "14 Days - Commitment Fee",
          description: "Commitment fee percentage for 14-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_30_days_interest_rate: {
          label: "30 Days - Interest Rate",
          description: "Interest rate for 30-day loans",
          type: "number",
          unit: "%",
          required: true,
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_30_days_service_fee: {
          label: "30 Days - Service Fee",
          description: "Service fee percentage for 30-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_30_days_admin_fee: {
          label: "30 Days - Admin Fee",
          description: "Administration fee percentage for 30-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
        loan_30_days_commitment_fee: {
          label: "30 Days - Commitment Fee",
          description: "Commitment fee percentage for 30-day loans",
          type: "number",
          unit: "%",
          min: 0,
          max: 100,
          step: 0.01,
        },
      },
    },
    contactInfo: {
      title: "Contact Information",
      description: "Configure customer support and company contact details",
      fields: {
        support_phone: {
          label: "Support Phone",
          description: "Primary customer support phone number",
          type: "text",
          required: true,
        },
        support_email: {
          label: "Support Email",
          description: "Customer support email address",
          type: "email",
          required: true,
        },
        support_whatsapp: {
          label: "WhatsApp Number",
          description: "WhatsApp support number",
          type: "text",
        },
        office_address: {
          label: "Office Address",
          description: "Physical office address",
          type: "textarea",
        },
        business_hours: {
          label: "Business Hours",
          description: "Operating hours for customer support",
          type: "text",
        },
        emergency_contact: {
          label: "Emergency Contact",
          description: "Emergency contact number",
          type: "text",
        },
      },
    },
    appBranding: {
      title: "App Branding & Identity",
      description:
        "Configure application branding, logos, and company information",
      fields: {
        app_name: {
          label: "Application Name",
          description: "The name of the mobile application",
          type: "text",
          required: true,
        },
        app_tagline: {
          label: "App Tagline",
          description: "Short tagline or slogan for the app",
          type: "text",
        },
        app_description: {
          label: "App Description",
          description: "Brief description of the application",
          type: "textarea",
        },
        company_name: {
          label: "Company Name",
          description: "Official company name",
          type: "text",
          required: true,
        },
        company_logo_url: {
          label: "Company Logo URL",
          description: "URL to the company logo image",
          type: "url",
        },
        app_version: {
          label: "App Version",
          description: "Current version of the application",
          type: "text",
        },
      },
    },
    system: {
      title: "System Configuration",
      description: "General system settings and application behavior",
      fields: {
        appName: {
          label: "Application Name",
          description: "The name of the application",
          type: "text",
          required: true,
        },
        maintenanceMode: {
          label: "Maintenance Mode",
          description: "Enable to put the application in maintenance mode",
          type: "boolean",
          warning: "Enabling this will make the app unavailable to users",
        },
        maxFileUploadSize: {
          label: "Max File Upload Size",
          description: "Maximum file size for uploads",
          type: "number",
          unit: "MB",
          min: 1,
          max: 100,
        },
        sessionTimeout: {
          label: "Session Timeout",
          description: "User session timeout duration",
          type: "number",
          unit: "minutes",
          min: 5,
          max: 1440,
        },
        enableNotifications: {
          label: "Enable Notifications",
          description: "Allow the system to send notifications",
          type: "boolean",
        },
        defaultLanguage: {
          label: "Default Language",
          description: "Default language for the application",
          type: "select",
          options: [
            { value: "en", label: "English" },
            { value: "tw", label: "Twi" },
            { value: "ga", label: "Ga" },
          ],
        },
      },
    },
    security: {
      title: "Security Settings",
      description: "Configure security policies and authentication settings",
      fields: {
        passwordMinLength: {
          label: "Minimum Password Length",
          description: "Minimum required password length",
          type: "number",
          min: 6,
          max: 50,
          required: true,
        },
        requirePasswordComplexity: {
          label: "Require Password Complexity",
          description: "Enforce complex password requirements",
          type: "boolean",
        },
        maxLoginAttempts: {
          label: "Max Login Attempts",
          description: "Maximum failed login attempts before lockout",
          type: "number",
          min: 3,
          max: 10,
        },
        lockoutDuration: {
          label: "Lockout Duration",
          description: "Account lockout duration after max attempts",
          type: "number",
          unit: "minutes",
          min: 5,
          max: 1440,
        },
        enableTwoFactor: {
          label: "Enable Two-Factor Authentication",
          description: "Require 2FA for admin accounts",
          type: "boolean",
        },
        jwtSecret: {
          label: "JWT Secret Key",
          description: "Secret key for JWT token signing",
          type: "text",
          sensitive: true,
          required: true,
          warning: "Changing this will invalidate all existing sessions",
        },
      },
    },
    email: {
      title: "Email Configuration",
      description: "Configure email service settings for notifications",
      fields: {
        smtpHost: {
          label: "SMTP Host",
          description: "SMTP server hostname",
          type: "text",
          required: true,
        },
        smtpPort: {
          label: "SMTP Port",
          description: "SMTP server port",
          type: "number",
          min: 1,
          max: 65535,
          required: true,
        },
        smtpUsername: {
          label: "SMTP Username",
          description: "SMTP authentication username",
          type: "text",
          sensitive: true,
        },
        smtpPassword: {
          label: "SMTP Password",
          description: "SMTP authentication password",
          type: "text",
          sensitive: true,
        },
        fromEmail: {
          label: "From Email Address",
          description: "Default sender email address",
          type: "text",
          required: true,
        },
        fromName: {
          label: "From Name",
          description: "Default sender name",
          type: "text",
          required: true,
        },
        enableSSL: {
          label: "Enable SSL/TLS",
          description: "Use SSL/TLS for SMTP connection",
          type: "boolean",
        },
      },
    },
    api: {
      title: "API Configuration",
      description: "Configure API settings and external service integrations",
      fields: {
        rateLimitWindow: {
          label: "Rate Limit Window",
          description: "Rate limiting time window",
          type: "number",
          unit: "minutes",
          min: 1,
          max: 60,
        },
        rateLimitMax: {
          label: "Rate Limit Max Requests",
          description: "Maximum requests per window",
          type: "number",
          min: 10,
          max: 10000,
        },
        enableCors: {
          label: "Enable CORS",
          description: "Allow cross-origin requests",
          type: "boolean",
        },
        corsOrigins: {
          label: "CORS Origins",
          description: "Allowed CORS origins (comma-separated)",
          type: "text",
          placeholder: "https://example.com, https://app.example.com",
        },
        apiVersion: {
          label: "API Version",
          description: "Current API version",
          type: "text",
          required: true,
        },
      },
    },
    database: {
      title: "Database Configuration",
      description: "Database connection and performance settings",
      fields: {
        connectionPoolSize: {
          label: "Connection Pool Size",
          description: "Maximum database connections in pool",
          type: "number",
          min: 5,
          max: 100,
        },
        queryTimeout: {
          label: "Query Timeout",
          description: "Database query timeout",
          type: "number",
          unit: "seconds",
          min: 5,
          max: 300,
        },
        enableQueryLogging: {
          label: "Enable Query Logging",
          description: "Log database queries for debugging",
          type: "boolean",
          warning: "This may impact performance and generate large logs",
        },
        backupRetentionDays: {
          label: "Backup Retention",
          description: "Number of days to retain database backups",
          type: "number",
          unit: "days",
          min: 1,
          max: 365,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading
          configuration...
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex flex-col items-center justify-center gap-3">
        <FiAlertCircle size={32} className="text-red-400" />
        <h3 className="text-base font-semibold text-gray-700">
          Failed to load configuration
        </h3>
        <button
          onClick={fetchConfiguration}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          <FiRefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiSettings size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Application Configuration
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage system settings and application behavior
            </p>
          </div>
          <button
            onClick={fetchConfiguration}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={`px-5 py-3 mb-5 rounded-xl text-sm border flex items-center gap-2 ${message.type === "error" ? "bg-red-50 text-red-700 border-red-200" : message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
        >
          {message.type === "success" && <FiCheckCircle size={14} />}
          {message.type === "error" && <FiAlertCircle size={14} />}
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {configTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeTab === tab.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        {configSchema[activeTab] &&
          renderConfigSection(activeTab, configSchema[activeTab])}
      </div>

      {!isSuperAdmin() && !hasActionPermission("updateConfig") && (
        <div className="flex items-center gap-3 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <FiShield size={14} className="flex-shrink-0" />
          <p className="m-0">
            You have read-only access to configuration settings. Contact a super
            admin to make changes.
          </p>
        </div>
      )}
    </div>
  );
};

export default AppConfiguration;
