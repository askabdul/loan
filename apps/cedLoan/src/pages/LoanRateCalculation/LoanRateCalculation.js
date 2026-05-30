import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import configAPI from '../../services/configAPI';
import { useToast } from '../../contexts/ToastContext';
import './LoanRateCalculation.css';

const LoanRateCalculation = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [rates, setRates] = useState({
    7: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
    14: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
    30: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 }
  });
  const [editMode, setEditMode] = useState({});
  const [tempValues, setTempValues] = useState({});

  useEffect(() => {
    fetchLoanRates();
  }, []);

  const fetchLoanRates = async () => {
    try {
      setLoading(true);
      const response = await configAPI.getLoanCalculationParams();
      const configData = response.data || {};
      
      const loanRates = {
        7: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
        14: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
        30: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 }
      };
      
      Object.keys(configData).forEach((termKey) => {
        const days = parseInt(String(termKey).replace('_days', ''), 10);
        if (!loanRates[days]) return;
        const term = configData[termKey] || {};
        loanRates[days].interestRate = Number(term.interestRate || 0);
        loanRates[days].serviceFee = Number(term.serviceFee || 0);
        loanRates[days].processingFee = Number(term.adminFee || 0);
        loanRates[days].commitmentFee = Number(term.commitmentFee || 0);
      });
      
      setRates(loanRates);
      setTempValues({
        ...Object.keys(loanRates).reduce((acc, term) => {
          Object.keys(loanRates[term]).forEach(field => {
            acc[`${term}_${field}`] = loanRates[term][field];
          });
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Error fetching loan rates:', error);
      showToast('Failed to fetch loan rates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (term, field) => {
    const key = `${term}_${field}`;
    setEditMode({ ...editMode, [key]: true });
  };

  const handleCancel = (term, field) => {
    const key = `${term}_${field}`;
    setEditMode({ ...editMode, [key]: false });
    setTempValues({ ...tempValues, [key]: rates[term][field] });
  };

  const handleSave = async (term, field) => {
    try {
      setSaving(true);
      const key = `${term}_${field}`;
      const value = tempValues[key];

      const fieldToKey = {
        interestRate: `interest_rate_${term}_days`,
        serviceFee: `service_fee_${term}_days`,
        processingFee: `admin_fee_${term}_days`,
        commitmentFee: `commitment_fee_${term}_days`,
      };

      await configAPI.updateConfig(fieldToKey[field], value);
      
      setRates({
        ...rates,
        [term]: {
          ...rates[term],
          [field]: value
        }
      });
      
      setEditMode({ ...editMode, [key]: false });
      showToast(`${field} for ${term} days updated successfully`, 'success');
      
      // Trigger real-time update event
      window.dispatchEvent(new CustomEvent('configUpdate', {
        detail: { key: `${field}_${term}_days` }
      }));
      
    } catch (error) {
      console.error('Error updating rate:', error);
      showToast(`Failed to update ${field} for ${term} days`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (term, field, value) => {
    const key = `${term}_${field}`;
    setTempValues({ ...tempValues, [key]: parseFloat(value) || 0 });
  };

  const handleSaveAll = async () => {
    try {
      setSavingAll(true);
      
      const updates = [];
      Object.keys(tempValues).forEach((key) => {
        const [term, field] = key.split('_');
        const value = tempValues[key];
        const fieldToKey = {
          interestRate: `interest_rate_${term}_days`,
          serviceFee: `service_fee_${term}_days`,
          processingFee: `admin_fee_${term}_days`,
          commitmentFee: `commitment_fee_${term}_days`,
        };
        if (fieldToKey[field]) {
          updates.push(configAPI.updateConfig(fieldToKey[field], value));
        }
      });

      await Promise.all(updates);
      
      // Update local state
      const newRates = { ...rates };
      Object.keys(tempValues).forEach(key => {
        const [term, field] = key.split('_');
        const value = tempValues[key];
        newRates[term] = { ...newRates[term], [field]: value };
      });
      setRates(newRates);
      
      // Clear edit modes
      setEditMode({});
      
      showToast('All loan rates updated successfully', 'success');
      
      // Trigger real-time update event
      window.dispatchEvent(new CustomEvent('configUpdate', {
        detail: { key: 'loan_rates_bulk_update' }
      }));
      
    } catch (error) {
      console.error('Error updating all rates:', error);
      showToast('Failed to update loan rates', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const renderRateCard = (term) => {
    const termData = rates[term];
    const termLabel = `${term} Days`;
    const termCode = term === 7 ? '7D' : term === 14 ? '14D' : '30D';
    
    return (
      <div key={term} className="col-md-4 mb-4">
        <div className="card h-100 rate-card">
          <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
            <div>
              <h6 className="mb-0">{termLabel}</h6>
            </div>
            <span className="badge bg-light text-success">{termCode}</span>
          </div>
          <div className="card-body">
            {/* Interest Rate */}
            <div className="rate-item mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="rate-label">📈 Interest Rate</span>
                {!editMode[`${term}_interestRate`] && (
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleEdit(term, 'interestRate')}
                  >
                    ✏️
                  </button>
                )}
              </div>
              {editMode[`${term}_interestRate`] ? (
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={tempValues[`${term}_interestRate`] || 0}
                    onChange={(e) => handleInputChange(term, 'interestRate', e.target.value)}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="input-group-text">%</span>
                  <button 
                    className="btn btn-success"
                    onClick={() => handleSave(term, 'interestRate')}
                    disabled={saving}
                  >
                    ✓
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleCancel(term, 'interestRate')}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="rate-value">{termData.interestRate.toFixed(2)}%</div>
              )}
            </div>

            {/* Processing Fee */}
            <div className="rate-item mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="rate-label">💰 Processing Fee</span>
                {!editMode[`${term}_processingFee`] && (
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleEdit(term, 'processingFee')}
                  >
                    ✏️
                  </button>
                )}
              </div>
              {editMode[`${term}_processingFee`] ? (
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={tempValues[`${term}_processingFee`] || 0}
                    onChange={(e) => handleInputChange(term, 'processingFee', e.target.value)}
                    step="0.01"
                    min="0"
                  />
                  <span className="input-group-text">GHS</span>
                  <button 
                    className="btn btn-success"
                    onClick={() => handleSave(term, 'processingFee')}
                    disabled={saving}
                  >
                    ✓
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleCancel(term, 'processingFee')}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="rate-value">GHS {termData.processingFee.toFixed(2)}</div>
              )}
            </div>

            {/* Service Fee */}
            <div className="rate-item mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="rate-label">⚙️ Service Fee</span>
                {!editMode[`${term}_serviceFee`] && (
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleEdit(term, 'serviceFee')}
                  >
                    ✏️
                  </button>
                )}
              </div>
              {editMode[`${term}_serviceFee`] ? (
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={tempValues[`${term}_serviceFee`] || 0}
                    onChange={(e) => handleInputChange(term, 'serviceFee', e.target.value)}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="input-group-text">%</span>
                  <button 
                    className="btn btn-success"
                    onClick={() => handleSave(term, 'serviceFee')}
                    disabled={saving}
                  >
                    ✓
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleCancel(term, 'serviceFee')}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="rate-value">{termData.serviceFee.toFixed(2)}%</div>
              )}
            </div>

            {/* Commitment Fee */}
            <div className="rate-item">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="rate-label">⭕ Commitment Fee</span>
                {!editMode[`${term}_commitmentFee`] && (
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleEdit(term, 'commitmentFee')}
                  >
                    ✏️
                  </button>
                )}
              </div>
              {editMode[`${term}_commitmentFee`] ? (
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={tempValues[`${term}_commitmentFee`] || 0}
                    onChange={(e) => handleInputChange(term, 'commitmentFee', e.target.value)}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="input-group-text">%</span>
                  <button 
                    className="btn btn-success"
                    onClick={() => handleSave(term, 'commitmentFee')}
                    disabled={saving}
                  >
                    ✓
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleCancel(term, 'commitmentFee')}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="rate-value">{termData.commitmentFee.toFixed(2)}%</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading loan rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="page-header">
        <button 
          className="btn btn-outline-light btn-sm mb-3"
          onClick={() => navigate('/home')}
        >
          ← Back
        </button>
        <h1 className="page-title">💰 Loan Rate Calculation</h1>
        <p className="page-subtitle">
          Configure interest rates and fees for different loan terms
        </p>
      </div>

      {(saving || savingAll) && (
        <div className="alert alert-info">
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            {savingAll ? 'Saving all changes...' : 'Saving changes...'}
          </div>
        </div>
      )}

      {Object.keys(editMode).some(key => editMode[key]) && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <div>
            <strong>Unsaved Changes:</strong> You have unsaved modifications.
          </div>
          <button 
            className="btn btn-success btn-sm"
            onClick={handleSaveAll}
            disabled={savingAll}
          >
            {savingAll ? (
              <>
                <div className="spinner-border spinner-border-sm me-1" role="status"></div>
                Saving All...
              </>
            ) : (
              '💾 Save All Changes'
            )}
          </button>
        </div>
      )}

      <div className="row">
        {Object.keys(rates).map(term => renderRateCard(parseInt(term)))}
      </div>

      <div className="alert alert-info mt-4">
        <h6>📋 How to use:</h6>
        <ul className="mb-0">
          <li>Click the ✏️ edit button next to any rate to modify it</li>
          <li>Enter the new value and click ✓ to save or ✕ to cancel</li>
          <li>Changes are saved to the database and will persist after server restart</li>
          <li>Updates are reflected immediately in the loan application</li>
        </ul>
      </div>
    </div>
  );
};

export default LoanRateCalculation;