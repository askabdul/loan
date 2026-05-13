import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiFilter,
  FiEye,
  FiRefreshCw,
  FiDollarSign,
  FiX,
  FiRotateCcw,
} from "react-icons/fi";
import { toast } from "react-toastify";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Inline payment detail modal — avoids DetailModal "isOpen" mismatch
const PaymentDetailModal = ({ payment, onClose }) => {
  const fmt = (n) =>
    new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(n || 0);
  const row = (label, value) => (
    <div
      key={label}
      className="flex justify-between py-2 border-b border-gray-50 last:border-0"
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-800 text-right max-w-[55%] break-words">
        {value ?? "—"}
      </span>
    </div>
  );
  return (
    <div className="fixed top-0 right-0 bottom-0 left-[250px] z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">
            Payment Details
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition"
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-1">
          {row(
            "Transaction ID",
            <code className="text-xs font-mono">
              {payment.transactionId || payment.paymentReference}
            </code>,
          )}
          {row(
            "Status",
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payment.status === "completed" ? "bg-emerald-100 text-emerald-700" : payment.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
            >
              {payment.status}
            </span>,
          )}
          {row("Amount", <strong>{fmt(payment.amount)}</strong>)}
          {row("Type", payment.paymentType)}
          {row("Provider", payment.mobileMoneyProvider)}
          {row("Phone", payment.phoneNumber || payment.User?.phoneNumber)}
          {row(
            "Customer",
            `${payment.User?.firstName || ""} ${payment.User?.lastName || ""}`.trim() ||
              null,
          )}
          {row(
            "Loan ID",
            payment.Loan?.loanId?.slice(-10) || payment.Loan?.id?.slice(-8),
          )}
          {row(
            "Date",
            payment.createdAt
              ? new Date(payment.createdAt).toLocaleString()
              : null,
          )}
          {payment.completedAt &&
            row("Completed", new Date(payment.completedAt).toLocaleString())}
          {payment.failureReason &&
            row("Failure Reason", payment.failureReason)}
        </div>
      </div>
    </div>
  );
};

const PaymentManagement = () => {
  const { hasActionPermission, hasDataAccess } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    successfulPayments: 0,
    failedPayments: 0,
    pendingPayments: 0,
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil((pagination.total || 0) / itemsPerPage);

  // Fetch payments from API
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiService.getPayments(
        currentPage,
        itemsPerPage,
        statusFilter === "all" ? "" : statusFilter,
        "", // loanId
      );

      if (response.success) {
        setPayments(response.payments || []);
        setPagination(response.pagination || {});
      } else {
        setError("Failed to fetch payments");
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError("Error occurred while fetching payments");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  // Fetch payment statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiService.getPaymentStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        console.warn("Stats returned non-success:", response);
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 403) {
        console.warn("Stats: insufficient permissions for fundManagement");
      } else if (status !== 404) {
        console.error("Error fetching payment stats:", error);
      }
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [fetchPayments, fetchStats]);

  // Fetch data when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch data when page or status filter changes
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle functions
  const handleRefresh = async () => {
    await fetchPayments();
    await fetchStats();
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
  };

  const handleRetryPayment = async (paymentId) => {
    if (window.confirm("Are you sure you want to retry this payment?")) {
      try {
        const response = await apiService.retryPayment(paymentId);
        if (response.success) {
          toast.success("Payment retry initiated successfully!");
          await fetchPayments();
        } else {
          toast.error("Failed to retry payment");
        }
      } catch (error) {
        console.error("Error retrying payment:", error);
        toast.error("Error occurred while retrying payment");
      }
    }
  };

  const formatAmount = (amount) => {
    return `GHS ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const STATUS_BADGE = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    successful: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    refunded: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiDollarSign size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Payment Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Track and manage platform payments
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: "Total Payments", value: stats.totalPayments },
          { label: "Total Amount", value: formatAmount(stats.totalAmount) },
          { label: "Successful", value: stats.successfulPayments },
          { label: "Failed", value: stats.failedPayments },
          { label: "Pending", value: stats.pendingPayments },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2 min-w-[72px]"
          >
            <span className="text-base font-bold text-blue-600 leading-tight">
              {value}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by transaction ID, user, or loan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
          payments...
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
            <table className="w-full text-sm" style={{ minWidth: "700px" }}>
              <colgroup>
                <col style={{ width: "14%" }} />
                {hasDataAccess("users", "personalInfo") && (
                  <col style={{ width: "12%" }} />
                )}
                {hasDataAccess("loans", "basic") && (
                  <col style={{ width: "10%" }} />
                )}
                {hasDataAccess("payments", "amount") && (
                  <col style={{ width: "10%" }} />
                )}
                <col style={{ width: "8%" }} />
                {hasDataAccess("payments", "provider") && (
                  <col style={{ width: "10%" }} />
                )}
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  {[
                    "Transaction ID",
                    ...(hasDataAccess("users", "personalInfo") ? ["User"] : []),
                    ...(hasDataAccess("loans", "basic") ? ["Loan ID"] : []),
                    ...(hasDataAccess("payments", "amount") ? ["Amount"] : []),
                    "Type",
                    ...(hasDataAccess("payments", "provider")
                      ? ["Provider"]
                      : []),
                    "Status",
                    "Date",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No payments found
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr
                      key={payment.id || payment.transactionId}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-700">
                        {payment.transactionId || payment.paymentReference}
                      </td>
                      {hasDataAccess("users", "personalInfo") && (
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <p className="font-semibold text-gray-800">
                            {payment.User?.firstName} {payment.User?.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {payment.User?.phoneNumber}
                          </p>
                        </td>
                      )}
                      {hasDataAccess("loans", "basic") && (
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {payment.Loan?.loanId?.slice(-10) ||
                            payment.Loan?.id?.slice(-8) ||
                            "—"}
                        </td>
                      )}
                      {hasDataAccess("payments", "amount") && (
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                          {formatAmount(payment.amount)}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${payment.paymentType === "full" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                        >
                          {payment.paymentType}
                        </span>
                      </td>
                      {hasDataAccess("payments", "provider") && (
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {payment.mobileMoneyProvider}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[payment.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(payment)}
                            title="View Details"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                          >
                            <FiEye size={13} />
                          </button>
                          {payment.status === "failed" &&
                            hasActionPermission("managePayments") && (
                              <button
                                onClick={() => handleRetryPayment(payment.id)}
                                title="Retry Payment"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition"
                              >
                                <FiRotateCcw size={13} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || loading}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isModalOpen && selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default PaymentManagement;
