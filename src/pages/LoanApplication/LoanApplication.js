import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { useSocket } from '../../contexts/SocketContext';
import { useConfig } from '../../contexts/ConfigContext';
import { loansAPI, paymentsAPI } from '../../services/api';
import { loanLevelsAPI } from '../../services/loanLevelsAPI';
import configAPI from '../../services/configAPI';
import LoanTermsCarousel from '../../components/LoanTermsCarousel';

const LoanApplication = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { getLoanConfig, loading: configLoading } = useConfig();
  useSocket(); // Initialize socket connection
  const [loanAmount, setLoanAmount] = useState(100);
  const [loanTerm, setLoanTerm] = useState(14);
  const [loanStatus, setLoanStatus] = useState(null); // null, 'pending', 'under-review', 'approved', 'rejected', 'active', 'completed'
  const [activeLoan, setActiveLoan] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  console.log('🔥🔥🔥 COMPONENT STATE - termsAccepted:', termsAccepted);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [availableTerms, setAvailableTerms] = useState([7, 14, 30]);
  const [dynamicFees, setDynamicFees] = useState(null);
  const [isCalculatingFees, setIsCalculatingFees] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [userLevelInfo, setUserLevelInfo] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [minAmount, setMinAmount] = useState(100);
  const [maxAmount, setMaxAmount] = useState(5000);

  
  // Listen for real-time loan status updates
  useEffect(() => {
    const handleLoanStatusUpdate = (event) => {
      const { status, message } = event.detail;
      console.log('📋 Received loan status update:', event.detail);
      
      // Update loan status if it matches current application
      setLoanStatus(status);
      
      // Show toast notification
      if (message) {
        showToast(message, 'info');
      }
    };

    // Add event listener for loan status updates
    window.addEventListener('loanStatusUpdate', handleLoanStatusUpdate);

    // Cleanup event listener
    return () => {
      window.removeEventListener('loanStatusUpdate', handleLoanStatusUpdate);
    };
  }, [showToast]);

  // Check for existing active loans
  const checkActiveLoan = async () => {
    try {
      console.log('🔍 Checking for active loans...');
      const response = await loansAPI.getUserLoans();
      const loans = response.loans || [];
      console.log('📋 All user loans:', loans);
      
      // Find active loan
      const activeLoanFound = loans.find(loan => 
        ['pending', 'under-review', 'approved', 'disbursed', 'active', 'overdue'].includes(loan.status)
      );
      
      console.log('🎯 Active loan found:', activeLoanFound);
      
      if (activeLoanFound) {
        console.log('✅ Setting active loan state:', activeLoanFound.status);
        
        // Check if loan should be marked as completed based on remaining balance
        const currentBalance = activeLoanFound.remainingBalance || 0;
        
        if (currentBalance === 0 && activeLoanFound.status !== 'completed') {
          console.log('🎉 Loan has zero balance, should be completed');
          // Clear the loan state to show application form
          setActiveLoan(null);
          setLoanStatus(null);
          setRemainingBalance(0);
          showToast('🎉 Congratulations! Your loan has been fully repaid!', 'success');
          return;
        }
        
        setActiveLoan(activeLoanFound);
        setLoanStatus(activeLoanFound.status);
        setRemainingBalance(currentBalance);
      } else {
        console.log('❌ No active loan found, clearing state');
        setActiveLoan(null);
        setLoanStatus(null);
        setRemainingBalance(0);
      }
    } catch (error) {
      console.error('Error checking active loans:', error);
    }
  };

  // Fetch user's current loan level and check for active loans
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        // Fetch user level information
        const levelInfo = await loanLevelsAPI.getCurrentUserLevel();
        setUserLevelInfo(levelInfo.data);
        setCurrentLevel(levelInfo.data.currentLevel);
        
        // Set dynamic loan limits and available terms based on user's level
        if (levelInfo.data.currentLevel) {
          setMinAmount(levelInfo.data.currentLevel.minAmount);
          setMaxAmount(levelInfo.data.currentLevel.maxAmount);
          setAvailableTerms(levelInfo.data.currentLevel.availableTerms || [7, 14, 30]);
          setSelectedTerm(levelInfo.data.currentLevel.availableTerms?.[0] || 7);
          
          // Adjust loan amount if it's outside the new limits
          if (loanAmount < levelInfo.data.currentLevel.minAmount) {
            setLoanAmount(levelInfo.data.currentLevel.minAmount);
          } else if (loanAmount > levelInfo.data.currentLevel.maxAmount) {
            setLoanAmount(levelInfo.data.currentLevel.maxAmount);
          }
        }
        
        // Check for existing active loans
        await checkActiveLoan();
        
      } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('Failed to load loan information', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [showToast]);
  
  // Dynamic fee calculation using configAPI
  const calculateDynamicFees = async (amount, term) => {
    setIsCalculatingFees(true);
    try {
      const result = await configAPI.calculateLoanFees(amount, term);
      if (result.success) {
        const fees = {
          interestAmount: result.data.fees.interest,
          serviceFee: result.data.fees.service,
          processingFee: result.data.fees.processing || result.data.fees.admin,
          commitmentFee: result.data.fees.commitment,
          totalFees: result.data.fees.total
        };
        setDynamicFees(fees);
        setIsCalculatingFees(false);
        return fees;
      }
    } catch (error) {
      console.error('Error calculating dynamic fees:', error);
    }
    
    // Fallback to static calculation if dynamic fails
    const fallbackFees = calculateStaticFees(amount, term);
    setDynamicFees(fallbackFees);
    setIsCalculatingFees(false);
    return fallbackFees;
  };
  
  // Dynamic fee calculation using configuration
  const calculateStaticFees = (amount, term) => {
    // Get dynamic rates from configuration
    const interestRate = getLoanConfig(term, 'interest_rate') || 0;
    const serviceFeeRate = getLoanConfig(term, 'service_fee') || 0;
    const processingFeeRate = getLoanConfig(term, 'processing_fee') || getLoanConfig(term, 'admin_fee') || 0;
    const commitmentFeeRate = getLoanConfig(term, 'commitment_fee') || 0;
    
    const interestAmount = amount * interestRate / 100;
    const serviceFee = amount * serviceFeeRate / 100;
    const processingFee = amount * processingFeeRate / 100;
    const commitmentFee = amount * commitmentFeeRate / 100;
    
    return {
      interestAmount,
      serviceFee,
      processingFee,
      commitmentFee,
      totalFees: interestAmount + serviceFee + processingFee + commitmentFee
    };
  };
  
  // Get current fees (dynamic or fallback)
  const getCurrentFees = () => {
    return dynamicFees || calculateStaticFees(loanAmount, loanTerm);
  };
  
  // Calculate total repayment amount
  const calculateTotalRepayment = () => {
    const fees = getCurrentFees();
    return loanAmount + fees.totalFees;
  };
  
  // Effect to recalculate fees when amount, term, or configuration changes
  useEffect(() => {
    if (loanAmount > 0 && loanTerm > 0 && !configLoading) {
      calculateDynamicFees(loanAmount, loanTerm);
    }
  }, [loanAmount, loanTerm, configLoading]);

  // Listen for real-time configuration updates
  useEffect(() => {
    const handleConfigUpdate = (event) => {
      const { key } = event.detail;
      // Check if the updated config affects loan calculations
      if (key.includes('interest_rate') || key.includes('service_fee') || 
          key.includes('processing_fee') || key.includes('admin_fee') || key.includes('commitment_fee')) {
        console.log('⚙️ Loan configuration updated, recalculating fees...');
        // Recalculate fees with new configuration
        if (loanAmount > 0 && loanTerm > 0) {
          calculateDynamicFees(loanAmount, loanTerm);
        }
      }
    };

    const handleBulkConfigUpdate = () => {
      console.log('⚙️ Bulk configuration update, recalculating fees...');
      // Recalculate fees after bulk update
      if (loanAmount > 0 && loanTerm > 0) {
        calculateDynamicFees(loanAmount, loanTerm);
      }
    };

    window.addEventListener('configUpdate', handleConfigUpdate);
    window.addEventListener('bulkConfigUpdate', handleBulkConfigUpdate);
    window.addEventListener('systemConfigUpdate', handleBulkConfigUpdate);

    return () => {
      window.removeEventListener('configUpdate', handleConfigUpdate);
      window.removeEventListener('bulkConfigUpdate', handleBulkConfigUpdate);
      window.removeEventListener('systemConfigUpdate', handleBulkConfigUpdate);
    };
  }, [loanAmount, loanTerm]);
  
  const handleSliderChange = (e) => {
    setLoanAmount(parseInt(e.target.value));
  };
  
  const handleTermChange = (days) => {
    setSelectedTerm(days);
  };

  // Render different screens based on loan status

  const renderLoanStatusScreen = () => {
    console.log('🖥️ Rendering loan status screen - isLoading:', isLoading, 'activeLoan:', activeLoan, 'loanStatus:', loanStatus);
    console.log('🔍 Function called with current state');
    
    if (isLoading || configLoading) {
      console.log('📊 Showing loading screen');
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">{configLoading ? 'Loading configuration...' : 'Loading loan information...'}</p>
        </div>
      );
    }

    // Show current loan if exists
    if (activeLoan) {
      return renderCurrentLoanContent();
    }

    // No loans at all - show application form directly
    console.log('📝 No loans found - showing application form');
    return renderLoanApplicationForm();
  };

  // Render current loan content based on status
  const renderCurrentLoanContent = () => {
    if (!activeLoan) return null;
    
    console.log('🎯 Active loan found with status:', activeLoan.status);
    
    switch (activeLoan.status) {
      case 'pending':
      case 'under-review':
        console.log('⏳ Showing pending screen');
        return renderPendingScreen();
      case 'approved':
        console.log('✅ Showing approved screen');
        return renderApprovedScreen();
      case 'rejected':
        console.log('❌ Showing rejected screen');
        return renderRejectedScreen();
      case 'active':
      case 'disbursed':
      case 'overdue':
        console.log('💰 Showing active repayment screen');
        return renderActiveRepaymentScreen();
      case 'completed':
        console.log('🎉 Showing completed screen');
        return renderCompletedScreen();
      default:
        console.log('🔄 Default case - showing application form');
        return renderLoanApplicationForm();
    }
  };

  // Pending loan screen
  const renderPendingScreen = () => (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body text-center py-5">
              <div className="mb-4">
                <div className="spinner-border text-warning" style={{width: '3rem', height: '3rem'}} role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
              <h3 className="text-warning mb-3">📋 Application Under Review</h3>
              <p className="lead mb-4">Your loan application is being reviewed by our team.</p>
              
              <div className="row text-start">
                <div className="col-md-6">
                  <h6>Application Details:</h6>
                  <ul className="list-unstyled">
                    <li><strong>Amount:</strong> GHS {activeLoan.amount?.toLocaleString()}</li>
                    <li><strong>Term:</strong> {activeLoan.termInDays} days</li>
                    <li><strong>Level:</strong> {currentLevel?.name || 'N/A'}</li>
                    <li><strong>Applied:</strong> {new Date(activeLoan.applicationDate).toLocaleDateString()}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>What's Next:</h6>
                  <ul className="list-unstyled">
                    <li>✅ Application received</li>
                    <li>🔍 Under review</li>
                    <li>⏳ Decision pending</li>
                    <li>📧 You'll be notified</li>
                  </ul>
                </div>
              </div>
              
              <div className="alert alert-info mt-4">
                <strong>📞 Need Help?</strong> Contact our support team if you have any questions about your application.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Approved loan screen
  const renderApprovedScreen = () => (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm border-success">
            <div className="card-body text-center py-5">
              <div className="text-success mb-4">
                <i className="fas fa-check-circle" style={{fontSize: '4rem'}}></i>
              </div>
              <h3 className="text-success mb-3">🎉 Loan Approved!</h3>
              <p className="lead mb-4">Congratulations! Your loan has been approved and is ready for disbursement.</p>
              
              <div className="row text-start">
                <div className="col-md-6">
                  <h6>Loan Details:</h6>
                  <ul className="list-unstyled">
                    <li><strong>Amount:</strong> GHS {activeLoan.amount?.toLocaleString()}</li>
                    <li><strong>Term:</strong> {activeLoan.termInDays} days</li>
                    <li><strong>Interest Rate:</strong> {currentLevel?.interestRate || 0}%</li>
                    <li><strong>Total Repayment:</strong> GHS {activeLoan.totalAmount?.toLocaleString()}</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Important Dates:</h6>
                  <ul className="list-unstyled">
                    <li><strong>Approved:</strong> {new Date(activeLoan.approvalDate).toLocaleDateString()}</li>
                    <li><strong>Due Date:</strong> {activeLoan.dueDate ? new Date(activeLoan.dueDate).toLocaleDateString() : 'TBD'}</li>
                  </ul>
                </div>
              </div>
              
              {activeLoan.isAutoApproved && (
                <div className="alert alert-success mt-4">
                  <strong>⚡ Auto-Approved!</strong> {activeLoan.autoApprovalReason}
                </div>
              )}
              
              <div className="mt-4">
                <button className="btn btn-success btn-lg me-3" onClick={() => showToast('Disbursement process initiated!', 'success')}>
                  💰 Request Disbursement
                </button>
                <button className="btn btn-outline-primary" onClick={() => navigate('/history')}>
                  📋 View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Rejected loan screen
  const renderRejectedScreen = () => (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm border-danger">
            <div className="card-body text-center py-5">
              <div className="text-danger mb-4">
                <i className="fas fa-times-circle" style={{fontSize: '4rem'}}></i>
              </div>
              <h3 className="text-danger mb-3">❌ Application Not Approved</h3>
              <p className="lead mb-4">Unfortunately, your loan application was not approved at this time.</p>
              
              <div className="alert alert-info text-start">
                <h6>💡 Tips to Improve Your Application:</h6>
                <ul className="mb-0">
                  <li>Complete more loans successfully to build your credit history</li>
                  <li>Consider applying for a smaller amount</li>
                  <li>Ensure all your profile information is complete and accurate</li>
                  <li>Wait for your loan level to improve with successful repayments</li>
                </ul>
              </div>
              
              <div className="mt-4">
                <button 
                  className="btn btn-primary btn-lg me-3" 
                  onClick={() => {
                    setActiveLoan(null);
                    setLoanStatus(null);
                    showToast('You can now apply for a new loan', 'info');
                  }}
                >
                  🔄 Apply Again
                </button>
                <button className="btn btn-outline-secondary" onClick={() => navigate('/profile')}>
                  👤 Update Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Active repayment screen
  const renderActiveRepaymentScreen = () => (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-10">
          <div className="card shadow-sm border-primary">
            <div className="card-body">
              <div className="text-center mb-4">
                <h3 className="text-primary">💳 Active Loan - Repayment</h3>
                <p className="lead">Manage your active loan and make payments</p>
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h5>Loan Summary</h5>
                      <ul className="list-unstyled">
                        <li><strong>Original Amount:</strong> GHS {activeLoan.amount?.toLocaleString()}</li>
                        <li><strong>Total Amount:</strong> GHS {activeLoan.totalAmount?.toLocaleString()}</li>
                        <li><strong>Remaining Balance:</strong> <span className="text-danger">GHS {remainingBalance?.toLocaleString()}</span></li>
                        <li><strong>Due Date:</strong> {activeLoan.dueDate ? new Date(activeLoan.dueDate).toLocaleDateString() : 'TBD'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h5>Payment Progress</h5>
                      <div className="progress mb-3" style={{height: '20px'}}>
                        <div 
                          className="progress-bar bg-success" 
                          style={{width: `${activeLoan.totalAmount && activeLoan.totalAmount > 0 ? ((activeLoan.totalAmount - (remainingBalance || 0)) / activeLoan.totalAmount) * 100 : 0}%`}}
                    >
                      {activeLoan.totalAmount && activeLoan.totalAmount > 0 ? Math.round(((activeLoan.totalAmount - (remainingBalance || 0)) / activeLoan.totalAmount) * 100) : 0}%
                        </div>
                      </div>
                      <p><strong>Paid:</strong> GHS {activeLoan.totalAmount && activeLoan.totalAmount > 0 ? (activeLoan.totalAmount - (remainingBalance || 0))?.toLocaleString() : '0'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center mt-4">
                <button className="btn btn-success btn-lg me-3" onClick={handleMakePayment}>
                  💰 Make Payment
                </button>
                <button className="btn btn-outline-primary" onClick={() => navigate('/history')}>
                  📋 Payment History
                </button>
              </div>
              
              {activeLoan.isOverdue && (
                <div className="alert alert-warning mt-4">
                  <strong>⚠️ Overdue Notice:</strong> Your loan is {activeLoan.overdueDays} days overdue. 
                  Additional fees may apply. Please make a payment as soon as possible.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Payment Modal */}
      {console.log('🎭 Modal render check - showPaymentModal:', showPaymentModal)}
      {showPaymentModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">💳 Make Payment</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowPaymentModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Outstanding Balance: <span className="text-danger">GHS {remainingBalance?.toFixed(2) || '0.00'}</span></h6>
                    
                    <div className="mb-3">
                      <label className="form-label">Payment Type</label>
                      <div>
                        <div className="form-check">
                          <input 
                            className="form-check-input" 
                            type="radio" 
                            name="paymentType" 
                            id="fullPayment"
                            value="full"
                            checked={paymentType === 'full'}
                            onChange={(e) => setPaymentType(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor="fullPayment">
                            💰 Full Payment (GHS {remainingBalance?.toFixed(2) || '0.00'})
                          </label>
                        </div>
                        <div className="form-check">
                          <input 
                            className="form-check-input" 
                            type="radio" 
                            name="paymentType" 
                            id="partialPayment"
                            value="partial"
                            checked={paymentType === 'partial'}
                            onChange={(e) => setPaymentType(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor="partialPayment">
                            💸 Partial Payment
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {paymentType === 'partial' && (
                      <div className="mb-3">
                        <label className="form-label">Payment Amount (GHS)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Enter amount"
                          min="0.01"
                          max={remainingBalance}
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Mobile Money Provider</label>
                      <select 
                        className="form-select" 
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                      >
                        <option value="mtn">📱 MTN Mobile Money</option>
                        <option value="hubtel">💳 Hubtel</option>
                        <option value="airtel">📞 AirtelTigo Money</option>
                      </select>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Mobile Number</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="e.g., 0241234567"
                        maxLength="10"
                      />
                    </div>
                  </div>
                </div>
                
                {paymentHistory.length > 0 && (
                  <div className="mt-4">
                    <h6>📋 Payment History</h6>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Provider</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentHistory.map(payment => (
                            <tr key={payment.id}>
                              <td>{payment.date}</td>
                              <td>GHS {payment.amount.toFixed(2)}</td>
                              <td>{payment.provider}</td>
                              <td>
                                <span className={`badge ${payment.type === 'full' ? 'bg-success' : 'bg-warning'}`}>
                                  {payment.type === 'full' ? 'Full' : 'Partial'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessingPayment}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={handlePaymentSubmit}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    '🚀 Process Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Completed loan screen
  const renderCompletedScreen = () => (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm border-success">
            <div className="card-body text-center py-5">
              <div className="text-success mb-4">
                <i className="fas fa-trophy" style={{fontSize: '4rem'}}></i>
              </div>
              <h3 className="text-success mb-3">🎉 Loan Completed!</h3>
              <p className="lead mb-4">Congratulations! You have successfully repaid your loan.</p>
              
              <div className="alert alert-success">
                <strong>✅ Well Done!</strong> Your successful repayment has been recorded and may help improve your loan level.
              </div>
              
              <div className="mt-4">
                <button 
                  className="btn btn-primary btn-lg me-3" 
                  onClick={() => {
                    setActiveLoan(null);
                    setLoanStatus(null);
                    showToast('You can now apply for a new loan with potentially better terms!', 'success');
                  }}
                >
                  🆕 Apply for New Loan
                </button>
                <button className="btn btn-outline-secondary" onClick={() => navigate('/history')}>
                  📋 View History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const handleSubmit = async (e) => {
    console.log('🔥🔥🔥 HANDLESUBMIT FUNCTION CALLED!');
    e.preventDefault();
    
    // Check if there's already an active loan to prevent duplicate submissions
    if (activeLoan && ['pending', 'under-review', 'approved', 'disbursed', 'active'].includes(activeLoan.status)) {
      showToast('❌ You already have an active loan application. Please complete or wait for your current loan to be processed.', 'error');
      return;
    }
    
    setIsSubmitting(true);
    
    console.log('🚀 Starting loan application submission...');
    console.log('Current state:', { loanAmount, selectedTerm, termsAccepted, currentLevel });
    
    try {
      // Validate loan amount against user's level limits
      if (currentLevel && (loanAmount < currentLevel.minAmount || loanAmount > currentLevel.maxAmount)) {
        showToast(`Loan amount must be between GHS ${currentLevel.minAmount.toLocaleString()} and GHS ${currentLevel.maxAmount.toLocaleString()} for your current level`, 'error');
        setIsSubmitting(false);
        return;
      }
      
      const fees = getCurrentFees();
      const totalRepayment = calculateTotalRepayment();
      
      const loanData = {
        amount: loanAmount,
        duration: Math.ceil(selectedTerm / 30), // Convert days to months
        termInDays: selectedTerm,
        purpose: 'other', // Valid enum value from backend
        termsAccepted: termsAccepted,
        loanLevel: currentLevel?.levelNumber || 1
      };
      
      console.log('📤 Sending loan data:', loanData);
      
      const response = await loansAPI.applyForLoan(loanData);
      
      // Validate response structure
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      const newLoan = response.data.loan || response.data;
      
      if (!newLoan) {
        throw new Error('No loan data received from server');
      }
      
      console.log('📥 Received loan response:', newLoan);
      
      // Set the active loan and status - ensure status is properly set
      const loanStatus = newLoan.status || 'under-review'; // Default to under-review if status is undefined
      setActiveLoan(newLoan);
      setLoanStatus(loanStatus);
      
      console.log('✅ Updated state - activeLoan:', newLoan, 'loanStatus:', loanStatus);
      
      // Show appropriate message based on status with clear feedback
      if (loanStatus === 'approved') {
        showToast('🎉 Congratulations! Your loan has been auto-approved and is ready for disbursement!', 'success');
      } else if (loanStatus === 'under-review' || loanStatus === 'pending') {
        showToast('✅ Loan application submitted successfully! Your application is now under review. You will be notified once a decision is made.', 'success');
      } else {
        showToast(`✅ Loan application submitted with status: ${loanStatus}`, 'success');
      }
      
      // Force a re-check of active loans to ensure consistency
      setTimeout(() => {
        console.log('🔄 Calling checkActiveLoan after timeout...');
        checkActiveLoan();
      }, 1000);
      
      // Don't navigate away - stay on the page to show status
    } catch (error) {
      console.error('❌ Loan application error:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('active loan exists')) {
        showToast('❌ You already have an active loan. Please complete your current loan before applying for a new one.', 'error');
      } else {
        showToast(error.message || 'Failed to submit loan application. Please try again.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleMakePayment = () => {
    console.log('🚀 handleMakePayment called - opening payment modal');
    console.log('📊 Current showPaymentModal state:', showPaymentModal);
    console.log('💰 Remaining balance:', remainingBalance);
    console.log('🏦 Active loan:', activeLoan);
    setShowPaymentModal(true);
    console.log('✅ Payment modal state set to true');
  };
  
  const [paymentType, setPaymentType] = useState('full');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('mtn');
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handlePaymentSubmit = async () => {
    const currentBalance = remainingBalance || 0;
    const amount = paymentType === 'full' ? currentBalance : parseFloat(paymentAmount);
    
    // Validation
    if (paymentType === 'partial' && (!paymentAmount || amount <= 0)) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }
    
    if (amount > currentBalance) {
      showToast(`Payment amount (GHS ${amount.toFixed(2)}) cannot exceed remaining balance (GHS ${currentBalance.toFixed(2)}).`, 'error');
      return;
    }
    
    if (!mobileNumber || mobileNumber.length < 10) {
      showToast('Please enter a valid mobile number.', 'error');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      // Get the active loan ID
      const activeLoan = loanStatus;
      if (!activeLoan || !activeLoan._id) {
        showToast('No active loan found for payment.', 'error');
        return;
      }

      // Prepare payment data
      const paymentData = {
        loanId: activeLoan._id,
        amount: amount,
        paymentType: paymentType,
        mobileMoneyProvider: selectedProvider.toUpperCase(),
        mobileNumber: mobileNumber
      };

      // Initiate payment
      const response = await paymentsAPI.initiatePayment(paymentData);
      
      if (response.success) {
        showToast(`Payment initiated successfully! Transaction ID: ${response.payment.transactionId}`, 'success');
        
        // Close modal and reset form
        setShowPaymentModal(false);
        setPaymentAmount('');
        setMobileNumber('');
        
        // Refresh loan data to get updated balance
         await checkActiveLoan();
        
        // Show processing message
        showToast('Payment is being processed. You will be notified once completed.', 'info');
      } else {
        showToast(response.message || 'Failed to initiate payment', 'error');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      showToast('Failed to process payment. Please try again.', 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  };
  

  
  // Main loan application form (when no active loan)
  const renderLoanApplicationForm = () => (
    <div className="container mt-4">
      <div className="page-header">
        <button 
          className="btn btn-outline-light btn-sm mb-3"
          onClick={() => navigate('/home')}
        >
          ← Back
        </button>
        <h1 className="page-title">Apply for a Loan</h1>
        <p className="page-subtitle">
          {currentLevel ? (
            <>Get instant loans from GHS {minAmount.toLocaleString()} to GHS {maxAmount.toLocaleString()} - {currentLevel.name} Level</>
          ) : (
            'Loading loan information...'
          )}
        </p>
      </div>
      
      <form onSubmit={(e) => {
          console.log('🔥🔥🔥 FORM ONSUBMIT TRIGGERED! Terms accepted:', termsAccepted);
          console.log('🔥🔥🔥 Event:', e);
          console.log('🔥🔥🔥 About to call handleSubmit...');
          handleSubmit(e);
        }}>
        <div className="card custom-card">
          <div className="card-body">
            <h3 className="card-title text-primary mb-4">💰 Loan Amount</h3>
            <div className="text-center mb-4">
              <div className="display-4 text-primary fw-bold">GHS {loanAmount.toFixed(2)}</div>
            </div>
            
            <div className="mb-4">
              <input
                type="range"
                min={minAmount}
                max={maxAmount}
                step="50"
                value={loanAmount}
                onChange={handleSliderChange}
                className="form-range"
                disabled={!currentLevel}
              />
              <div className="d-flex justify-content-between mt-2">
                <small className="text-muted">GHS {minAmount.toLocaleString()}</small>
                <small className="text-muted">GHS {maxAmount.toLocaleString()}</small>
              </div>
              {currentLevel && (
                <div className="text-center mt-2">
                  <small className="badge bg-primary">{currentLevel.name} Level</small>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <LoanTermsCarousel 
          selectedTerm={loanTerm}
          onTermChange={(days, termData) => {
            setLoanTerm(days);
            setSelectedTerm(days);
            // Store term data for fee calculations if available
            if (termData) {
              // Update dynamic fees based on selected term
              calculateDynamicFees(loanAmount, days);
            }
          }}
          userLevel={currentLevel}
        />
        
        {/* Loan Level Information */}
        {userLevelInfo && (
          <div className="card custom-card">
            <div className="card-body">
              <h3 className="card-title text-warning mb-4">🏆 Your Loan Level</h3>
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="text-center p-3 bg-light rounded">
                    <h5 className="text-primary mb-1">{currentLevel?.name}</h5>
                    <small className="text-muted">Level {currentLevel?.levelNumber}</small>
                    <div className="mt-2">
                      <small className="d-block">Loan Range: GHS {currentLevel?.minAmount?.toLocaleString()} - GHS {currentLevel?.maxAmount?.toLocaleString()}</small>
                      <small className="d-block">Interest Rate: {currentLevel?.interestRate}%</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3">
                    <h6 className="mb-2">Progress to Next Level:</h6>
                    <div className="mb-2">
                      <small className="text-muted">Loans Completed: {userLevelInfo.totalLoansCompleted} / {currentLevel?.minLoansRequired || 'N/A'}</small>
                      <div className="progress" style={{height: '6px'}}>
                        <div 
                          className="progress-bar bg-success" 
                          style={{width: `${Math.min(100, (userLevelInfo.totalLoansCompleted / (currentLevel?.minLoansRequired || 1)) * 100)}%`}}
                        ></div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <small className="text-muted">Amount Repaid: GHS {userLevelInfo.totalAmountRepaid?.toLocaleString() || '0'}</small>
                    </div>
                    {userLevelInfo.canProgress && (
                      <div className="alert alert-success py-2 px-3 mb-0">
                        <small>🎉 Ready for next level!</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="card custom-card">
          <div className="card-body">
            <h3 className="card-title text-info mb-4">📊 Loan Summary</h3>
            <div className="row mb-3">
              <div className="col-6">Loan Amount:</div>
              <div className="col-6 text-end fw-bold">GHS {loanAmount.toFixed(2)}</div>
            </div>
            
            {/* Fee Breakdown */}
            <div className="mb-3">
              <h6 className="text-muted mb-2">
                Fee Breakdown:
                {isCalculatingFees && <span className="spinner-border spinner-border-sm ms-2" role="status"></span>}
              </h6>
              {(() => {
                const fees = getCurrentFees();
                return (
                  <>
                    <div className="row mb-2">
                      <div className="col-8">Interest ({((fees.interestAmount / loanAmount) * 100).toFixed(1)}%):</div>
                      <div className="col-4 text-end text-warning">GHS {fees.interestAmount.toFixed(2)}</div>
                    </div>
                    {fees.serviceFee > 0 && (
                      <div className="row mb-2">
                        <div className="col-8">Service Fee ({((fees.serviceFee / loanAmount) * 100).toFixed(1)}%):</div>
                        <div className="col-4 text-end text-info">GHS {fees.serviceFee.toFixed(2)}</div>
                      </div>
                    )}
                    {fees.processingFee > 0 && (
                      <div className="row mb-2">
                        <div className="col-8">Processing Fee ({((fees.processingFee / loanAmount) * 100).toFixed(1)}%):</div>
                        <div className="col-4 text-end text-info">GHS {fees.processingFee.toFixed(2)}</div>
                      </div>
                    )}
                    {fees.commitmentFee > 0 && (
                      <div className="row mb-2">
                        <div className="col-8">Commitment Fee ({((fees.commitmentFee / loanAmount) * 100).toFixed(1)}%):</div>
                        <div className="col-4 text-end text-info">GHS {fees.commitmentFee.toFixed(2)}</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            <hr />
            <div className="row mb-3">
              <div className="col-6 fw-bold text-primary">Total Repayment:</div>
              <div className="col-6 text-end fw-bold text-primary fs-5">GHS {calculateTotalRepayment().toFixed(2)}</div>
            </div>
            
            <div className="alert alert-warning mt-3">
              <small>
                <strong>⚠️ Important:</strong> Overdue penalty of <strong>2% per day</strong> applies to late payments.
              </small>
            </div>
            <div className="row mb-2">
              <div className="col-6">Total Fee Rate:</div>
              <div className="col-6 text-end fw-bold text-success">{((getCurrentFees().totalFees / loanAmount) * 100).toFixed(1)}%</div>
            </div>
            <div className="row">
              <div className="col-6">Due Date:</div>
              <div className="col-6 text-end fw-bold text-success">{new Date(Date.now() + loanTerm * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        {/* Loan Status Display */}
        {loanStatus && (
          <div className={`alert ${loanStatus === 'approved' ? 'alert-success' : loanStatus === 'rejected' ? 'alert-danger' : 'alert-info'} mb-3`}>
            <strong>Loan Status: </strong>
            {(loanStatus === 'pending' || loanStatus === 'under-review' || loanStatus === 'under_review') && '🔍 Under Review - Please wait for admin approval'}
            {loanStatus === 'rejected' && '❌ Rejected - You can apply for a new loan'}
            {loanStatus === 'approved' && '✅ Approved - Ready for payment'}
            {loanStatus === 'active' && '💰 Active Loan - Make payments to reduce balance'}
            {loanStatus === 'disbursed' && '💸 Loan Disbursed - Repayment period has started'}
            {loanStatus === 'completed' && '✅ Loan Completed - Thank you for your business'}
            {loanStatus === 'overdue' && '⚠️ Overdue - Please make payment immediately to avoid additional penalties'}
            {!['pending', 'under-review', 'under_review', 'rejected', 'approved', 'active', 'disbursed', 'completed', 'overdue'].includes(loanStatus) && `📋 Status: ${loanStatus}`}
          </div>
        )}
        
        {/* Terms and Conditions */}
         {!loanStatus && (
           <div className="card mb-4">
             <div className="card-header">
               <h6 className="mb-0">📋 Terms and Conditions</h6>
             </div>
             <div className="card-body" style={{maxHeight: '200px', overflowY: 'auto'}}>
               <div className="small">
                 <h6>CEDI Loan Terms and Conditions</h6>
                 <p><strong>1. Loan Agreement:</strong> By applying for this loan, you agree to repay the full amount plus applicable fees within the specified term.</p>
                 
                 <p><strong>2. Interest Rates:</strong></p>
                 <ul>
                   <li>7-day loans: 1% interest + applicable fees = 22% total</li>
                   <li>14-day loans: 2% interest + applicable fees = 26% total</li>
                   <li>30-day loans: 4% interest + applicable fees = 30% total</li>
                 </ul>
                 
                 <p><strong>3. Overdue Penalties:</strong> A penalty of 2% per day will be charged on the remaining outstanding loan balance for overdue payments.</p>
                 
                 <p><strong>4. Payment Methods:</strong> Payments can be made via mobile money (MTN, Airtel, Hubtel) in full or partial amounts.</p>
                 
                 <p><strong>5. Partial Payments:</strong> Partial payments are accepted, but overdue penalties apply to the remaining balance.</p>
                 
                 <p><strong>6. Loan Approval:</strong> All loans are subject to approval. Rejected applications can reapply immediately.</p>
                 
                 <p><strong>7. Data Privacy:</strong> Your personal and financial information is protected and used only for loan processing.</p>
                 
                 <p><strong>8. Default:</strong> Failure to repay may result in additional penalties and affect future loan eligibility.</p>
                 
                 <p><strong>9. Contact:</strong> For support, contact our customer service team.</p>
                 
                 <p><strong>10. Agreement:</strong> By checking the box below, you acknowledge that you have read, understood, and agree to these terms.</p>
               </div>
             </div>
             <div className="card-footer">
               <div className="form-check">
                 <input 
                   className="form-check-input" 
                   type="checkbox" 
                   id="termsCheck"
                   checked={termsAccepted}
                   onChange={(e) => {
                     console.log('✅ Terms checkbox clicked:', e.target.checked);
                     setTermsAccepted(e.target.checked);
                   }}
                 />
                 <label className="form-check-label" htmlFor="termsCheck">
                   I have read and agree to the Terms and Conditions
                 </label>
               </div>
             </div>
           </div>
         )}
         

        
        <div className="d-grid gap-2 mt-4 page-bottom-actions">

          
          {loanStatus === 'approved' ? (
            <div>
              <div className="alert alert-info mb-3">
                ✅ <strong>Loan Approved!</strong><br/>
                Outstanding Balance: <strong>GHS {remainingBalance?.toFixed(2) || '0.00'}</strong>
              </div>
              <button 
                className="btn btn-success btn-lg btn-custom" 
                onClick={handleMakePayment}
              >
                💳 Make Payment
              </button>
            </div>
          ) : loanStatus === 'rejected' ? (
            <div>
              <div className="alert alert-danger mb-3">
                ❌ <strong>Application Rejected</strong><br/>
                Your loan application has been rejected. Please review your information and try again.
              </div>
              <button 
                type="submit" 
                className="btn btn-primary btn-lg btn-custom"
                disabled={isSubmitting || !termsAccepted}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Processing...
                  </>
                ) : !termsAccepted ? (
                  '📋 Accept Terms to Continue'
                ) : (
                  '🔄 Reapply'
                )}
              </button>
            </div>
          ) : (
            <button 
               type="submit" 
               className="btn btn-primary btn-lg btn-custom"
               disabled={isSubmitting || ['pending', 'under-review', 'under_review'].includes(loanStatus) || !termsAccepted || (activeLoan && ['pending', 'under-review', 'approved', 'disbursed', 'active'].includes(activeLoan.status))}
               onClick={() => {
                 console.log('🔥🔥🔥 SUBMIT BUTTON CLICKED!');
                 console.log('🔥🔥🔥 Button state:', { isSubmitting, loanStatus, termsAccepted, activeLoan });
                 console.log('🔥🔥🔥 Button disabled?', isSubmitting || loanStatus === 'under-review' || !termsAccepted || (activeLoan && ['pending', 'under-review', 'approved', 'disbursed', 'active'].includes(activeLoan.status)));
               }}
             >
               {isSubmitting ? (
                 <>
                   <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                   Processing...
                 </>
               ) : (activeLoan && ['pending', 'under-review', 'approved', 'disbursed', 'active'].includes(activeLoan.status)) ? (
                   '🚫 Active Loan Exists'
                 ) : ['pending', 'under-review', 'under_review'].includes(loanStatus) ? (
                   '⏳ Application Under Review'
               ) : !termsAccepted ? (
                 '📋 Accept Terms to Continue'
               ) : (
                 '🚀 Apply Now'
               )}
             </button>
          )}
        </div>
      </form>
      
      {/* Payment Modal */}
      {console.log('🎭 Modal render check - showPaymentModal:', showPaymentModal)}
      {showPaymentModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">💳 Make Payment</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowPaymentModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Outstanding Balance: <span className="text-danger">GHS {remainingBalance?.toFixed(2) || '0.00'}</span></h6>
                    
                    <div className="mb-3">
                      <label className="form-label">Payment Type</label>
                      <div>
                        <div className="form-check">
                          <input 
                            className="form-check-input" 
                            type="radio" 
                            name="paymentType" 
                            id="fullPayment"
                            value="full"
                            checked={paymentType === 'full'}
                            onChange={(e) => setPaymentType(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor="fullPayment">
                            💰 Full Payment (GHS {remainingBalance?.toFixed(2) || '0.00'})
                          </label>
                        </div>
                        <div className="form-check">
                          <input 
                            className="form-check-input" 
                            type="radio" 
                            name="paymentType" 
                            id="partialPayment"
                            value="partial"
                            checked={paymentType === 'partial'}
                            onChange={(e) => setPaymentType(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor="partialPayment">
                            💸 Partial Payment
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {paymentType === 'partial' && (
                      <div className="mb-3">
                        <label className="form-label">Payment Amount (GHS)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Enter amount"
                          min="0.01"
                          max={remainingBalance}
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Mobile Money Provider</label>
                      <select 
                        className="form-select" 
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                      >
                        <option value="mtn">📱 MTN Mobile Money</option>
                        <option value="hubtel">💳 Hubtel</option>
                        <option value="airtel">📞 AirtelTigo Money</option>
                      </select>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Mobile Number</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="e.g., 0241234567"
                        maxLength="10"
                      />
                    </div>
                  </div>
                </div>
                
                {paymentHistory.length > 0 && (
                  <div className="mt-4">
                    <h6>📋 Payment History</h6>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Provider</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentHistory.map(payment => (
                            <tr key={payment.id}>
                              <td>{payment.date}</td>
                              <td>GHS {payment.amount.toFixed(2)}</td>
                              <td>{payment.provider}</td>
                              <td>
                                <span className={`badge ${payment.type === 'full' ? 'bg-success' : 'bg-warning'}`}>
                                  {payment.type === 'full' ? 'Full' : 'Partial'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessingPayment}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={handlePaymentSubmit}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Processing...
                    </>
                  ) : (
                    '🚀 Process Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Main render logic
  console.log('🎨 Main render - isLoading:', isLoading, 'loanStatus:', loanStatus, 'activeLoan:', !!activeLoan);
  
  return (
    <div className="container mt-4">
      {renderLoanStatusScreen()}
    </div>
  );
};

export default LoanApplication;