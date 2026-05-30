import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import { useConfig } from "../../contexts/ConfigContext";
import { loansAPI, paymentsAPI } from "../../services/api";
import { loanLevelsAPI } from "../../services/loanLevelsAPI";
import configAPI from "../../services/configAPI";
import LoanTermsCarousel from "../../components/LoanTermsCarousel";

const LoanApplication = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { getLoanConfig, loading: configLoading } = useConfig();
  useSocket(); // Initialize socket connection
  const [loanAmount, setLoanAmount] = useState(100);
  const [loanTerm, setLoanTerm] = useState(14);
  const [loanStatus, setLoanStatus] = useState(null); // null, 'pending', 'under-review', 'approved', 'rejected', 'active', 'completed'
  const [activeLoan, setActiveLoan] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [userLevelInfo, setUserLevelInfo] = useState(null);
  const [availableTerms, setAvailableTerms] = useState([7, 14, 30]);
  const [dynamicFees, setDynamicFees] = useState(null);
  const [isCalculatingFees, setIsCalculatingFees] = useState(false);
  const [minAmount, setMinAmount] = useState(100);
  const [maxAmount, setMaxAmount] = useState(5000);

  // Listen for real-time loan status updates
  useEffect(() => {
    const handleLoanStatusUpdate = async (event) => {
      const { status } = event.detail;

      // Re-fetch the loan so updated fields (approvalDate, rejectionReason, etc.) are available
      await checkActiveLoan();
      setLoanStatus(status);
      // Toast is shown by SocketContext with the correct type — no duplicate needed here
    };

    // Add event listener for loan status updates
    window.addEventListener("loanStatusUpdate", handleLoanStatusUpdate);

    // Cleanup event listener
    return () => {
      window.removeEventListener("loanStatusUpdate", handleLoanStatusUpdate);
    };
  }, [showToast]);

  // Check for existing active loans
  const checkActiveLoan = async () => {
    try {
      const response = await loansAPI.getUserLoans();
      const loans = response.loans || [];

      // Find active loan
      const activeLoanFound = loans.find((loan) =>
        [
          "pending",
          "under-review",
          "approved",
          "disbursed",
          "active",
          "overdue",
        ].includes(loan.status),
      );

      if (activeLoanFound) {
        const currentBalance = activeLoanFound.remainingBalance || 0;

        // Only treat a zero balance as "fully repaid" for loans that were
        // actually disbursed — pending/under-review/approved loans always
        // have remainingBalance = 0 because nothing has been disbursed yet.
        const isDisbursed = ["active", "disbursed", "overdue"].includes(
          activeLoanFound.status,
        );
        if (isDisbursed && currentBalance === 0) {
          // Loan has been fully repaid — clear state and let the user apply again
          setActiveLoan(null);
          setLoanStatus(null);
          setRemainingBalance(0);
          showToast(
            "🎉 Congratulations! Your loan has been fully repaid!",
            "success",
          );
          return;
        }

        setActiveLoan(activeLoanFound);
        setLoanStatus(activeLoanFound.status);
        setRemainingBalance(currentBalance);
      } else {
        setActiveLoan(null);
        setLoanStatus(null);
        setRemainingBalance(0);
      }
    } catch (error) {
      console.error("Error checking active loans:", error);
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
          setAvailableTerms(
            levelInfo.data.currentLevel.availableTerms || [7, 14, 30],
          );
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
        console.error("Error fetching user data:", error);
        showToast("Failed to load loan information", "error");
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
          totalFees: result.data.fees.total,
        };
        setDynamicFees(fees);
        setIsCalculatingFees(false);
        return fees;
      }
    } catch (error) {
      console.error("Error calculating dynamic fees:", error);
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
    const interestRate = getLoanConfig(term, "interest_rate") || 0;
    const serviceFeeRate = getLoanConfig(term, "service_fee") || 0;
    const processingFeeRate =
      getLoanConfig(term, "processing_fee") ||
      getLoanConfig(term, "admin_fee") ||
      0;
    const commitmentFeeRate = getLoanConfig(term, "commitment_fee") || 0;

    const interestAmount = (amount * interestRate) / 100;
    const serviceFee = (amount * serviceFeeRate) / 100;
    const processingFee = (amount * processingFeeRate) / 100;
    const commitmentFee = (amount * commitmentFeeRate) / 100;

    return {
      interestAmount,
      serviceFee,
      processingFee,
      commitmentFee,
      totalFees: interestAmount + serviceFee + processingFee + commitmentFee,
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
      if (
        key.includes("interest_rate") ||
        key.includes("service_fee") ||
        key.includes("processing_fee") ||
        key.includes("admin_fee") ||
        key.includes("commitment_fee")
      ) {
        // Recalculate fees with new configuration
        if (loanAmount > 0 && loanTerm > 0) {
          calculateDynamicFees(loanAmount, loanTerm);
        }
      }
    };

    const handleBulkConfigUpdate = () => {
      // Recalculate fees after bulk update
      if (loanAmount > 0 && loanTerm > 0) {
        calculateDynamicFees(loanAmount, loanTerm);
      }
    };

    window.addEventListener("configUpdate", handleConfigUpdate);
    window.addEventListener("bulkConfigUpdate", handleBulkConfigUpdate);
    window.addEventListener("systemConfigUpdate", handleBulkConfigUpdate);

    return () => {
      window.removeEventListener("configUpdate", handleConfigUpdate);
      window.removeEventListener("bulkConfigUpdate", handleBulkConfigUpdate);
      window.removeEventListener("systemConfigUpdate", handleBulkConfigUpdate);
    };
  }, [loanAmount, loanTerm]);

  // Compute the loan's due date; fall back to an estimate when the backend
  // hasn't persisted it yet (e.g. loan is still "approved" before disbursement)
  const getLoanDueDate = (loan) => {
    if (loan.dueDate) return new Date(loan.dueDate);
    // Fall back: disbursementDate + termInDays
    if (loan.disbursementDate)
      return new Date(
        new Date(loan.disbursementDate).getTime() +
          (loan.termInDays || 30) * 24 * 60 * 60 * 1000,
      );
    // Last resort: approvalDate + termInDays (for "approved" state)
    if (loan.approvalDate)
      return new Date(
        new Date(loan.approvalDate).getTime() +
          (loan.termInDays || 30) * 24 * 60 * 60 * 1000,
      );
    return null;
  };

  const handleSliderChange = (e) => {
    setLoanAmount(parseInt(e.target.value));
  };

  const handleTermChange = (days) => {
    setSelectedTerm(days);
  };

  // Render different screens based on loan status

  const renderLoanStatusScreen = () => {
    if (isLoading || configLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">
            {configLoading
              ? "Loading configuration…"
              : "Loading loan information…"}
          </p>
        </div>
      );
    }

    // Show current loan if exists
    if (activeLoan) {
      return renderCurrentLoanContent();
    }

    // No loans at all - show application form directly
    return renderLoanApplicationForm();
  };

  // Render current loan content based on status
  const renderCurrentLoanContent = () => {
    if (!activeLoan) return null;

    switch (activeLoan.status) {
      case "pending":
      case "under-review":
        return renderPendingScreen();
      case "approved":
        return renderApprovedScreen();
      case "rejected":
        return renderRejectedScreen();
      case "disbursed":
        return renderDisbursedScreen();
      case "active":
      case "overdue":
        return renderActiveRepaymentScreen();
      case "completed":
        return renderCompletedScreen();
      default:
        return renderLoanApplicationForm();
    }
  };

  // Pending loan screen
  const renderPendingScreen = () => (
    <>
      {/* Status Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⏳</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          Application Under Review
        </h3>
        <p className="text-sm text-gray-500">
          Your loan application is being reviewed by our team.
        </p>
      </div>

      {/* Application Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-widest">
          Application Details
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Amount</span>
            <span className="text-sm font-bold text-gray-900">
              GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Term</span>
            <span className="text-sm font-bold text-gray-900">
              {activeLoan.termInDays} days
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Level</span>
            <span className="text-sm font-bold text-gray-900">
              {currentLevel?.name || "N/A"}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Applied</span>
            <span className="text-sm font-bold text-gray-900">
              {new Date(
                activeLoan.applicationDate || activeLoan.createdAt,
              ).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs text-amber-600 mb-4 font-semibold uppercase tracking-widest">
          What Happens Next
        </p>
        <div className="space-y-3">
          {[
            "✅ Application received",
            "🔍 Under review by our team",
            "⏳ Decision typically within 24 hrs",
            "📩 You'll be notified by SMS",
          ].map((s) => (
            <p key={s} className="text-sm text-gray-700">
              {s}
            </p>
          ))}
        </div>
      </div>

      {/* Need Help */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
        <p className="text-sm text-blue-700">
          <strong>📞 Need Help?</strong> Contact our support team if you have
          any questions about your application.
        </p>
      </div>
    </>
  );

  // Approved loan screen
  const renderApprovedScreen = () => (
    <>
      {/* Status Header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🎉</span>
        </div>
        <h3 className="text-xl font-bold text-emerald-700 mb-1">
          Loan Approved!
        </h3>
        <p className="text-sm text-gray-500">
          Your loan has been approved and is ready for disbursement.
        </p>
      </div>

      {/* Loan Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-widest">
          Loan Details
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Amount</span>
            <span className="text-sm font-bold text-gray-900">
              GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Term</span>
            <span className="text-sm font-bold text-gray-900">
              {activeLoan.termInDays} days
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Interest</span>
            <span className="text-sm font-bold text-gray-900">
              {currentLevel?.interestRate || 0}%
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">Total Repayment</span>
            <span className="text-sm font-bold text-blue-600">
              GHS{" "}
              {parseFloat(
                activeLoan.totalAmount || activeLoan.amount || 0,
              ).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Important Dates */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-widest">
          Important Dates
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Approved</span>
            <span className="text-sm font-bold text-gray-900">
              {new Date(activeLoan.approvalDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Due Date</span>
            <span className="text-sm font-bold text-gray-900">
              {(() => {
                const d = getLoanDueDate(activeLoan);
                return d
                  ? d.toLocaleDateString() +
                      (activeLoan.dueDate ? "" : " (est.)")
                  : "TBD";
              })()}
            </span>
          </div>
        </div>
      </div>

      {activeLoan.isAutoApproved && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
          <p className="text-sm text-emerald-700">
            <strong>⚡ Auto-Approved!</strong> {activeLoan.autoApprovalReason}
          </p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-700">
            Disbursement In Progress
          </span>
        </div>
        <p className="text-xs text-amber-600">
          Your loan has been approved and is being processed for disbursement.
          No action is needed from you. We will notify you once funds are sent.
        </p>
        <button
          className="w-full border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded-xl px-4 py-3 text-sm font-semibold"
          onClick={() => navigate("/history")}
        >
          📋 View Details
        </button>
      </div>
    </>
  );

  // Rejected loan screen
  const renderRejectedScreen = () => (
    <>
      {/* Status Header */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">❌</span>
        </div>
        <h3 className="text-xl font-bold text-red-600 mb-1">
          Application Not Approved
        </h3>
        <p className="text-sm text-gray-500">
          Unfortunately, your loan application of{" "}
          <strong>
            GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
          </strong>{" "}
          was not approved at this time.
        </p>
      </div>

      {activeLoan.rejectionReason && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <p className="text-sm text-amber-800">
            <strong>📋 Reason:</strong> {activeLoan.rejectionReason}
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-sm font-semibold text-blue-700 mb-3">
          💡 Tips to Improve Your Application
        </p>
        <ul className="space-y-2.5">
          {[
            "Complete more loans successfully to build your credit history",
            "Consider applying for a smaller amount",
            "Ensure all your profile information is complete and accurate",
            "Wait for your loan level to improve with successful repayments",
          ].map((tip) => (
            <li key={tip} className="text-xs text-gray-600 flex gap-2">
              <span className="text-blue-400 flex-shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3.5 text-sm font-semibold"
          onClick={() => {
            setActiveLoan(null);
            setLoanStatus(null);
            showToast("You can now apply for a new loan", "info");
          }}
        >
          🔄 Apply Again
        </button>
        <button
          className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded-xl px-4 py-3.5 text-sm font-semibold"
          onClick={() => navigate("/profile")}
        >
          👤 Update Profile
        </button>
      </div>
    </>
  );

  // Disbursed loan screen — admin confirms receipt and activates.
  const renderDisbursedScreen = () => {
    return (
      <>
        {/* Status Header */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">💸</span>
          </div>
          <h3 className="text-xl font-bold text-blue-700 mb-1">
            Funds Disbursed!
          </h3>
          <p className="text-sm text-gray-500">
            Your loan funds have been sent to your mobile money account.
          </p>
        </div>

        {/* Loan Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-widest">
            Loan Details
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Amount</span>
              <span className="text-sm font-bold text-gray-900">
                GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Term</span>
              <span className="text-sm font-bold text-gray-900">
                {activeLoan.termInDays} days
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Total Repayment</span>
              <span className="text-sm font-bold text-blue-600">
                GHS{" "}
                {parseFloat(
                  activeLoan.totalAmount || activeLoan.amount || 0,
                ).toLocaleString()}
              </span>
            </div>
            {activeLoan.disbursementDate && (
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500">Disbursed On</span>
                <span className="text-sm font-bold text-gray-900">
                  {new Date(activeLoan.disbursementDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {activeLoan.dueDate && (
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-500">Due Date</span>
                <span className="text-sm font-bold text-gray-900">
                  {new Date(activeLoan.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
          <p className="text-sm font-semibold text-gray-800">
            Funds sent — awaiting activation
          </p>
          <p className="text-xs text-gray-500">
            Our operations team will confirm delivery and activate your loan.
            Once activated, repayment countdown starts automatically.
          </p>
        </div>

        <button
          className="w-full border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded-xl px-4 py-3 text-sm font-semibold"
          onClick={() => navigate("/history")}
        >
          📋 View Loan Details
        </button>
      </>
    );
  };

  // Active repayment screen
  const renderActiveRepaymentScreen = () => (
    <>
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-md p-6 text-white">
        <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-2">
          Active Loan
        </p>
        <h3 className="text-2xl font-bold mb-1">Repayment Dashboard</h3>
        <p className="text-blue-100 text-sm">
          Manage your active loan and make payments
        </p>
      </div>

      {/* Loan Summary + Payment Progress */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Loan Summary
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Original Amount</span>
              <span className="text-base font-bold text-gray-900">
                GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Total Amount</span>
              <span className="text-base font-bold text-gray-900">
                GHS{" "}
                {parseFloat(
                  activeLoan.totalAmount || activeLoan.amount || 0,
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Remaining Balance</span>
              <span className="text-xl font-bold text-red-600">
                GHS {parseFloat(remainingBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Due Date</span>
              <span className="text-sm font-bold text-gray-900">
                {(() => {
                  const d = getLoanDueDate(activeLoan);
                  return d
                    ? d.toLocaleDateString() +
                        (activeLoan.dueDate ? "" : " (est.)")
                    : "TBD";
                })()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Payment Progress
          </p>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Paid</span>
              <span>
                {parseFloat(activeLoan.totalAmount || 0) > 0
                  ? Math.round(
                      ((parseFloat(activeLoan.totalAmount) -
                        parseFloat(remainingBalance || 0)) /
                        parseFloat(activeLoan.totalAmount)) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-3 bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${parseFloat(activeLoan.totalAmount || 0) > 0 ? ((parseFloat(activeLoan.totalAmount) - parseFloat(remainingBalance || 0)) / parseFloat(activeLoan.totalAmount)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Amount Paid</span>
            <span className="text-base font-bold text-emerald-600">
              GHS{" "}
              {parseFloat(activeLoan.totalAmount || 0) > 0
                ? (
                    parseFloat(activeLoan.totalAmount) -
                    parseFloat(remainingBalance || 0)
                  ).toLocaleString()
                : "0"}
            </span>
          </div>
        </div>
      </div>

      {activeLoan.isOverdue && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <p className="text-sm text-amber-800">
            <strong>⚠️ Overdue Notice:</strong> Your loan is{" "}
            {activeLoan.overdueDays} days overdue. Additional fees may apply.
            Please make a payment as soon as possible.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl px-4 py-2.5 text-sm font-semibold"
          onClick={handleMakePayment}
        >
          💰 Make Payment
        </button>
        <button
          className="w-full border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded-xl px-4 py-2.5 text-sm font-semibold"
          onClick={() => navigate("/history")}
        >
          📋 Payment History
        </button>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center pb-[60px] sm:pb-0"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[calc(100dvh-60px)] sm:max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h5 className="font-bold text-gray-800 text-base">
                  Make a Payment
                </h5>
                {activeLoan?.loanId && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Loan #{activeLoan.loanId}
                  </p>
                )}
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Loan summary strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Outstanding",
                    value: `GHS ${parseFloat(remainingBalance || 0).toFixed(2)}`,
                    accent: "text-red-600",
                  },
                  {
                    label: "Due date",
                    value: (() => {
                      const d = getLoanDueDate(activeLoan);
                      return d
                        ? d.toLocaleDateString() +
                            (activeLoan?.dueDate ? "" : "*")
                        : "TBD";
                    })(),
                    accent: (() => {
                      const d = getLoanDueDate(activeLoan);
                      if (!d) return "text-gray-600";
                      return d < new Date() ? "text-red-600" : "text-gray-800";
                    })(),
                  },
                  {
                    label: "Loan term",
                    value: `${activeLoan?.termInDays || "—"} days`,
                    accent: "text-gray-800",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-gray-50 rounded-xl p-3 text-center"
                  >
                    <p
                      className={`text-sm font-bold leading-tight ${item.accent}`}
                    >
                      {item.value}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Overdue notice */}
              {activeLoan?.isOverdue && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800 font-medium">
                    ⚠️ Your loan is {activeLoan.overdueDays} day
                    {activeLoan.overdueDays !== 1 ? "s" : ""} overdue. Please
                    pay as soon as possible to avoid additional penalties.
                  </p>
                </div>
              )}

              {/* Payment type */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Payment Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "full",
                      label: "Full payment",
                      sub: `GHS ${parseFloat(remainingBalance || 0).toFixed(2)}`,
                    },
                    {
                      value: "partial",
                      label: "Partial payment",
                      sub: "Choose amount",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                        paymentType === opt.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentType"
                          value={opt.value}
                          checked={paymentType === opt.value}
                          onChange={(e) => setPaymentType(e.target.value)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 mt-1 pl-5">
                        {opt.sub}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Partial amount */}
              {paymentType === "partial" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Payment Amount (GHS)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="0.01"
                    max={remainingBalance}
                    step="0.01"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Max: GHS {parseFloat(remainingBalance || 0).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Mobile Money Provider */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Mobile Money Provider
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  <option value="MTN">📱 MTN Mobile Money</option>
                  <option value="Telecel">📲 Telecel Money</option>
                  <option value="AirtelTigo">📞 AirtelTigo Money</option>
                </select>
              </div>

              {/* Mobile number */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={mobileNumber}
                  readOnly
                  disabled
                  placeholder="Auto-filled from your profile"
                  maxLength="10"
                />
              </div>

              {/* Recent payments */}
              {paymentHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Recent Payments
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Date", "Amount", "Provider", "Status"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paymentHistory.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {p.date}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-800">
                              GHS {parseFloat(p.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {p.provider}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                  p.status === "completed"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : p.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {p.status}
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

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors rounded-xl py-2.5 text-sm font-semibold"
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
                onClick={handlePaymentSubmit}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? "Processing…" : "Submit Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Completed loan screen
  const renderCompletedScreen = () => (
    <>
      {/* Status Header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🏆</span>
        </div>
        <h3 className="text-xl font-bold text-emerald-700 mb-1">
          Loan Completed!
        </h3>
        <p className="text-sm text-gray-500">
          Congratulations! You have successfully repaid your loan.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <p className="text-sm text-emerald-700">
          <strong>✅ Well Done!</strong> Your successful repayment has been
          recorded and may help improve your loan level.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3.5 text-sm font-semibold"
          onClick={() => {
            setActiveLoan(null);
            setLoanStatus(null);
            showToast(
              "You can now apply for a new loan with potentially better terms!",
              "success",
            );
          }}
        >
          🆕 Apply for New Loan
        </button>
        <button
          className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded-xl px-4 py-3.5 text-sm font-semibold"
          onClick={() => navigate("/history")}
        >
          📋 View History
        </button>
      </div>
    </>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── Guard 1: already have an outstanding loan (client-side fast check) ──
    if (
      activeLoan &&
      [
        "pending",
        "under-review",
        "approved",
        "disbursed",
        "active",
        "overdue",
      ].includes(activeLoan.status)
    ) {
      showToast(
        "You already have an active loan. Complete or repay it before applying again.",
        "warning",
      );
      return;
    }

    // ── Guard 2: terms must be accepted ────────────────────────────────────
    if (!termsAccepted) {
      showToast(
        "Please read and accept the terms and conditions to continue.",
        "info",
      );
      return;
    }

    // ── Guard 3: amount within level limits ────────────────────────────────
    if (currentLevel) {
      if (loanAmount < currentLevel.minAmount) {
        showToast(
          `Minimum loan amount for your level is GHS ${currentLevel.minAmount.toLocaleString()}.`,
          "error",
        );
        return;
      }
      if (loanAmount > currentLevel.maxAmount) {
        showToast(
          `Maximum loan amount for your level is GHS ${currentLevel.maxAmount.toLocaleString()}.`,
          "error",
        );
        return;
      }
    }

    setIsSubmitting(true);
    showToast("Submitting your application…", "info", 3000);

    try {
      const loanData = {
        amount: loanAmount,
        duration: Math.max(1, Math.ceil(selectedTerm / 30)),
        termInDays: selectedTerm,
        purpose: "other",
        termsAccepted: termsAccepted,
        loanLevel: currentLevel?.levelNumber || 1,
      };

      const response = await loansAPI.applyForLoan(loanData);

      // Backend returns { success, message, loan } directly (no .data wrapper)
      const newLoan = response.loan || response.data?.loan || response.data;

      if (!newLoan) {
        throw new Error("No loan data received from server.");
      }

      const loanStatus = newLoan.status || "pending";
      setActiveLoan(newLoan);
      setLoanStatus(loanStatus);

      if (loanStatus === "approved") {
        showToast(
          "Your loan has been auto-approved! It is ready for disbursement.",
          "success",
          8000,
        );
      } else {
        // pending or under-review
        showToast(
          "Application submitted! We are reviewing it now — you will be notified once a decision is made.",
          "success",
          8000,
        );
      }

      // Re-sync with server after a short delay
      setTimeout(() => checkActiveLoan(), 1200);
    } catch (error) {
      // ── HTTP 409: duplicate active loan ───────────────────────────────────
      if (error.status === 409) {
        await checkActiveLoan();
        const conflictLoan = error.data?.activeLoan;
        const statusLabel = conflictLoan?.status
          ? ` (currently ${conflictLoan.status})`
          : "";
        showToast(
          `You already have an open loan application${statusLabel}. Your current loan is shown below.`,
          "warning",
          7000,
        );
        return;
      }

      // ── HTTP 422: KYC incomplete ──────────────────────────────────────────
      if (error.status === 422) {
        const missing = error.data?.missingFields;
        const detail = missing?.length
          ? ` Missing: ${missing.join(", ")}.`
          : "";
        showToast(
          `Your profile is incomplete.${detail} Please complete your KYC information first.`,
          "warning",
          8000,
        );
        return;
      }

      // ── HTTP 400: validation / business rule errors ───────────────────────
      if (error.status === 400) {
        // Express-validator errors come as an array
        const fieldErrors = error.data?.errors;
        if (fieldErrors?.length) {
          const messages = fieldErrors.map((e) => e.msg).join(" • ");
          showToast(messages, "error", 8000);
        } else {
          showToast(
            error.message ||
              "Your application could not be submitted. Check your details and try again.",
            "error",
          );
        }
        return;
      }

      // ── All other errors ──────────────────────────────────────────────────
      showToast(
        error.message || "Something went wrong. Please try again.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakePayment = async () => {
    if (user?.phoneNumber) {
      setMobileNumber(user.phoneNumber);
    }

    // Fetch latest payment history when opening the modal
    try {
      const historyResponse = await paymentsAPI.getPaymentHistory(1, 5);
      const payments = historyResponse.payments || historyResponse.data || [];
      setPaymentHistory(
        payments.map((p) => ({
          id: p.id,
          date: new Date(p.createdAt || p.date).toLocaleDateString(),
          amount: p.amount,
          provider: p.mobileMoneyProvider || p.provider || "—",
          type: p.paymentType || "partial",
          status: p.status || "pending",
        })),
      );
    } catch (_) {
      // non-blocking — show modal even if history fails
    }
    setShowPaymentModal(true);
  };

  const [paymentType, setPaymentType] = useState("full");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState(user?.phoneNumber || "");
  const [selectedProvider, setSelectedProvider] = useState("MTN");

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (user?.phoneNumber) {
      setMobileNumber(user.phoneNumber);
    }
  }, [user?.phoneNumber]);

  const handlePaymentSubmit = async () => {
    const currentBalance = remainingBalance || 0;
    const amount =
      paymentType === "full"
        ? currentBalance
        : parseFloat(remainingBalance || 0);

    // Validation
    if (paymentType === "partial" && amount <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }

    if (amount > currentBalance) {
      showToast(
        `Payment amount (GHS ${amount.toFixed(2)}) cannot exceed remaining balance (GHS ${currentBalance.toFixed(2)}).`,
        "error",
      );
      return;
    }

    if (!mobileNumber || mobileNumber.length < 10) {
      showToast("Please enter a valid mobile number.", "error");
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Get the active loan ID
      if (!activeLoan || !activeLoan.id) {
        showToast("No active loan found for payment.", "error");
        return;
      }

      // Prepare payment data
      const paymentData = {
        loanId: activeLoan.id,
        amount: amount,
        paymentType: paymentType,
        mobileMoneyProvider: selectedProvider,
        mobileNumber: mobileNumber,
      };

      // Initiate payment
      const response = await paymentsAPI.initiatePayment(paymentData);

      if (response.success) {
        showToast(
          `Payment initiated successfully! Transaction ID: ${response.payment.transactionId}`,
          "success",
        );

        // Close modal and reset form
        setShowPaymentModal(false);
        setPaymentAmount("");

        // Refresh loan data to get updated balance
        await checkActiveLoan();

        // Show processing message
        showToast(
          "Payment is being processed. You will be notified once completed.",
          "info",
        );
      } else {
        showToast(response.message || "Failed to initiate payment", "error");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      showToast("Failed to process payment. Please try again.", "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Main loan application form (when no active loan)
  const renderLoanApplicationForm = () => (
    <>
      <div>
        <button
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
          onClick={() => navigate("/home")}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Apply for a Loan</h1>
        <p className="text-sm text-gray-400 mt-1">
          {currentLevel ? (
            <>
              Get instant loans from GHS {minAmount.toLocaleString()} to GHS{" "}
              {maxAmount.toLocaleString()} — {currentLevel.name} Level
            </>
          ) : (
            "Loading loan information..."
          )}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          handleSubmit(e);
        }}
        className="space-y-5"
      >
        {/* Loan Amount */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Loan Amount
          </p>
          <div className="text-center mb-5">
            <span className="text-5xl font-bold text-blue-600">
              GHS {loanAmount.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={minAmount}
            max={maxAmount}
            step="50"
            value={loanAmount}
            onChange={handleSliderChange}
            className="w-full accent-blue-600"
            disabled={!currentLevel}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>GHS {minAmount.toLocaleString()}</span>
            <span>GHS {maxAmount.toLocaleString()}</span>
          </div>
          {currentLevel && (
            <div className="text-center mt-3">
              <span className="inline-block rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                {currentLevel.name} Level
              </span>
            </div>
          )}
        </div>

        <LoanTermsCarousel
          selectedTerm={loanTerm}
          onTermChange={(days, termData) => {
            setLoanTerm(days);
            setSelectedTerm(days);
            if (termData) {
              calculateDynamicFees(loanAmount, days);
            }
          }}
          userLevel={currentLevel}
        />

        {/* Loan Level Information */}
        {userLevelInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              🏆 Your Loan Level
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <h5 className="text-blue-600 font-bold text-base">
                  {currentLevel?.name}
                </h5>
                <p className="text-xs text-gray-400 mt-0.5">
                  Level {currentLevel?.levelNumber}
                </p>
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs text-gray-500">
                    GHS {currentLevel?.minAmount?.toLocaleString()} – GHS{" "}
                    {currentLevel?.maxAmount?.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Interest: {currentLevel?.interestRate}%
                  </p>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Progress to Next Level
                </p>
                <p className="text-xs text-gray-400 mb-1">
                  Loans Completed: {userLevelInfo.totalLoansCompleted} /{" "}
                  {currentLevel?.minLoansRequired || "N/A"}
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-1.5 bg-emerald-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (userLevelInfo.totalLoansCompleted / (currentLevel?.minLoansRequired || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Amount Repaid: GHS{" "}
                  {userLevelInfo.totalAmountRepaid?.toLocaleString() || "0"}
                </p>
                {userLevelInfo.canProgress && (
                  <div className="mt-2 bg-emerald-50 rounded-lg px-2 py-1.5">
                    <p className="text-xs font-semibold text-emerald-700">
                      🎉 Ready for next level!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loan Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            📊 Loan Summary
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Loan Amount</span>
              <span className="font-semibold text-gray-800">
                GHS {loanAmount.toFixed(2)}
              </span>
            </div>

            {/* Fee Breakdown */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Fee Breakdown
                </p>
                {isCalculatingFees && (
                  <span className="text-xs text-blue-500 animate-pulse">
                    calculating…
                  </span>
                )}
              </div>
              {(() => {
                const fees = getCurrentFees();
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        Interest (
                        {((fees.interestAmount / loanAmount) * 100).toFixed(1)}
                        %)
                      </span>
                      <span className="text-amber-600 font-medium">
                        GHS {fees.interestAmount.toFixed(2)}
                      </span>
                    </div>
                    {fees.serviceFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Service Fee (
                          {((fees.serviceFee / loanAmount) * 100).toFixed(1)}%)
                        </span>
                        <span className="text-gray-600 font-medium">
                          GHS {fees.serviceFee.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {fees.processingFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Processing Fee (
                          {((fees.processingFee / loanAmount) * 100).toFixed(1)}
                          %)
                        </span>
                        <span className="text-gray-600 font-medium">
                          GHS {fees.processingFee.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {fees.commitmentFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Commitment Fee (
                          {((fees.commitmentFee / loanAmount) * 100).toFixed(1)}
                          %)
                        </span>
                        <span className="text-gray-600 font-medium">
                          GHS {fees.commitmentFee.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="border-t border-gray-100 pt-3 mt-2">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500">Total Fee Rate</span>
                <span className="font-semibold text-emerald-600">
                  {((getCurrentFees().totalFees / loanAmount) * 100).toFixed(1)}
                  %
                </span>
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500">Due Date</span>
                <span className="font-semibold text-gray-800">
                  {new Date(
                    Date.now() + loanTerm * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-base mt-2">
                <span className="font-bold text-gray-800">Total Repayment</span>
                <span className="font-bold text-blue-600 text-lg">
                  GHS {calculateTotalRepayment().toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-xs text-amber-800">
              <strong>⚠️ Important:</strong> Overdue penalty of{" "}
              <strong>2% per day</strong> applies to late payments.
            </p>
          </div>
        </div>

        {/* Loan Status Display */}
        {loanStatus && (
          <div
            className={`rounded-2xl p-4 border text-sm font-medium ${
              loanStatus === "approved"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : loanStatus === "rejected"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <strong>Loan Status: </strong>
            {(loanStatus === "pending" ||
              loanStatus === "under-review" ||
              loanStatus === "under_review") &&
              "🔍 Under Review — Please wait for admin approval"}
            {loanStatus === "rejected" &&
              "❌ Rejected — You can apply for a new loan"}
            {loanStatus === "approved" && "✅ Approved — Ready for payment"}
            {loanStatus === "active" &&
              "💰 Active Loan — Make payments to reduce balance"}
            {loanStatus === "disbursed" &&
              "💸 Loan Disbursed — Repayment period has started"}
            {loanStatus === "completed" &&
              "✅ Loan Completed — Thank you for your business"}
            {loanStatus === "overdue" &&
              "⚠️ Overdue — Please make payment immediately to avoid additional penalties"}
            {![
              "pending",
              "under-review",
              "under_review",
              "rejected",
              "approved",
              "active",
              "disbursed",
              "completed",
              "overdue",
            ].includes(loanStatus) && `📋 Status: ${loanStatus}`}
          </div>
        )}

        {/* Terms and Conditions */}
        {!loanStatus && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                📋 Terms and Conditions
              </p>
            </div>
            <div className="px-5 py-4 max-h-48 overflow-y-auto">
              <div className="text-xs text-gray-500 space-y-2 leading-relaxed">
                <p>
                  <strong>CEDI Loan Terms and Conditions</strong>
                </p>
                <p>
                  <strong>1. Loan Agreement:</strong> By applying for this loan,
                  you agree to repay the full amount plus applicable fees within
                  the specified term.
                </p>
                <p>
                  <strong>2. Interest Rates:</strong>
                </p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>
                    7-day loans: 1% interest + applicable fees = 22% total
                  </li>
                  <li>
                    14-day loans: 2% interest + applicable fees = 26% total
                  </li>
                  <li>
                    30-day loans: 4% interest + applicable fees = 30% total
                  </li>
                </ul>
                <p>
                  <strong>3. Overdue Penalties:</strong> A penalty of 2% per day
                  will be charged on the remaining outstanding loan balance for
                  overdue payments.
                </p>
                <p>
                  <strong>4. Payment Methods:</strong> Payments can be made via
                  mobile money (MTN, Telecel, AirtelTigo) in full or partial
                  amounts.
                </p>
                <p>
                  <strong>5. Partial Payments:</strong> Partial payments are
                  accepted, but overdue penalties apply to the remaining
                  balance.
                </p>
                <p>
                  <strong>6. Loan Approval:</strong> All loans are subject to
                  approval. Rejected applications can reapply immediately.
                </p>
                <p>
                  <strong>7. Data Privacy:</strong> Your personal and financial
                  information is protected and used only for loan processing.
                </p>
                <p>
                  <strong>8. Default:</strong> Failure to repay may result in
                  additional penalties and affect future loan eligibility.
                </p>
                <p>
                  <strong>9. Contact:</strong> For support, contact our customer
                  service team.
                </p>
                <p>
                  <strong>10. Agreement:</strong> By checking the box below, you
                  acknowledge that you have read, understood, and agree to these
                  terms.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600 rounded"
                  id="termsCheck"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                  }}
                />
                <span className="text-sm text-gray-600">
                  I have read and agree to the Terms and Conditions
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="space-y-2 pt-1">
          {loanStatus === "approved" ? (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-sm text-blue-800">
                  ✅ <strong>Loan Approved!</strong> Outstanding Balance:{" "}
                  <strong>
                    GHS {parseFloat(remainingBalance || 0).toFixed(2)}
                  </strong>
                </p>
              </div>
              <button
                className="w-full bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl px-4 py-3 text-sm font-semibold"
                onClick={handleMakePayment}
              >
                💳 Make Payment
              </button>
            </div>
          ) : loanStatus === "rejected" ? (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-sm text-red-800">
                  ❌ <strong>Application Rejected</strong>
                  <br />
                  Your loan application has been rejected. Please review your
                  information and try again.
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                disabled={isSubmitting || !termsAccepted}
              >
                {isSubmitting
                  ? "Processing…"
                  : !termsAccepted
                    ? "📋 Accept Terms to Continue"
                    : "🔄 Reapply"}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
              disabled={
                isSubmitting ||
                ["pending", "under-review", "under_review"].includes(
                  loanStatus,
                ) ||
                !termsAccepted ||
                (activeLoan &&
                  [
                    "pending",
                    "under-review",
                    "approved",
                    "disbursed",
                    "active",
                  ].includes(activeLoan.status))
              }
              onClick={() => {}}
            >
              {isSubmitting
                ? "Processing…"
                : activeLoan &&
                    [
                      "pending",
                      "under-review",
                      "approved",
                      "disbursed",
                      "active",
                    ].includes(activeLoan.status)
                  ? "🚫 Active Loan Exists"
                  : ["pending", "under-review", "under_review"].includes(
                        loanStatus,
                      )
                    ? "⏳ Application Under Review"
                    : !termsAccepted
                      ? "📋 Accept Terms to Continue"
                      : "🚀 Apply Now"}
            </button>
          )}
        </div>
      </form>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center pb-[60px] sm:pb-0"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[calc(100dvh-60px)] sm:max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h5 className="font-bold text-gray-800">💳 Make Payment</h5>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-sm text-red-700">
                  <strong>Outstanding Balance:</strong> GHS{" "}
                  {parseFloat(remainingBalance || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Payment Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: "full",
                      label: `💰 Full — GHS ${parseFloat(remainingBalance || 0).toFixed(2)}`,
                    },
                    { value: "partial", label: "💸 Partial" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${paymentType === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value={opt.value}
                        checked={paymentType === opt.value}
                        onChange={(e) => setPaymentType(e.target.value)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {paymentType === "partial" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Payment Amount (GHS)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="0.01"
                    max={remainingBalance}
                    step="0.01"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Mobile Money Provider
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  <option value="MTN">📱 MTN Mobile Money</option>
                  <option value="Telecel">📲 Telecel Money</option>
                  <option value="AirtelTigo">📞 AirtelTigo Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                  value={mobileNumber}
                  disabled
                  maxLength="10"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  This number is loaded from your verified profile and cannot be changed here.
                </p>
              </div>
              {paymentHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    📋 Payment History
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Date", "Amount", "Provider", "Type"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-xs font-semibold text-gray-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paymentHistory.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {payment.date}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium">
                              GHS {parseFloat(payment.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {payment.provider}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${payment.type === "full" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                              >
                                {payment.type === "full" ? "Full" : "Partial"}
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
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded-xl py-2.5 text-sm font-semibold"
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
                onClick={handlePaymentSubmit}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? "Processing…" : "🚀 Process Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Main render logic

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-28 space-y-4">
      {renderLoanStatusScreen()}
    </div>
  );
};

export default LoanApplication;
