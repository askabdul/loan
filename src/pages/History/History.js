import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useSocket } from '../../contexts/SocketContext';
import { loansAPI, paymentsAPI } from '../../services/api';

const History = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  useSocket(); // Initialize socket connection
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const [loansResponse, paymentsResponse] = await Promise.all([
          loansAPI.getUserLoans(),
          paymentsAPI.getUserPayments()
        ]);
        
        const loans = loansResponse.loans || [];
        const payments = paymentsResponse.payments || [];
        
        const allTransactions = [];
        
        // Add loan transactions
        loans.forEach(loan => {
          allTransactions.push({
            id: loan._id, // Use MongoDB _id for loan extension routing
            loanId: loan.loanId, // Keep loanId for display purposes
            type: 'loan',
            amount: loan.amount,
            currency: 'GHS',
            status: loan.status,
            date: new Date(loan.applicationDate || loan.createdAt),
            description: `Loan Application - ${loan.duration} month(s) (ID: ${loan.loanId})`
          });
        });
        
        // Add payment transactions
        payments.forEach(payment => {
          allTransactions.push({
            id: payment._id,
            type: 'repayment',
            amount: payment.amount,
            currency: 'GHS',
            status: payment.status,
            date: new Date(payment.createdAt),
            description: 'Loan repayment'
          });
        });
        
        // Sort by date (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        setTransactions(allTransactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        showToast('Failed to load transaction history', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchTransactions();
    }
  }, [user, showToast]);

  // Listen for real-time transaction updates
  useEffect(() => {
    const handleTransactionUpdate = (event) => {
      const { type, message } = event.detail;

      
      // Refresh transactions when updates are received
      if (type === 'loan-status-changed' || type === 'payment-received') {
        // Refetch transactions to get the latest data
        const fetchUpdatedTransactions = async () => {
          try {
            const [loans, payments] = await Promise.all([
              loansAPI.getUserLoans(),
              paymentsAPI.getUserPayments()
            ]);
            
            const allTransactions = [];
            
            // Add loan transactions
            loans.forEach(loan => {
              allTransactions.push({
                id: loan.loanId || loan._id,
                type: 'loan',
                amount: loan.amount,
                currency: 'GHS',
                status: loan.status,
                date: new Date(loan.createdAt),
                referenceNumber: loan.referenceNumber || 'N/A'
              });
            });
            
            // Add payment transactions
            payments.forEach(payment => {
              allTransactions.push({
                id: payment._id,
                type: 'payment',
                amount: payment.amount,
                currency: 'GHS',
                status: payment.status,
                date: new Date(payment.createdAt),
                referenceNumber: payment.referenceNumber || 'N/A'
              });
            });
            
            // Sort by date (newest first)
            allTransactions.sort((a, b) => b.date - a.date);
            setTransactions(allTransactions);
          } catch (error) {

          }
        };
        
        fetchUpdatedTransactions();
      }
      
      // Show toast notification
      if (message) {
        showToast(message, 'info');
      }
    };

    // Add event listeners for transaction updates
    window.addEventListener('loanStatusUpdate', handleTransactionUpdate);
    window.addEventListener('paymentUpdate', handleTransactionUpdate);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('loanStatusUpdate', handleTransactionUpdate);
      window.removeEventListener('paymentUpdate', handleTransactionUpdate);
    };
  }, [showToast]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="container mt-4">
      <div className="page-header">
        <button 
          className="btn btn-outline-light btn-sm mb-3"
          onClick={() => navigate('/home')}
        >
          ← Back
        </button>
        <h1 className="page-title">Transaction History</h1>
        <p className="page-subtitle">View all your loan transactions</p>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading transactions...</p>
        </div>
      ) : transactions.length > 0 ? (
        <div className="row">
          {transactions.map(transaction => (
            <div key={transaction.id} className="col-12 mb-3">
              <div className="card custom-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        {transaction.type === 'loan' ? (
                          <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                            💰
                          </div>
                        ) : (
                          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                            💸
                          </div>
                        )}
                      </div>
                      <div>
                        <h6 className="card-title mb-1">
                          {transaction.type === 'loan' ? 'Loan' : 'Repayment'}
                        </h6>
                        <span className={`status-badge status-${transaction.status}`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className={`fs-5 fw-bold ${transaction.type === 'loan' ? 'text-success' : 'text-primary'}`}>
                        {transaction.type === 'repayment' ? '-' : '+'} {transaction.currency} {transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-8">
                      <p className="card-text text-muted mb-1">{transaction.description}</p>
                    </div>
                    <div className="col-4 text-end">
                      <small className="text-muted">{formatDate(transaction.date)}</small>
                    </div>
                  </div>
                  
                  {/* Show Extend Loan button for active loans */}
                  {transaction.type === 'loan' && transaction.status === 'active' && (
                    <div className="mt-3 pt-3 border-top">
                      <button 
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => navigate(`/loan-extension/${transaction.id}`)}
                      >
                        📅 Extend Loan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-5">
          <div className="card custom-card">
            <div className="card-body">
              <div className="mb-4">
                <div className="display-1 text-muted">📜</div>
              </div>
              <h4 className="card-title text-muted">No Transaction History</h4>
              <p className="card-text text-muted mb-4">You haven't made any transactions yet. Start by applying for your first loan!</p>
              <div className="page-bottom-actions">
                <button 
                  className="btn btn-primary btn-lg btn-custom"
                  onClick={() => navigate('/apply')}
                >
                  🚀 Apply for a Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;