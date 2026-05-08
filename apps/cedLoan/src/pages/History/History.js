import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import { loansAPI, paymentsAPI } from "../../services/api";

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
          paymentsAPI.getUserPayments(),
        ]);

        const loans = loansResponse.loans || [];
        const payments = paymentsResponse.payments || [];

        const allTransactions = [];

        // Add loan transactions
        loans.forEach((loan) => {
          const months =
            loan.duration ||
            (loan.termInDays ? Math.ceil(loan.termInDays / 30) : null);
          const termText = months
            ? `${months} month(s)`
            : loan.termInDays
              ? `${loan.termInDays} day(s)`
              : "Term not specified";
          allTransactions.push({
            id: loan.id,
            loanId: loan.loanId,
            type: "loan",
            amount: parseFloat(loan.amount) || 0,
            currency: "GHS",
            status: loan.status,
            isOverdue: !!loan.isOverdue,
            date: new Date(loan.applicationDate || loan.createdAt),
            description: `Loan Application - ${termText} (ID: ${loan.loanId || "N/A"})`,
          });
        });

        // Add payment transactions
        payments.forEach((payment) => {
          allTransactions.push({
            id: payment.id,
            type: "repayment",
            amount: parseFloat(payment.amount) || 0,
            currency: "GHS",
            status: payment.status,
            date: new Date(payment.createdAt),
            description: "Loan repayment",
          });
        });

        // Sort by date (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        setTransactions(allTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        showToast("Failed to load transaction history", "error");
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
      if (type === "loan-status-changed" || type === "payment-received") {
        // Refetch transactions to get the latest data
        const fetchUpdatedTransactions = async () => {
          try {
            const [loans, payments] = await Promise.all([
              loansAPI.getUserLoans(),
              paymentsAPI.getUserPayments(),
            ]);

            const allTransactions = [];

            // Add loan transactions
            loans.forEach((loan) => {
              allTransactions.push({
                id: loan.id,
                type: "loan",
                amount: parseFloat(loan.amount) || 0,
                currency: "GHS",
                status: loan.status,
                date: new Date(loan.createdAt),
                referenceNumber: loan.referenceNumber || "N/A",
              });
            });

            // Add payment transactions
            payments.forEach((payment) => {
              allTransactions.push({
                id: payment.id,
                type: "payment",
                amount: parseFloat(payment.amount) || 0,
                currency: "GHS",
                status: payment.status,
                date: new Date(payment.createdAt),
                referenceNumber: payment.referenceNumber || "N/A",
              });
            });

            // Sort by date (newest first)
            allTransactions.sort((a, b) => b.date - a.date);
            setTransactions(allTransactions);
          } catch (error) {}
        };

        fetchUpdatedTransactions();
      }

      // Show toast notification
      if (message) {
        showToast(message, "info");
      }
    };

    // Add event listeners for transaction updates
    window.addEventListener("loanStatusUpdate", handleTransactionUpdate);
    window.addEventListener("paymentUpdate", handleTransactionUpdate);

    // Cleanup event listeners
    return () => {
      window.removeEventListener("loanStatusUpdate", handleTransactionUpdate);
      window.removeEventListener("paymentUpdate", handleTransactionUpdate);
    };
  }, [showToast]);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-28 space-y-5">
      <div>
        <button
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
          onClick={() => navigate("/home")}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Transaction History
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          View all your loan transactions
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading transactions…</p>
        </div>
      ) : transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${transaction.type === "loan" ? "bg-emerald-100" : "bg-blue-100"}`}
                  >
                    <span className="text-lg">
                      {transaction.type === "loan" ? "💰" : "💸"}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800">
                      {transaction.type === "loan" ? "Loan" : "Repayment"}
                    </p>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        transaction.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : transaction.status === "active" ||
                              transaction.status === "disbursed"
                            ? "bg-blue-100 text-blue-700"
                            : transaction.status === "overdue"
                              ? "bg-red-100 text-red-700"
                              : transaction.status === "pending" ||
                                  transaction.status === "under-review"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${transaction.type === "loan" ? "text-emerald-600" : "text-blue-600"}`}
                  >
                    {transaction.type === "repayment" ? "−" : "+"}{" "}
                    {transaction.currency}{" "}
                    {(parseFloat(transaction.amount) || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-end pt-2 border-t border-gray-50">
                <p className="text-xs text-gray-400 leading-relaxed max-w-[65%]">
                  {transaction.description}
                </p>
                <p className="text-xs font-medium text-gray-500 flex-shrink-0">
                  {formatDate(transaction.date)}
                </p>
              </div>

              {/* Extend Loan button for active non-overdue loans */}
              {transaction.type === "loan" &&
                transaction.status === "active" &&
                !transaction.isOverdue && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl px-4 py-2 font-semibold"
                      onClick={() =>
                        navigate(`/loan-extension/${transaction.id}`)
                      }
                    >
                      📅 Extend Loan
                    </button>
                  </div>
                )}

              {/* Make Repayment button for active or overdue loans */}
              {transaction.type === "loan" &&
                (transaction.status === "active" ||
                  transaction.status === "overdue") && (
                  <div className="mt-2">
                    <button
                      className="inline-flex items-center gap-1.5 text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl px-4 py-2 font-semibold"
                      onClick={() => navigate("/apply")}
                    >
                      💳 Make Repayment
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">📜</div>
          <h4 className="text-base font-semibold text-gray-700 mb-1">
            No Transaction History
          </h4>
          <p className="text-sm text-gray-400 mb-6">
            You haven't made any transactions yet. Start by applying for your
            first loan!
          </p>
          <button
            className="w-full max-w-xs mx-auto block bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3 text-sm font-semibold"
            onClick={() => navigate("/apply")}
          >
            🚀 Apply for a Loan
          </button>
        </div>
      )}
    </div>
  );
};

export default History;
