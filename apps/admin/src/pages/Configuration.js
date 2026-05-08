import React, { useState, useEffect } from "react";
import {
  FiSave,
  FiRefreshCw,
  FiSettings,
  FiDollarSign,
  FiPercent,
  FiClock,
  FiShield,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";
import websocketService from "../services/websocket";

const Configuration = () => {
  const { hasActionPermission } = useAuth();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("loan-settings");

  useEffect(() => {
    fetchConfiguration();

    // Set up WebSocket listener for configuration updates
    websocketService.on("config_updated", (data) => {
      setConfig(data.config);
      setMessage({
        type: "info",
        text: "Configuration updated by another admin.",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    });

    return () => {
      websocketService.off("config_updated");
    };
  }, []);

  const fetchConfiguration = async () => {
    try {
      setLoading(true);
      const data = await apiService.getConfiguration();
      setConfig(data.config || getDefaultConfiguration());
    } catch (error) {
      console.error("Error fetching configuration:", error);
      // Fallback to default configuration
      setConfig(getDefaultConfiguration());
      setMessage({
        type: "error",
        text: "Failed to load configuration. Using default values.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDefaultConfiguration = () => {
    return {
      loanSettings: {
        minLoanAmount: 500,
        maxLoanAmount: 50000,
        defaultInterestRate: 15,
        minInterestRate: 8,
        maxInterestRate: 25,
        minLoanTerm: 1,
        maxLoanTerm: 36,
        processingFee: 2.5,
        lateFeePercentage: 5,
        gracePeriodDays: 3,
      },
      creditSettings: {
        minCreditScore: 300,
        maxCreditScore: 850,
        lowRiskThreshold: 700,
        mediumRiskThreshold: 600,
        autoApprovalThreshold: 750,
        autoApprovalMaxAmount: 10000,
      },
      systemSettings: {
        maintenanceMode: false,
        allowNewRegistrations: true,
        requireKYCVerification: true,
        maxDailyApplications: 100,
        sessionTimeoutMinutes: 30,
        passwordExpiryDays: 90,
      },
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        reminderDaysBefore: 3,
        overdueReminderInterval: 7,
      },
      paymentSettings: {
        allowedPaymentMethods: ["mobile_money", "bank_transfer", "card"],
        autoDebitEnabled: true,
        paymentGatewayFee: 1.5,
        refundProcessingDays: 5,
      },
    };
  };

  const handleConfigChange = (section, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true);
      await apiService.updateConfiguration(config);
      setMessage({
        type: "success",
        text: "Configuration saved successfully!",
      });

      // Emit WebSocket event for real-time updates
      websocketService.emit("config_update", { config });
    } catch (error) {
      console.error("Error saving configuration:", error);
      setMessage({
        type: "error",
        text: "Error occurred while saving configuration",
      });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const resetToDefaults = () => {
    setConfig(getDefaultConfiguration());
    setMessage({
      type: "info",
      text: "Configuration reset to defaults. Remember to save changes.",
    });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const tabs = [
    { id: "loan-settings", label: "Loan Settings", icon: <FiDollarSign /> },
    { id: "credit-settings", label: "Credit Settings", icon: <FiShield /> },
    { id: "system-settings", label: "System Settings", icon: <FiSettings /> },
    { id: "notification-settings", label: "Notifications", icon: <FiClock /> },
    { id: "payment-settings", label: "Payment Settings", icon: <FiPercent /> },
  ];

  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

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
              System Configuration
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage platform-wide settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActionPermission("editConfig") && (
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              <FiRefreshCw size={13} /> Reset Defaults
            </button>
          )}
          {hasActionPermission("editConfig") && (
            <button
              onClick={handleSaveConfiguration}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <FiSave size={13} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div
          className={`px-5 py-3 mb-5 rounded-xl text-sm border ${message.type === "error" ? "bg-red-50 text-red-700 border-red-200" : message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
        >
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeTab === tab.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        {activeTab === "loan-settings" && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Loan Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: "Min Loan Amount (GHS)",
                  field: "minLoanAmount",
                  step: 1,
                },
                {
                  label: "Max Loan Amount (GHS)",
                  field: "maxLoanAmount",
                  step: 1,
                },
                {
                  label: "Default Interest Rate (%)",
                  field: "defaultInterestRate",
                  step: 0.1,
                },
                {
                  label: "Min Interest Rate (%)",
                  field: "minInterestRate",
                  step: 0.1,
                },
                {
                  label: "Max Interest Rate (%)",
                  field: "maxInterestRate",
                  step: 0.1,
                },
                {
                  label: "Min Loan Term (months)",
                  field: "minLoanTerm",
                  step: 1,
                },
                {
                  label: "Max Loan Term (months)",
                  field: "maxLoanTerm",
                  step: 1,
                },
                {
                  label: "Processing Fee (%)",
                  field: "processingFee",
                  step: 0.1,
                },
                {
                  label: "Late Fee (%)",
                  field: "lateFeePercentage",
                  step: 0.1,
                },
                {
                  label: "Grace Period (days)",
                  field: "gracePeriodDays",
                  step: 1,
                },
              ].map(({ label, field, step }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="number"
                    step={step}
                    value={config.loanSettings?.[field] || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "loanSettings",
                        field,
                        step === 1
                          ? parseInt(e.target.value)
                          : parseFloat(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "credit-settings" && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Credit Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Min Credit Score", field: "minCreditScore" },
                { label: "Max Credit Score", field: "maxCreditScore" },
                { label: "Low Risk Threshold", field: "lowRiskThreshold" },
                {
                  label: "Medium Risk Threshold",
                  field: "mediumRiskThreshold",
                },
                {
                  label: "Auto Approval Threshold",
                  field: "autoApprovalThreshold",
                },
                {
                  label: "Auto Approval Max Amount (GHS)",
                  field: "autoApprovalMaxAmount",
                },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={config.creditSettings?.[field] || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "creditSettings",
                        field,
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "system-settings" && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              System Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              {[
                { label: "Maintenance Mode", field: "maintenanceMode" },
                {
                  label: "Allow New Registrations",
                  field: "allowNewRegistrations",
                },
                {
                  label: "Require KYC Verification",
                  field: "requireKYCVerification",
                },
              ].map(({ label, field }) => (
                <label
                  key={field}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={config.systemSettings?.[field] || false}
                    onChange={(e) =>
                      handleConfigChange(
                        "systemSettings",
                        field,
                        e.target.checked,
                      )
                    }
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: "Max Daily Applications",
                  field: "maxDailyApplications",
                },
                {
                  label: "Session Timeout (minutes)",
                  field: "sessionTimeoutMinutes",
                },
                {
                  label: "Password Expiry (days)",
                  field: "passwordExpiryDays",
                },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={config.systemSettings?.[field] || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "systemSettings",
                        field,
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "notification-settings" && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Notification Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              {[
                { label: "Email Notifications", field: "emailNotifications" },
                { label: "SMS Notifications", field: "smsNotifications" },
                { label: "Push Notifications", field: "pushNotifications" },
              ].map(({ label, field }) => (
                <label
                  key={field}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={config.notificationSettings?.[field] || false}
                    onChange={(e) =>
                      handleConfigChange(
                        "notificationSettings",
                        field,
                        e.target.checked,
                      )
                    }
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  label: "Reminder Days Before Due",
                  field: "reminderDaysBefore",
                },
                {
                  label: "Overdue Reminder Interval (days)",
                  field: "overdueReminderInterval",
                },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={config.notificationSettings?.[field] || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "notificationSettings",
                        field,
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "payment-settings" && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Payment Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
                <input
                  type="checkbox"
                  checked={config.paymentSettings?.autoDebitEnabled || false}
                  onChange={(e) =>
                    handleConfigChange(
                      "paymentSettings",
                      "autoDebitEnabled",
                      e.target.checked,
                    )
                  }
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  Auto Debit Enabled
                </span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              {[
                {
                  label: "Payment Gateway Fee (%)",
                  field: "paymentGatewayFee",
                  step: 0.1,
                },
                {
                  label: "Refund Processing Days",
                  field: "refundProcessingDays",
                  step: 1,
                },
              ].map(({ label, field, step }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="number"
                    step={step}
                    value={config.paymentSettings?.[field] || ""}
                    onChange={(e) =>
                      handleConfigChange(
                        "paymentSettings",
                        field,
                        step === 1
                          ? parseInt(e.target.value)
                          : parseFloat(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Allowed Payment Methods
              </p>
              <div className="flex flex-wrap gap-3">
                {["mobile_money", "bank_transfer", "card"].map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={
                        config.paymentSettings?.allowedPaymentMethods?.includes(
                          method,
                        ) || false
                      }
                      onChange={(e) => {
                        const methods =
                          config.paymentSettings?.allowedPaymentMethods || [];
                        handleConfigChange(
                          "paymentSettings",
                          "allowedPaymentMethods",
                          e.target.checked
                            ? [...methods, method]
                            : methods.filter((m) => m !== method),
                        );
                      }}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {method
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;
