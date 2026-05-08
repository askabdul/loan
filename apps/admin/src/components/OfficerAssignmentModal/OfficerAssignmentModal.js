import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiCheck } from 'react-icons/fi';
import apiService from '../../services/api';
import './OfficerAssignmentModal.css';

const OfficerAssignmentModal = ({ isOpen, onClose, selectedLoans, onAssignmentComplete }) => {
  const [officers, setOfficers] = useState([]);
  const [selectedOfficers, setSelectedOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState('even'); // 'even' or 'manual'
  const [manualAssignments, setManualAssignments] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchOfficers();
    }
  }, [isOpen]);

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch credit review officers
      const response = await apiService.getCreditReviewOfficers();
      setOfficers(response.officers || []);
    } catch (error) {
      console.error('Error fetching officers:', error);
      setError('Failed to load credit review officers');
    } finally {
      setLoading(false);
    }
  };

  const handleOfficerSelect = (officerId) => {
    setSelectedOfficers(prev => 
      prev.includes(officerId)
        ? prev.filter(id => id !== officerId)
        : [...prev, officerId]
    );
  };

  const handleSelectAllOfficers = () => {
    if (selectedOfficers.length === officers.length) {
      setSelectedOfficers([]);
    } else {
      setSelectedOfficers(officers.map(officer => officer._id));
    }
  };

  const distributeLoansEvenly = () => {
    if (selectedOfficers.length === 0) return {};
    
    const assignments = {};
    selectedLoans.forEach((loanId, index) => {
      const officerIndex = index % selectedOfficers.length;
      const officerId = selectedOfficers[officerIndex];
      if (!assignments[officerId]) {
        assignments[officerId] = [];
      }
      assignments[officerId].push(loanId);
    });
    
    return assignments;
  };

  const handleManualAssignment = (loanId, officerId) => {
    setManualAssignments(prev => ({
      ...prev,
      [loanId]: officerId
    }));
  };

  const getAssignmentPreview = () => {
    if (assignmentMode === 'even') {
      return distributeLoansEvenly();
    } else {
      const assignments = {};
      Object.entries(manualAssignments).forEach(([loanId, officerId]) => {
        if (!assignments[officerId]) {
          assignments[officerId] = [];
        }
        assignments[officerId].push(loanId);
      });
      return assignments;
    }
  };

  const handleAssign = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate based on assignment mode
      if (assignmentMode === 'even') {
        if (selectedOfficers.length === 0) {
          setError('Please select at least one officer');
          return;
        }
      } else {
        const unassignedLoans = selectedLoans.filter(loanId => !manualAssignments[loanId]);
        if (unassignedLoans.length > 0) {
          setError(`${unassignedLoans.length} loans are not assigned to any officer`);
          return;
        }
      }
      
      // Prepare data for API call
      let officerIds;
      if (assignmentMode === 'even') {
        officerIds = selectedOfficers;
      } else {
        // For manual assignment, get unique officer IDs from manual assignments
        officerIds = [...new Set(Object.values(manualAssignments))];
      }
      
      // Send assignment request to backend
      await apiService.assignLoansToOfficers(selectedLoans, officerIds, assignmentMode);
      
      // Call parent callback to refresh data
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Error assigning loans:', error);
      setError('Failed to assign loans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedOfficers([]);
    setManualAssignments({});
    setAssignmentMode('even');
    setError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  const assignmentPreview = getAssignmentPreview();

  return (
    <div className="modal-overlay">
      <div className="assignment-modal">
        <div className="modal-header">
          <h2>Assign Loans to Credit Review Officers</h2>
          <button className="close-btn" onClick={handleClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="assignment-summary">
            <p><strong>{selectedLoans.length}</strong> loans selected for assignment</p>
          </div>

          <div className="assignment-mode">
            <h3>Assignment Mode</h3>
            <div className="mode-options">
              <label className="mode-option">
                <input
                  type="radio"
                  value="even"
                  checked={assignmentMode === 'even'}
                  onChange={(e) => setAssignmentMode(e.target.value)}
                />
                <span>Even Distribution</span>
                <small>Automatically distribute loans evenly among selected officers</small>
              </label>
              <label className="mode-option">
                <input
                  type="radio"
                  value="manual"
                  checked={assignmentMode === 'manual'}
                  onChange={(e) => setAssignmentMode(e.target.value)}
                />
                <span>Manual Assignment</span>
                <small>Manually assign each loan to specific officers</small>
              </label>
            </div>
          </div>

          <div className="officers-section">
            <div className="section-header">
              <h3>Select Credit Review Officers</h3>
              {assignmentMode === 'even' && (
                <button 
                  className="select-all-btn"
                  onClick={handleSelectAllOfficers}
                  disabled={loading}
                >
                  {selectedOfficers.length === officers.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading">Loading officers...</div>
            ) : (
              <div className="officers-list">
                {officers.map(officer => (
                  <div 
                    key={officer._id} 
                    className={`officer-item ${selectedOfficers.includes(officer._id) ? 'selected' : ''}`}
                    onClick={() => assignmentMode === 'even' && handleOfficerSelect(officer._id)}
                  >
                    <div className="officer-info">
                      <div className="officer-avatar">
                        <FiUser />
                      </div>
                      <div className="officer-details">
                        <h4>{officer.name}</h4>
                        <p>{officer.email}</p>
                        <span className="workload">Current workload: {officer.currentLoans || 0} loans</span>
                      </div>
                    </div>
                    {assignmentMode === 'even' && (
                      <div className="selection-indicator">
                        {selectedOfficers.includes(officer._id) && <FiCheck />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {assignmentMode === 'manual' && selectedOfficers.length > 0 && (
            <div className="manual-assignment-section">
              <h3>Manual Loan Assignment</h3>
              <div className="loan-assignment-list">
                {selectedLoans.map(loanId => (
                  <div key={loanId} className="loan-assignment-item">
                    <span className="loan-id">Loan #{loanId}</span>
                    <select
                      value={manualAssignments[loanId] || ''}
                      onChange={(e) => handleManualAssignment(loanId, e.target.value)}
                      className="officer-select"
                    >
                      <option value="">Select Officer</option>
                      {officers.map(officer => (
                        <option key={officer._id} value={officer._id}>
                          {officer.name} (Current: {officer.currentLoans || 0} loans)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(assignmentPreview).length > 0 && (
            <div className="assignment-preview">
              <h3>Assignment Preview</h3>
              <div className="preview-list">
                {Object.entries(assignmentPreview).map(([officerId, loanIds]) => {
                  const officer = officers.find(o => o._id === officerId);
                  return (
                    <div key={officerId} className="preview-item">
                      <div className="officer-name">
                        <FiUser /> {officer?.name || 'Unknown Officer'}
                      </div>
                      <div className="assigned-count">
                        {loanIds.length} loan{loanIds.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-btn"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="assign-btn"
            onClick={handleAssign}
            disabled={loading || Object.keys(assignmentPreview).length === 0}
          >
            {loading ? 'Assigning...' : `Assign ${selectedLoans.length} Loans`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfficerAssignmentModal;