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
      const response = await configAPI.getAllConfigs();
      const configData = response.data || {};
      
      const loanRates = {
        7: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
        14: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 },
        30: { interestRate: 0, processingFee: 0, serviceFee: 0, commitmentFee: 0 }
      };
      
      // Handle nested configuration structure
      let interestRatesConfig = null;
      let feeStructureConfig = null;
      
      // Check if configData is an array (from admin endpoint) or object (from public endpoint)
      if (Array.isArray(configData)) {
        configData.forEach(config => {
          if (config.key === 'interest_rates') {
            interestRatesConfig = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
          } else if (config.key === 'fee_structure') {
            feeStructureConfig = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
          }
        });
      } else {
        // Handle object format from public endpoint
        if (configData.interest_rates) {
          interestRatesConfig = typeof configData.interest_rates === 'string' ? 
            JSON.parse(configData.interest_rates) : configData.interest_rates;
        }
        if (configData.fee_structure) {
          feeStructureConfig = typeof configData.fee_structure === 'string' ? 
            JSON.parse(configData.fee_structure) : configData.fee_structure;
        }
      }
      
      // Apply interest rates
      if (interestRatesConfig) {
        Object.keys(interestRatesConfig).forEach(term => {
          if (loanRates[term]) {
            loanRates[term].interestRate = (interestRatesConfig[term] * 100) || 0;
          }
        });
      }
      
      // Apply fee structure
      if (feeStructureConfig) {
        Object.keys(loanRates).forEach(term => {
          loanRates[term].serviceFee = (feeStructureConfig.service_fee_rate * 100) || 0;
          loanRates[term].processingFee = feeStructureConfig.admin_fee_flat || 0;
          loanRates[term].commitmentFee = (feeStructureConfig.commitment_fee_rate * 100) || 0;
        });
      }
      
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
      
      // Map field names to backend keys
      if (field === 'interestRate') {
        // Update nested interest_rates object
        const response = await configAPI.getAllConfigs();
        const configData = response.data || {};
        let currentRates = configData.interest_rates || '{}';
        const ratesObj = typeof currentRates === 'string' ? JSON.parse(currentRates) : currentRates;
        ratesObj[term] = value / 100; // Convert percentage to decimal
        await configAPI.updateConfig('interest_rates', JSON.stringify(ratesObj));
      } else {
        // Update nested fee_structure object
        const response = await configAPI.getAllConfigs();
        const configData = response.data || {};
        let currentFees = configData.fee_structure || '{}';
        const feesObj = typeof currentFees === 'string' ? JSON.parse(currentFees) : currentFees;
        
        if (field === 'serviceFee') {
          feesObj.service_fee_rate = value / 100;
        } else if (field === 'processingFee') {
          feesObj.admin_fee_flat = value;
        } else if (field === 'commitmentFee') {
          feesObj.commitment_fee_rate = value / 100;
        }
        
        await configAPI.updateConfig('fee_structure', JSON.stringify(feesObj));
      }
      
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
      
      // Get current configs
      const response = await configAPI.getAllConfigs();
      const configData = response.data || {};
      
      // Prepare interest rates object
      let currentRates = configData.interest_rates || '{}';
      const ratesObj = typeof currentRates === 'string' ? JSON.parse(currentRates) : currentRates;
      
      // Prepare fee structure object
      let currentFees = configData.fee_structure || '{}';
      const feesObj = typeof currentFees === 'string' ? JSON.parse(currentFees) : currentFees;
      
      // Update all rates from tempValues
      Object.keys(tempValues).forEach(key => {
        const [term, field] = key.split('_');
        const value = tempValues[key];
        
        if (field === 'interestRate') {
          ratesObj[term] = value / 100; // Convert percentage to decimal
        } else if (field === 'serviceFee') {
          feesObj.service_fee_rate = value / 100;
        } else if (field === 'processingFee') {
          feesObj.admin_fee_flat = value;
        } else if (field === 'commitmentFee') {
          feesObj.commitment_fee_rate = value / 100;
        }
      });
      
      // Save both configs
      await Promise.all([
        configAPI.updateConfig('interest_rates', JSON.stringify(ratesObj)),
        configAPI.updateConfig('fee_structure', JSON.stringify(feesObj))
      ]);
      
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