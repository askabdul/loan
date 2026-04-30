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
          const months = loan.duration || (loan.termInDays ? Math.ceil(loan.termInDays / 30) : null);
          const termText = months ? `${months} month(s)` : (loan.termInDays ? `${loan.termInDays} day(s)` : 'Term not specified');
          allTransactions.push({
            id: loan._id, // Use MongoDB _id for loan extension routing
            loanId: loan.loanId, // Keep loanId for display purposes
            type: 'loan',
            amount: loan.amount,
            currency: 'GHS',
            status: loan.status,
            isOverdue: !!loan.isOverdue,
            date: new Date(loan.applicationDate || loan.createdAt),
            description: `Loan Application - ${termText} (ID: ${loan.loanId || 'N/A'})`
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
    <div className="max-w-xl mx-auto px-4 mt-4">
      <div className="page-header mb-4">
        <button 
          className="mb-3 inline-flex items-center rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          onClick={() => navigate('/home')}
        >
          ← Back
        </button>
        <h1 className="page-title text-xl font-semibold">Transaction History</h1>
        <p className="page-subtitle text-gray-500">View all your loan transactions</p>
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
              <div className="bg-white shadow rounded-lg">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className="mr-3">
                        {transaction.type === 'loan' ? (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-600 text-white">
                            💰
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white">
                            💸
                          </div>
                        )}
                      </div>
                      <div>
                        <h6 className="text-base font-semibold mb-1">
                          {transaction.type === 'loan' ? 'Loan' : 'Repayment'}
                        </h6>
                        <span className={`status-badge status-${transaction.status}`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className={`text-lg font-bold ${transaction.type === 'loan' ? 'text-green-600' : 'text-blue-600'}`}>
                        {transaction.type === 'repayment' ? '-' : '+'} {transaction.currency} {transaction.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-12">
                    <div className="col-span-8">
                      <p className="text-gray-600 mb-1">{transaction.description}</p>
                    </div>
                    <div className="col-span-4 text-right">
                      <small className="text-gray-500">{formatDate(transaction.date)}</small>
                    </div>
                  </div>
                  
                  {/* Show Extend Loan button for active loans */}
                  {transaction.type === 'loan' && transaction.status === 'active' && !transaction.isOverdue && (
                    <div className="mt-3 pt-3 border-top">
                      <button 
                        className="inline-flex items-center rounded border border-blue-500 text-blue-600 hover:bg-blue-50 px-3 py-1.5 text-sm"
                        onClick={() => navigate(`/loan-extension/${transaction.id}`)}
                      >
                        📅 Extend Loan
                      </button>
                    </div>
                  )}
                  
                  {/* Show Repayment button for active or overdue loans */}
                  {transaction.type === 'loan' && (transaction.status === 'active' || transaction.status === 'overdue') && (
                    <div className="mt-3">
                      <button 
                        className="inline-flex items-center rounded border border-green-500 text-green-600 hover:bg-green-50 px-3 py-1.5 text-sm"
                        onClick={() => navigate('/apply')}
                      >
                        💳 Make Repayment
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
          <div className="bg-white shadow rounded-lg">
            <div className="p-6">
              <div className="mb-4">
                <div className="text-5xl text-gray-400">📜</div>
              </div>
              <h4 className="text-lg font-semibold text-gray-600">No Transaction History</h4>
              <p className="text-gray-500 mb-4">You haven't made any transactions yet. Start by applying for your first loan!</p>
              <div className="page-bottom-actions">
                <button 
                  className="inline-flex items-center rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-base font-medium w-full max-w-xs mx-auto"
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
