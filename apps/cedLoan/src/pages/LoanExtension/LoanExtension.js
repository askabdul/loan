import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { loansAPI } from '../../services/api';
import './LoanExtension.css';

const LoanExtension = () => {
  const navigate = useNavigate();
  const { loanId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { getConfig } = useConfig();

  const [loan, setLoan] = useState(null);
  const [extensionData, setExtensionData] = useState({
    extensionDays: '',
    popFile: null
  });
  const [extensionFee, setExtensionFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [extensionHistory, setExtensionHistory] = useState([]);
  const [eligibilityCheck, setEligibilityCheck] = useState(null);
  const [extensionPolicy, setExtensionPolicy] = useState({
    maxExtensionCount: 3,
    maxDaysPerRequest: 30,
    maxOverdueDaysForExtension: 30,
  });

  useEffect(() => {
    if (loanId) {
      fetchLoanDetails();
      fetchExtensionHistory();
    }
  }, [loanId]);

  useEffect(() => {
    if (extensionData.extensionDays && loan) {
      calculateExtensionFee();
    }
  }, [extensionData.extensionDays, loan]);

  const fetchLoanDetails = async () => {
    try {
      setLoading(true);
      const [loanResponse, extensionStatusResponse] = await Promise.all([
        loansAPI.getLoanById(loanId),
        loansAPI.getExtensionStatus(loanId),
      ]);
      const loanData = loanResponse?.loan || loanResponse?.data?.loan || null;
      const policyData =
        extensionStatusResponse?.data?.policy ||
        extensionStatusResponse?.policy ||
        null;
      if (policyData) {
        setExtensionPolicy((prev) => ({ ...prev, ...policyData }));
      }
      setLoan(loanData);
      if (loanData) {
        checkEligibility(loanData, policyData || extensionPolicy);
      }
    } catch (error) {
      showToast('Error fetching loan details', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExtensionHistory = async () => {
    try {
      const response = await loansAPI.getExtensionHistory(loanId);
      setExtensionHistory(response.extensions || response.data || []);
    } catch (error) {
      console.error('Error fetching extension history:', error);
    }
  };

  const checkEligibility = (loanData, policy = extensionPolicy) => {
    const eligibility = {
      eligible: true,
      reasons: []
    };

    // Check if loan is active
    if (loanData.status !== 'active') {
      eligibility.eligible = false;
      eligibility.reasons.push('Loan must be active to request extension');
    }

    if (loanData.extensionCount >= (policy.maxExtensionCount || 3)) {
      eligibility.eligible = false;
      eligibility.reasons.push(`Maximum extension limit reached (${policy.maxExtensionCount || 3} extensions)`);
    }

    const dueDate = new Date(loanData.extendedDueDate || loanData.dueDate);
    const today = new Date();
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    
    if (daysPastDue > (policy.maxOverdueDaysForExtension || 30)) {
      eligibility.eligible = false;
      eligibility.reasons.push(`Loan is overdue by more than ${policy.maxOverdueDaysForExtension || 30} days`);
    }

    // Check if there's a pending extension request
    if (loanData.extensionStatus === 'pending' || loanData.pendingExtension) {
      eligibility.eligible = false;
      eligibility.reasons.push('There is already a pending extension request');
    }

    setEligibilityCheck(eligibility);
  };

  const calculateExtensionFee = async () => {
    if (!extensionData.extensionDays || !loan) return;

    try {
      setCalculating(true);
      const response = await loansAPI.calculateExtensionFee(
        loan.id,
        parseInt(extensionData.extensionDays)
      );
      setExtensionFee(response?.data?.extensionFee ?? response?.extensionFee ?? 0);
      if (response?.data?.policy) {
        setExtensionPolicy((prev) => ({ ...prev, ...response.data.policy }));
      }
    } catch (error) {
      showToast('Error calculating extension fee', 'error');
      console.error('Error:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExtensionData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Please upload only JPEG, PNG, or PDF files', 'error');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }

      setExtensionData(prev => ({
        ...prev,
        popFile: file
      }));
    }
  };

  const submitExtensionRequest = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const requestData = {
        loanId: loan.id,
        extensionDays: parseInt(extensionData.extensionDays),
        popFile: extensionData.popFile
      };

      await loansAPI.submitExtensionRequest(requestData);
      showToast('Extension request submitted successfully', 'success');
      
      // Reset form
      setExtensionData({ extensionDays: '', popFile: null });
      setExtensionFee(0);
      
      // Refresh data
      fetchLoanDetails();
      fetchExtensionHistory();
    } catch (error) {
      showToast(error.message || 'Error submitting extension request', 'error');
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = () => {
    if (!extensionData.extensionDays) {
      showToast('Please enter extension days', 'error');
      return false;
    }

    const days = parseInt(extensionData.extensionDays);
    const maxDays = extensionPolicy.maxDaysPerRequest || loan?.termInDays || 30;
    if (days < 1 || days > maxDays) {
      showToast(`Extension days must be between 1 and ${maxDays}`, 'error');
      return false;
    }

    if (!extensionData.popFile) {
      showToast('Please upload proof of payment', 'error');
      return false;
    }

    return true;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `GH₵ ${parseFloat(amount).toFixed(2)}`;
  };

  const getDaysUntilDue = () => {
    if (!loan) return 0;
    const dueDate = new Date(loan.extendedDueDate || loan.dueDate);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="loan-extension-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="loan-extension-container">
        <div className="error-message">
          <h2>Loan Not Found</h2>
          <p>The requested loan could not be found.</p>
          <button onClick={() => navigate('/history')} className="btn-primary">
            Back to History
          </button>
        </div>
      </div>
    );
  }

  // Feature gate: extension disabled by business decision (enable_extension=false in AppConfig)
  const extensionEnabled = getConfig('enable_extension', false) === true ||
                           getConfig('enable_extension', false) === 'true';
  if (!extensionEnabled) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', padding: 32, maxWidth: 320, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Extensions Not Available</h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
            Loan extensions are not currently offered. Contact support if you need help with your repayment.
          </p>
          <button onClick={() => navigate('/')} style={{ width: '100%', padding: '12px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="loan-extension-container">
      <div className="header">
        <button onClick={() => navigate('/history')} className="back-btn">
          ← Back
        </button>
        <h1>Loan Extension</h1>
      </div>

      {/* Loan Summary */}
      <div className="loan-summary-card">
        <h2>Loan Summary</h2>
        <div className="loan-info-grid">
          <div className="info-item">
            <label>Loan ID</label>
            <span>{loan.loanId}</span>
          </div>
          <div className="info-item">
            <label>Amount</label>
            <span>{formatCurrency(loan.amount)}</span>
          </div>
          <div className="info-item">
            <label>Status</label>
            <span className={`status ${loan.status}`}>{loan.status}</span>
          </div>
          <div className="info-item">
            <label>Original Due Date</label>
            <span>{formatDate(loan.dueDate)}</span>
          </div>
          <div className="info-item">
            <label>Current Due Date</label>
            <span>{formatDate(loan.extendedDueDate || loan.dueDate)}</span>
          </div>
          <div className="info-item">
            <label>Days Until Due</label>
            <span className={getDaysUntilDue() < 0 ? 'overdue' : 'normal'}>
              {getDaysUntilDue() < 0 ? `${Math.abs(getDaysUntilDue())} days overdue` : `${getDaysUntilDue()} days`}
            </span>
          </div>
          <div className="info-item">
            <label>Extensions Used</label>
            <span>{loan.extensionCount || 0} / {extensionPolicy.maxExtensionCount || 3}</span>
          </div>
        </div>
      </div>

      {/* Eligibility Check */}
      {eligibilityCheck && (
        <div className={`eligibility-card ${eligibilityCheck.eligible ? 'eligible' : 'not-eligible'}`}>
          <h3>
            {eligibilityCheck.eligible ? '✓ Eligible for Extension' : '✗ Not Eligible for Extension'}
          </h3>
          {!eligibilityCheck.eligible && (
            <ul className="eligibility-reasons">
              {eligibilityCheck.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Extension Form */}
      {eligibilityCheck?.eligible && (
        <div className="extension-form-card">
          <h2>Request Extension</h2>
          <div className="form-group">
            <label>Extension Days (1-{extensionPolicy.maxDaysPerRequest || loan?.termInDays || 30})</label>
            <input
              type="number"
              name="extensionDays"
              value={extensionData.extensionDays}
              onChange={handleInputChange}
              min="1"
              max={extensionPolicy.maxDaysPerRequest || loan?.termInDays || 30}
              placeholder="Enter number of days"
            />
          </div>

          {extensionData.extensionDays && (
            <div className="fee-display">
              <label>Extension Fee</label>
              <div className="fee-amount">
                {calculating ? (
                  <span className="calculating">Calculating...</span>
                ) : (
                  <span className="fee">{formatCurrency(extensionFee)}</span>
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Proof of Payment (POP)</label>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.pdf"
              required
            />
            {extensionData.popFile && (
              <span className="file-name">Selected: {extensionData.popFile.name}</span>
            )}
            <small className="file-help">
              Upload proof of payment for the extension fee. Accepted formats: JPG, PNG, PDF (Max 5MB)
            </small>
          </div>

          <button
            onClick={submitExtensionRequest}
            disabled={submitting || calculating}
            className="submit-btn"
          >
            {submitting ? 'Submitting...' : 'Submit Extension Request'}
          </button>
        </div>
      )}

      {/* Extension History */}
      {extensionHistory.length > 0 && (
        <div className="extension-history-card">
          <h2>Extension History</h2>
          <div className="history-list">
            {extensionHistory.map((extension, index) => (
              <div key={index} className="history-item">
                <div className="history-info">
                  <div className="history-date">
                    {formatDate(extension.createdAt)}
                  </div>
                  <div className="history-details">
                    <span>Extended by {extension.extensionDays} days</span>
                    <span>Fee: {formatCurrency(extension.extensionFee)}</span>
                  </div>
                </div>
                <div className={`history-status ${extension.status}`}>
                  {extension.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanExtension;