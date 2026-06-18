import React, { useState, useEffect } from 'react';
import {
  FiPercent,
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiActivity,
  FiEdit3,
  FiDollarSign,
  FiClock,
  FiTrendingUp,
  FiSettings,
  FiShield,
  FiToggleLeft,
  FiToggleRight
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

const LoanRateCalculation = () => {
  const { hasActionPermission, hasMenuAccess, hasSubMenuAccess } = useAuth();

  const extractLoanTerms = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.rows)) return response.data.rows;
    return [];
  };

  const mapFeeValue = (term, keys) => {
    for (const key of keys) {
      const value = term?.[key];
      if (value !== undefined && value !== null && value !== "") {
        return Number(value) || 0;
      }
    }
    return 0;
  };
  
  // All hooks must be called before any conditional returns
  const [rates, setRates] = useState({
    7: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true },
    14: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true },
    30: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true },
    60: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true },
    90: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true },
    180: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: true }
  });
  const [loanTerms, setLoanTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState({});
  const [tempValues, setTempValues] = useState({});
  const [calculatorData, setCalculatorData] = useState({
    amount: 1000,
    term: 7
  });
  const [calculationResult, setCalculationResult] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // All useEffect hooks must also be declared before conditional returns
  useEffect(() => {
    fetchLoanRates();
    fetchLoanTerms();
  }, []);

  useEffect(() => {
    calculateLoan();
  }, [calculatorData, rates]);

  // Check permissions after all hooks are declared
  if (!hasMenuAccess('appConfiguration') || !hasSubMenuAccess('appConfiguration', 'loanRateCalculation')) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex flex-col items-center justify-center gap-3">
        <FiShield size={40} className="text-gray-400" />
        <p className="text-sm text-gray-500">You don't have permission to access this page.</p>
      </div>
    );
  }

  const termLabels = {
    7: '7 Days',
    14: '14 Days',
    30: '30 Days',
    60: '60 Days',
    90: '90 Days',
    180: '180 Days'
  };

  const fetchLoanRates = async () => {
    try {
      setLoading(true);
      
      // Fetch loan terms directly from the database
      const response = await apiService.get('/loan-terms/admin');
      const loanTermsData = extractLoanTerms(response);
      setLoanTerms(loanTermsData);
      
      // Initialize rates object
      const loanRates = {};
      
      // Populate rates from loan terms data
      loanTermsData.forEach(term => {
        const termDays = Number(term.durationDays);
        loanRates[termDays] = {
          interestRate: Number(term.interestRate) || 0,
          processingFee: mapFeeValue(term, ['administrationFeePct', 'processingFeeRate']),
          serviceFee: mapFeeValue(term, ['serviceFeePct', 'serviceFeeRate']),
          commitmentFee: mapFeeValue(term, ['commitmentFeePct', 'commitmentFeeRate']),
          lateFee: 0, // Not stored in LoanTerm model, keeping for compatibility
          enabled: Boolean(term.enabled)
        };
      });
      
      // Ensure we have entries for common terms even if not in database
      const commonTerms = [7, 14, 30, 60, 90, 180];
      commonTerms.forEach(termDays => {
        if (!loanRates[termDays]) {
          loanRates[termDays] = {
            interestRate: 0,
            processingFee: 0,
            serviceFee: 0,
            commitmentFee: 0,
            lateFee: 0,
            enabled: false
          };
        }
      });
      
      setRates(loanRates);
    } catch (error) {
      console.error('Error fetching loan rates:', error);
      showMessage('error', 'Failed to fetch loan rates');
      
      // Fallback to empty rates if fetch fails
      const fallbackRates = {
        7: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false },
        14: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false },
        30: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false },
        60: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false },
        90: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false },
        180: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0, lateFee: 0, enabled: false }
      };
      setRates(fallbackRates);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanTerms = async () => {
    try {
      const response = await apiService.get('/loan-terms/admin');
      setLoanTerms(extractLoanTerms(response));
    } catch (error) {
      console.error('Error fetching loan terms:', error);
      showMessage('error', 'Failed to fetch loan terms');
    }
  };

  const handleToggleTerm = async (termDays, enabled) => {
    try {
      // Find the loan term by duration
      const loanTerm = loanTerms.find(term => term.durationDays === parseInt(termDays));
      if (!loanTerm) {
        showMessage('error', 'Loan term not found');
        return;
      }

      await apiService.toggleLoanTerm(loanTerm.id);
      showMessage('success', `${termDays}-day loan term ${!enabled ? 'enabled' : 'disabled'} successfully`);
      
      // Update local state
      setRates(prev => ({
        ...prev,
        [termDays]: {
          ...prev[termDays],
          enabled: !enabled
        }
      }));
      
      // Refresh data
      fetchLoanTerms();
    } catch (error) {
      console.error('Error toggling loan term:', error);
      showMessage('error', 'Failed to toggle loan term');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleEdit = (term, field) => {
    const key = `${term}_${field}`;
    setEditMode({ ...editMode, [key]: true });
    setTempValues({ ...tempValues, [key]: rates[term][field] });
  };

  const handleCancel = (term, field) => {
    const key = `${term}_${field}`;
    setEditMode({ ...editMode, [key]: false });
    setTempValues({ ...tempValues, [key]: rates[term][field] });
  };

  const handleSave = async (term, field) => {
    if (!hasActionPermission('updateConfiguration')) {
      showMessage('error', 'You do not have permission to update configuration');
      return;
    }

    try {
      setSaving(true);
      const key = `${term}_${field}`;
      const value = tempValues[key];
      
      // Find the loan term by duration
      const loanTerm = loanTerms.find(t => t.durationDays === parseInt(term));
      if (!loanTerm) {
        showMessage('error', 'Loan term not found');
        return;
      }
      
      // Map field names to LoanTerm model fields
      const fieldMapping = {
        'interestRate': 'interestRate',
        'processingFee': 'administrationFeePct',
        'serviceFee': 'serviceFeePct',
        'commitmentFee': 'commitmentFeePct'
      };
      
      const updateData = {
        [fieldMapping[field]]: value
      };
      
      await apiService.updateLoanTerm(loanTerm.id, updateData);
      
      setRates({
        ...rates,
        [term]: {
          ...rates[term],
          [field]: value
        }
      });
      
      setEditMode({ ...editMode, [key]: false });
      showMessage('success', `${field} for ${term} days updated successfully`);
      
      // Refresh loan terms data
      fetchLoanTerms();
    } catch (error) {
      console.error('Error updating rate:', error);
      showMessage('error', `Failed to update ${field} for ${term} days`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!hasActionPermission('updateConfiguration')) {
      showMessage('error', 'You do not have permission to update configuration');
      return;
    }

    try {
      setSavingAll(true);
      
      // Prepare loan term updates
      const loanTermUpdates = [];
      
      Object.keys(rates).forEach(term => {
        const termRates = rates[term];
        
        // Find the loan term by duration
        const loanTerm = loanTerms.find(t => t.durationDays === parseInt(term));
        if (loanTerm) {
          const updateData = {
            interestRate: termRates.interestRate,
            administrationFeePct: termRates.processingFee,
            serviceFeePct: termRates.serviceFee,
            commitmentFeePct: termRates.commitmentFee
            // Note: lateFee is not stored in LoanTerm model
          };
          
          loanTermUpdates.push(
            apiService.updateLoanTerm(loanTerm.id, updateData)
          );
        }
      });
      
      // Update all loan terms
      await Promise.all(loanTermUpdates);
      
      // Clear any edit modes
      setEditMode({});
      setTempValues({});
      
      showMessage('success', 'All loan rates and fees saved successfully!');
      
      // Refresh loan terms data
      fetchLoanTerms();
    } catch (error) {
      console.error('Error saving all rates:', error);
      showMessage('error', 'Failed to save some rates. Please try again.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleInputChange = (key, value) => {
    setTempValues({ ...tempValues, [key]: parseFloat(value) || 0 });
  };

  const calculateLoan = () => {
    const { amount, term } = calculatorData;
    const termRates = rates[term];
    
    if (!termRates) return;
    
    const interestAmount = (amount * termRates.interestRate) / 100;
    const processingFeeAmount = (amount * termRates.processingFee) / 100;
    const serviceFeeAmount = (amount * termRates.serviceFee) / 100;
    const commitmentFeeAmount = (amount * termRates.commitmentFee) / 100;
    const totalAmount = amount + interestAmount + processingFeeAmount + serviceFeeAmount + commitmentFeeAmount;
    const lateFeeAmount = (amount * termRates.lateFee) / 100;
    
    setCalculationResult({
      principal: amount,
      interestAmount,
      processingFeeAmount,
      serviceFeeAmount,
      commitmentFeeAmount,
      totalAmount,
      lateFeeAmount,
      term
    });
  };

  const renderRateField = (term, field, label, icon) => {
    const key = `${term}_${field}`;
    const isEditing = editMode[key];
    const currentValue = isEditing ? tempValues[key] : rates[term][field];
    const canEdit = hasActionPermission('updateConfiguration');

    return (
      <div key={`${term}_${field}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icon}</span>
          <span className="text-xs text-gray-600">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <input type="number" value={currentValue} onChange={(e) => handleInputChange(key, e.target.value)} min="0" max="100" step="0.1"
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
              <span className="text-xs text-gray-400">%</span>
              <button onClick={() => handleSave(term, field)} disabled={saving}
                className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={() => handleCancel(term, field)} disabled={saving}
                className="px-2 py-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                ✕
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-gray-700">{currentValue.toFixed(2)}%</span>
              {canEdit && (
                <button onClick={() => handleEdit(term, field)} title="Edit"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                  <FiEdit3 size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading loan rates...
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
            <FiPercent size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Loan Rate Calculation</h1>
            <p className="text-xs text-gray-400 mt-0.5">Configure interest rates and fees for different loan terms</p>
          </div>
          <button onClick={fetchLoanRates} disabled={loading} title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {hasActionPermission('updateConfiguration') && (
          <button onClick={handleSaveAll} disabled={savingAll || loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
            <FiSave size={13} /> {savingAll ? 'Saving All...' : 'Save All'}
          </button>
        )}
      </div>

      {message.text && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {message.type === 'success' ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Rate cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(rates).map(([term, termRates]) => (
            <div key={term} className={`bg-white border rounded-xl p-4 ${!termRates.enabled ? 'opacity-60' : ''} border-gray-200`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiClock size={14} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-gray-800 m-0">{termLabels[term]}</h3>
                </div>
                <button onClick={() => handleToggleTerm(term, termRates.enabled)} title={`${termRates.enabled ? 'Disable' : 'Enable'}`}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition ${termRates.enabled ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
                  {termRates.enabled ? <FiToggleRight size={15} /> : <FiToggleLeft size={15} />}
                </button>
              </div>
              <div className="space-y-1">
                {renderRateField(term, 'interestRate', 'Interest Rate', <FiTrendingUp size={13} />)}
                {renderRateField(term, 'processingFee', 'Processing Fee', <FiDollarSign size={13} />)}
                {renderRateField(term, 'serviceFee', 'Service Fee', <FiSettings size={13} />)}
                {renderRateField(term, 'commitmentFee', 'Commitment Fee', <FiShield size={13} />)}
                {renderRateField(term, 'lateFee', 'Late Fee', <FiAlertCircle size={13} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Calculator */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FiActivity size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-gray-800 m-0">Loan Calculator</h3>
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Loan Amount (GHS)</label>
              <input type="number" value={calculatorData.amount} onChange={(e) => setCalculatorData({...calculatorData, amount: parseFloat(e.target.value) || 0})} min="0" step="50"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Loan Term</label>
              <select value={calculatorData.term} onChange={(e) => setCalculatorData({...calculatorData, term: parseInt(e.target.value)})}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {Object.entries(termLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          {calculationResult && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Calculation Result</p>
              {[
                { label: 'Principal', value: `GHS ${calculationResult.principal.toLocaleString()}` },
                { label: `Interest (${rates[calculationResult.term].interestRate}%)`, value: `GHS ${calculationResult.interestAmount.toLocaleString()}` },
                { label: `Processing (${rates[calculationResult.term].processingFee}%)`, value: `GHS ${calculationResult.processingFeeAmount.toLocaleString()}` },
                { label: `Service (${rates[calculationResult.term].serviceFee}%)`, value: `GHS ${calculationResult.serviceFeeAmount.toLocaleString()}` },
                { label: `Commitment (${rates[calculationResult.term].commitmentFee}%)`, value: `GHS ${calculationResult.commitmentFeeAmount.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-700 font-medium">{value}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="font-bold text-gray-700">Total</span>
                <span className="font-bold text-blue-600">GHS {calculationResult.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanRateCalculation;
