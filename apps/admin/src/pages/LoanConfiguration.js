import React, { useState, useEffect } from 'react';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSave,
  FiX,
  FiToggleLeft,
  FiToggleRight,
  FiUsers,
  FiLayers,
  FiDollarSign,
  FiCalendar,
  FiPercent,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

const LoanConfiguration = () => {
  const { hasActionPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('terms');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Loan Terms State
  const [loanTerms, setLoanTerms] = useState([]);
  const [editingTerm, setEditingTerm] = useState(null);
  const [showTermForm, setShowTermForm] = useState(false);
  const [termForm, setTermForm] = useState({
    termId: '',
    displayName: '',
    durationDays: '',
    interestRate: '',
    serviceFeeRate: '',
    processingFeeRate: '',
    commitmentFeeRate: '',
    minAmount: '',
    maxAmount: '',
    isActive: true
  });
  
  // Loan Levels State
  const [loanLevels, setLoanLevels] = useState([]);
  const [editingLevel, setEditingLevel] = useState(null);
  const [showLevelForm, setShowLevelForm] = useState(false);
  const [levelForm, setLevelForm] = useState({
    name: '',
    levelNumber: '',
    minAmount: '',
    maxAmount: '',
    interestRate: '',
    serviceFee: '',
    processingFee: '',
    commitmentFee: '',
    allowedTerms: [],
    autoApprovalLimit: '',
    isActive: true
  });

  const tabs = [
    { id: 'terms', label: 'Loan Terms', icon: FiCalendar },
    { id: 'levels', label: 'Loan Levels', icon: FiLayers }
  ];

  useEffect(() => {
    fetchLoanTerms();
    fetchLoanLevels();
  }, []);

  const fetchLoanTerms = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/loan-terms/admin');
      // The admin endpoint returns paginated data with structure: {success, data: [...], count, total, pages}
      setLoanTerms(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching loan terms:', error);
      showMessage('error', 'Failed to fetch loan terms');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanLevels = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllLevels();
  
      setLoanLevels(response.data?.levels || []);
    } catch (error) {
      console.error('Error fetching loan levels:', error);
      showMessage('error', 'Failed to fetch loan levels');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Loan Terms Functions
  const handleTermSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        termId: termForm.termId,
        displayName: termForm.displayName,
        durationDays: Number(termForm.durationDays),
        interestRate: termForm.interestRate === '' ? null : Number(termForm.interestRate),
        serviceFeePct: termForm.serviceFeeRate === '' ? null : Number(termForm.serviceFeeRate),
        administrationFeePct: termForm.processingFeeRate === '' ? null : Number(termForm.processingFeeRate),
        commitmentFeePct: termForm.commitmentFeeRate === '' ? null : Number(termForm.commitmentFeeRate),
        enabled: !!termForm.isActive,
      };

      if (editingTerm) {
        await apiService.put(`/loan-terms/${editingTerm.id}`, payload);
        showMessage('success', 'Loan term updated successfully');
      } else {
        await apiService.post('/loan-terms', payload);
        showMessage('success', 'Loan term created successfully');
      }
      resetTermForm();
      fetchLoanTerms();
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to save loan term');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTerm = (term) => {
    setEditingTerm(term);
    setTermForm({
      termId: term.termId || '',
      displayName: term.displayName || term.name || '',
      durationDays: term.durationDays,
      interestRate: term.interestRate,
      serviceFeeRate: term.serviceFeePct || term.serviceFeeRate || '',
      processingFeeRate: term.administrationFeePct || term.processingFeeRate || '',
      commitmentFeeRate: term.commitmentFeePct || term.commitmentFeeRate || '',
      minAmount: term.minAmount || '',
      maxAmount: term.maxAmount || '',
      isActive: term.enabled
    });
    setShowTermForm(true);
  };

  const handleDeleteTerm = async (termId) => {
    try {
      setLoading(true);
      await apiService.delete(`/loan-terms/${termId}`);
      showMessage('success', 'Loan term deleted successfully');
      fetchLoanTerms();
    } catch (error) {
      showMessage('error', 'Failed to delete loan term');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTerm = async (termId, enabled) => {
    try {
      await apiService.patch(`/loan-terms/${termId}/toggle`, { enabled: !enabled });
      showMessage('success', `Loan term ${!enabled ? 'enabled' : 'disabled'} successfully`);
      fetchLoanTerms();
    } catch (error) {
      showMessage('error', 'Failed to toggle loan term');
    }
  };

  const resetTermForm = () => {
    setTermForm({
      termId: '',
      displayName: '',
      durationDays: '',
      interestRate: '',
      serviceFeeRate: '',
      processingFeeRate: '',
      commitmentFeeRate: '',
      minAmount: '',
      maxAmount: '',
      isActive: true
    });
    setEditingTerm(null);
    setShowTermForm(false);
  };

  // Loan Levels Functions
  const handleLevelSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        name: levelForm.name,
        level: Number(levelForm.levelNumber),
        minAmount: Number(levelForm.minAmount),
        maxAmount: Number(levelForm.maxAmount),
        interestRate: levelForm.interestRate === '' ? 0 : Number(levelForm.interestRate),
        serviceFeePct: levelForm.serviceFee === '' ? 0 : Number(levelForm.serviceFee),
        administrationFeePct: levelForm.processingFee === '' ? 0 : Number(levelForm.processingFee),
        commitmentFeePct: levelForm.commitmentFee === '' ? 0 : Number(levelForm.commitmentFee),
        autoApproval: {
          enabled: Number(levelForm.autoApprovalLimit || 0) > 0,
          maxAmount: Number(levelForm.autoApprovalLimit || 0),
          conditions: { minCompletedLoans: 0, minRepaymentRate: 100 }
        },
        isActive: !!levelForm.isActive,
      };

      if (editingLevel) {
        await apiService.patch(`/loan-levels/${editingLevel.id}`, payload);
        showMessage('success', 'Loan level updated successfully');
      } else {
        await apiService.post('/loan-levels', payload);
        showMessage('success', 'Loan level created successfully');
      }
      resetLevelForm();
      fetchLoanLevels();
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to save loan level');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLevel = (level) => {
    setEditingLevel(level);
    setLevelForm({
      name: level.name,
      levelNumber: level.level,
      minAmount: level.minAmount,
      maxAmount: level.maxAmount,
      interestRate: level.interestRate || '',
      serviceFee: level.serviceFeePct || level.serviceFee || '',
      processingFee: level.administrationFeePct || level.processingFee || '',
      commitmentFee: level.commitmentFeePct || level.commitmentFee || '',
      allowedTerms: level.allowedTerms || [],
      autoApprovalLimit: level.autoApproval?.maxAmount || level.autoApprovalLimit || '',
      isActive: level.isActive
    });
    setShowLevelForm(true);
  };

  const handleDeleteLevel = async (levelId) => {
    try {
      setLoading(true);
      await apiService.delete(`/loan-levels/${levelId}`);
      showMessage('success', 'Loan level deleted successfully');
      fetchLoanLevels();
    } catch (error) {
      showMessage('error', 'Failed to delete loan level');
    } finally {
      setLoading(false);
    }
  };

  const resetLevelForm = () => {
    setLevelForm({
      name: '',
      levelNumber: '',
      minAmount: '',
      maxAmount: '',
      interestRate: '',
      serviceFee: '',
      processingFee: '',
      commitmentFee: '',
      allowedTerms: [],
      autoApprovalLimit: '',
      isActive: true
    });
    setEditingLevel(null);
    setShowLevelForm(false);
  };

  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const renderLoanTerms = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Loan Terms</p>
        {hasActionPermission('manageLoanTerms') && (
          <button onClick={() => setShowTermForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
            <FiPlus size={13} /> Add Term
          </button>
        )}
      </div>

      {showTermForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-700 m-0">{editingTerm ? 'Edit Loan Term' : 'Add New Loan Term'}</h4>
            <button onClick={resetTermForm} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"><FiX size={14} /></button>
          </div>
          <form onSubmit={handleTermSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Term ID', field: 'termId', placeholder: 'e.g., TERM_30_DAYS' },
                { label: 'Display Name', field: 'displayName', placeholder: 'e.g., 30 Days Term' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                  <input type="text" value={termForm[field]} onChange={(e) => setTermForm({...termForm, [field]: e.target.value})} placeholder={placeholder} required className={inp} />
                </div>
              ))}
              {[
                { label: 'Duration (Days)', field: 'durationDays', step: 1, req: true },
                { label: 'Interest Rate (%)', field: 'interestRate', step: '0.01', req: true },
                { label: 'Service Fee (%)', field: 'serviceFeeRate', step: '0.01' },
                { label: 'Processing Fee (%)', field: 'processingFeeRate', step: '0.01' },
                { label: 'Commitment Fee (%)', field: 'commitmentFeeRate', step: '0.01' },
                { label: 'Min Amount (GHS)', field: 'minAmount' },
                { label: 'Max Amount (GHS)', field: 'maxAmount' },
              ].map(({ label, field, step, req }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                  <input type="number" step={step} value={termForm[field]} onChange={(e) => setTermForm({...termForm, [field]: e.target.value})} required={req} className={inp} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetTermForm} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                {loading ? <FiRefreshCw size={13} className="animate-spin" /> : <FiSave size={13} />}
                {editingTerm ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loanTerms.map((term) => (
          <div key={term.id} className={`bg-white border rounded-xl p-4 ${!term.enabled ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-800 m-0">{term.displayName || term.name}</h4>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-1 ${term.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{term.enabled ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggleTerm(term.id, term.enabled)} disabled={!hasActionPermission('manageLoanTerms')} title={term.enabled ? 'Disable' : 'Enable'}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition ${term.enabled ? 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'text-gray-400 bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                  {term.enabled ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                </button>
                {hasActionPermission('manageLoanTerms') && (
                  <>
                    <button onClick={() => handleEditTerm(term)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"><FiEdit size={13} /></button>
                    <button onClick={() => handleDeleteTerm(term.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"><FiTrash2 size={13} /></button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><FiCalendar size={11} className="text-gray-400" /> {term.durationDays} days</div>
              <div className="flex items-center gap-1.5"><FiPercent size={11} className="text-gray-400" /> {term.interestRate}% interest</div>
              {(term.serviceFeePct || term.serviceFeeRate) && <div className="flex items-center gap-1.5"><FiDollarSign size={11} className="text-gray-400" /> {term.serviceFeePct || term.serviceFeeRate}% service fee</div>}
              {term.minAmount && term.maxAmount && <div className="flex items-center gap-1.5"><FiDollarSign size={11} className="text-gray-400" /> GHS {term.minAmount} – {term.maxAmount}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLoanLevels = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Loan Levels</p>
        {hasActionPermission('manageLoanLevels') && (
          <button onClick={() => setShowLevelForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
            <FiPlus size={13} /> Add Level
          </button>
        )}
      </div>

      {showLevelForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-700 m-0">{editingLevel ? 'Edit Loan Level' : 'Add New Loan Level'}</h4>
            <button onClick={resetLevelForm} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"><FiX size={14} /></button>
          </div>
          <form onSubmit={handleLevelSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Level Name', field: 'name', req: true },
                { label: 'Level Number', field: 'levelNumber', type: 'number', req: true },
                { label: 'Min Amount (GHS)', field: 'minAmount', type: 'number', req: true },
                { label: 'Max Amount (GHS)', field: 'maxAmount', type: 'number', req: true },
                { label: 'Interest Rate (%)', field: 'interestRate', type: 'number', step: '0.01' },
                { label: 'Auto Approval Limit (GHS)', field: 'autoApprovalLimit', type: 'number' },
              ].map(({ label, field, type = 'text', req, step }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                  <input type={type} step={step} value={levelForm[field]} onChange={(e) => setLevelForm({...levelForm, [field]: e.target.value})} required={req} className={inp} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetLevelForm} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                {loading ? <FiRefreshCw size={13} className="animate-spin" /> : <FiSave size={13} />}
                {editingLevel ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loanLevels.map((level) => (
          <div key={level.id} className={`bg-white border rounded-xl p-4 ${!level.isActive ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-800 m-0">{level.name}</h4>
                  <span className="text-xs font-semibold text-blue-500 bg-blue-50 rounded-full px-2 py-0.5">L{level.level}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-1 ${level.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{level.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              {hasActionPermission('manageLoanLevels') && (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditLevel(level)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"><FiEdit size={13} /></button>
                  <button onClick={() => handleDeleteLevel(level.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"><FiTrash2 size={13} /></button>
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><FiDollarSign size={11} className="text-gray-400" /> GHS {level.minAmount} – {level.maxAmount}</div>
              {level.interestRate && <div className="flex items-center gap-1.5"><FiPercent size={11} className="text-gray-400" /> {level.interestRate}% interest</div>}
              {(level.autoApproval?.maxAmount || level.autoApprovalLimit) && <div className="flex items-center gap-1.5"><FiCheckCircle size={11} className="text-emerald-500" /> Auto-approve up to GHS {level.autoApproval?.maxAmount || level.autoApprovalLimit}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiLayers size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Loan Configuration</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage dynamic loan terms and user levels</p>
        </div>
      </div>

      {message.text && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {message.type === 'success' ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 mb-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeTab === tab.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {activeTab === 'terms' && renderLoanTerms()}
        {activeTab === 'levels' && renderLoanLevels()}
      </div>
    </div>
  );

};

export default LoanConfiguration;
