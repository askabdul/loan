import React, { useState, useEffect } from 'react';
import {
  FiDollarSign,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiSettings,
  FiInfo
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

const LoanSettings = () => {
  const { hasActionPermission } = useAuth();
  const [settings, setSettings] = useState({
    minAmount: 0,
    maxAmount: 0,
    defaultCreditLimit: 0,
    autoApprovalLimit: 0,
    availableTerms: [7, 14, 30],
    requireCollateral: false,
    minCreditScore: 0,
    maxCreditScore: 1000,
    gracePeriodDays: 0,
    lateFeePercentage: 0,
    processingFeePercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState({});
  const [tempValues, setTempValues] = useState({});

  const settingsConfig = {
    minAmount: {
      label: 'Minimum Loan Amount',
      description: 'The minimum amount a user can borrow',
      type: 'number',
      unit: 'GHS',
      min: 0,
      step: 50
    },
    maxAmount: {
      label: 'Maximum Loan Amount',
      description: 'The maximum amount a user can borrow',
      type: 'number',
      unit: 'GHS',
      min: 0,
      step: 100
    },
    defaultCreditLimit: {
      label: 'Default Credit Limit',
      description: 'Default credit limit for new users',
      type: 'number',
      unit: 'GHS',
      min: 0,
      step: 100
    },
    autoApprovalLimit: {
      label: 'Auto Approval Limit',
      description: 'Loans below this amount are automatically approved',
      type: 'number',
      unit: 'GHS',
      min: 0,
      step: 100
    },
    minCreditScore: {
      label: 'Minimum Credit Score',
      description: 'Minimum credit score required for loan approval',
      type: 'number',
      min: 300,
      max: 850,
      step: 10
    },
    maxCreditScore: {
      label: 'Maximum Credit Score',
      description: 'Maximum possible credit score',
      type: 'number',
      min: 300,
      max: 1000,
      step: 10
    },
    gracePeriodDays: {
      label: 'Grace Period (Days)',
      description: 'Number of days after due date before late fees apply',
      type: 'number',
      min: 0,
      max: 30,
      step: 1
    },
    lateFeePercentage: {
      label: 'Late Fee Percentage',
      description: 'Percentage charged as late fee',
      type: 'number',
      unit: '%',
      min: 0,
      max: 50,
      step: 0.5
    },
    processingFeePercentage: {
      label: 'Processing Fee Percentage',
      description: 'Percentage charged as processing fee',
      type: 'number',
      unit: '%',
      min: 0,
      max: 10,
      step: 0.1
    },
    requireCollateral: {
      label: 'Require Collateral',
      description: 'Whether collateral is required for loans',
      type: 'boolean'
    }
  };

  useEffect(() => {
    fetchLoanSettings();
  }, []);

  const fetchLoanSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.getConfiguration();
      const configData = Array.isArray(response.data)
        ? response.data
        : Object.entries(response.config || {}).map(([key, value]) => ({ key, value }));
      
      // Transform config array to settings object
      const loanSettings = {
        minAmount: 0,
        maxAmount: 0,
        defaultCreditLimit: 0,
        autoApprovalLimit: 0,
        availableTerms: [7, 14, 30],
        requireCollateral: false,
        minCreditScore: 0,
        maxCreditScore: 1000,
        gracePeriodDays: 0,
        lateFeePercentage: 0,
        processingFeePercentage: 0
      };
      
      configData.forEach(config => {
        const key = config.key;
        const value = config.value;
        
        if (key === 'min_loan_amount') loanSettings.minAmount = value;
        else if (key === 'max_loan_amount') loanSettings.maxAmount = value;
        else if (key === 'default_credit_limit') loanSettings.defaultCreditLimit = value;
        else if (key === 'auto_approval_limit') loanSettings.autoApprovalLimit = value;
        else if (key === 'loan_terms_available') loanSettings.availableTerms = value;
        else if (key === 'require_collateral') loanSettings.requireCollateral = value;
        else if (key === 'min_credit_score') loanSettings.minCreditScore = value;
        else if (key === 'max_credit_score') loanSettings.maxCreditScore = value;
        else if (key === 'grace_period_days') loanSettings.gracePeriodDays = value;
        else if (key === 'late_fee_percentage') loanSettings.lateFeePercentage = value;
        else if (key === 'processing_fee_percentage') loanSettings.processingFeePercentage = value;
      });
      
      setSettings(loanSettings);
    } catch (error) {
      console.error('Error fetching loan settings:', error);
      showMessage('error', 'Failed to fetch loan settings');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleEdit = (key) => {
    setEditMode({ ...editMode, [key]: true });
    setTempValues({ ...tempValues, [key]: settings[key] });
  };

  const handleCancel = (key) => {
    setEditMode({ ...editMode, [key]: false });
    setTempValues({ ...tempValues, [key]: settings[key] });
  };

  const handleSave = async (key) => {
    if (!hasActionPermission('updateConfiguration')) {
      showMessage('error', 'You do not have permission to update configuration');
      return;
    }

    try {
      setSaving(true);
      const value = tempValues[key];
      
      // Map frontend keys to backend keys
      const keyMapping = {
        minAmount: 'min_loan_amount',
        maxAmount: 'max_loan_amount',
        defaultCreditLimit: 'default_credit_limit',
        autoApprovalLimit: 'auto_approval_limit',
        availableTerms: 'loan_terms_available',
        requireCollateral: 'require_collateral',
        minCreditScore: 'min_credit_score',
        maxCreditScore: 'max_credit_score',
        gracePeriodDays: 'grace_period_days',
        lateFeePercentage: 'late_fee_percentage',
        processingFeePercentage: 'processing_fee_percentage'
      };
      
      const backendKey = keyMapping[key] || key;
      
      await apiService.updateConfig(backendKey, value);
      
      setSettings({ ...settings, [key]: value });
      setEditMode({ ...editMode, [key]: false });
      showMessage('success', `${settingsConfig[key]?.label || key} updated successfully`);
    } catch (error) {
      console.error('Error updating setting:', error);
      showMessage('error', `Failed to update ${settingsConfig[key]?.label || key}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key, value) => {
    setTempValues({ ...tempValues, [key]: value });
  };

  const renderField = (key, config) => {
    const isEditing = editMode[key];
    const currentValue = isEditing ? tempValues[key] : settings[key];
    const canEdit = hasActionPermission('updateConfiguration');

    return (
      <div key={key} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <label className="text-sm font-semibold text-gray-700">{config.label}</label>
            {config.description && <p className="text-xs text-gray-400 m-0 mt-0.5">{config.description}</p>}
          </div>
          {!isEditing && canEdit && (
            <button onClick={() => handleEdit(key)} title="Edit"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
              <FiSettings size={13} />
            </button>
          )}
        </div>
        <div>
          {config.type === 'boolean' ? (
            <div>
              {isEditing ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={currentValue} onChange={(e) => handleInputChange(key, e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  <span className="text-sm text-gray-700">{currentValue ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${currentValue ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {currentValue ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          ) : (
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input type={config.type} value={currentValue}
                    onChange={(e) => handleInputChange(key, config.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    min={config.min} max={config.max} step={config.step}
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  {config.unit && <span className="text-sm text-gray-400">{config.unit}</span>}
                </div>
              ) : (
                <span className="text-sm text-gray-700 font-medium">
                  {config.type === 'number' ? currentValue?.toLocaleString() : currentValue}{config.unit && ` ${config.unit}`}
                </span>
              )}
            </div>
          )}
          {isEditing && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleSave(key)} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                <FiSave size={13} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => handleCancel(key)} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading loan settings...
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
            <FiDollarSign size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Loan Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Configure loan parameters and limits</p>
          </div>
          <button onClick={fetchLoanSettings} disabled={loading} title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {message.type === 'success' ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {[
          { title: 'Loan Limits', desc: 'Configure minimum and maximum loan amounts', keys: ['minAmount', 'maxAmount', 'defaultCreditLimit', 'autoApprovalLimit'] },
          { title: 'Credit Requirements', desc: 'Configure credit score requirements', keys: ['minCreditScore', 'maxCreditScore', 'requireCollateral'] },
          { title: 'Fees & Penalties', desc: 'Configure fees and penalty settings', keys: ['processingFeePercentage', 'lateFeePercentage', 'gracePeriodDays'] },
        ].map(({ title, desc, keys }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-xs text-gray-400 mb-4">{desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {keys.map(key => renderField(key, settingsConfig[key]))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

};

export default LoanSettings;
