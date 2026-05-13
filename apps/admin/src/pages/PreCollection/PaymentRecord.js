import React, { useState, useEffect } from "react";
import {
  FiDownload,
  FiSearch,
  FiDollarSign,
  FiRefreshCw,
  FiCreditCard,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";

const PaymentRecord = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  // Handle row click to show loan details
  const handleRowClick = (loanId) => {
    if (loanId) {
      // Navigate to loan details page or open modal
      const url = `/loan-details/${loanId}`;
      window.open(url, "_blank");
    }
  };

  // Filter states
  const [filters, setFilters] = useState({
    phoneNumber: "",
    officer: "",
    group: "",
    team: "",
    startDate: null,
    endDate: null,
    userId: "",
    loanId: "",
    transactionId: "",
    status: "all",
    paymentType: "all",
  });

  const [teams, setTeams] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Fetch payments data
  const fetchPayments = async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit: pagination.limit,
      };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.officer) params.officerId = filters.officer;

      const response = await apiService.getPrecollectionRepayments(params);
      setPayments(response.payments || []);
      const total = response.total || 0;
      setPagination((prev) => ({
        ...prev,
        current: response.page || page,
        total,
        pages: Math.ceil(total / prev.limit),
      }));
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("Failed to fetch payment records");
    } finally {
      setLoading(false);
    }
  };

  // Fetch officers for filter dropdown
  const fetchTeamsAndOfficers = async () => {
    // Officers are fetched from payment records themselves (PrecollectionOfficer association)
    // No separate endpoint needed — the officer filter is a free-text or left empty
  };

  useEffect(() => {
    fetchPayments();
    fetchTeamsAndOfficers();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchPayments(1);
  };

  const handleReset = () => {
    setFilters({
      phoneNumber: "",
      officer: "",
      group: "",
      team: "",
      startDate: null,
      endDate: null,
      userId: "",
      loanId: "",
      transactionId: "",
      status: "all",
      paymentType: "all",
    });
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchPayments(1);
  };

  const handlePageChange = (event, page) => {
    setPagination((prev) => ({ ...prev, current: page }));
    fetchPayments(page);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: "success",
      pending: "warning",
      processing: "info",
      failed: "error",
      cancelled: "default",
      refunded: "secondary",
    };
    return colors[status] || "default";
  };

  const exportData = () => {
    // Implementation for exporting payment records
    console.log("Exporting payment records...");
  };

  const STATUS_BADGE = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    refunded: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const inp =
    "px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiCreditCard size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Payment Records
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Pre-collection payment history and tracking
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              User ID
            </label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange("userId", e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Loan ID
            </label>
            <input
              type="text"
              value={filters.loanId}
              onChange={(e) => handleFilterChange("loanId", e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Transaction ID
            </label>
            <input
              type="text"
              value={filters.transactionId}
              onChange={(e) =>
                handleFilterChange("transactionId", e.target.value)
              }
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Loan Level
            </label>
            <select
              value={filters.loanLevel || ""}
              onChange={(e) => handleFilterChange("loanLevel", e.target.value)}
              className={inp}
            >
              <option value="">All Levels</option>
              {["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"].map(
                (l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Officer
            </label>
            <select
              value={filters.officer}
              onChange={(e) => handleFilterChange("officer", e.target.value)}
              className={inp}
            >
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Phone
            </label>
            <input
              type="text"
              value={filters.phoneNumber}
              onChange={(e) =>
                handleFilterChange("phoneNumber", e.target.value)
              }
              className={inp}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
            >
              <FiSearch size={13} /> Search
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={exportData}
          className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
        >
          <FiDownload size={13} /> Export
        </button>
        <span className="text-xs text-gray-400">
          Total: {pagination.total} | Showing: {payments.length}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
            payments...
          </div>
        ) : (
          <table style={{ minWidth: "900px" }} className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Loan ID",
                  "User ID",
                  "Phone",
                  "Loan Level",
                  "Repayment Amount",
                  "Repayment Time",
                  "Transaction ID",
                  "Payment Channel",
                  "Officer",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap"
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
                    No payment records found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    onClick={() => handleRowClick(payment.Loan?.loanId)}
                    className="hover:bg-gray-50/60 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-blue-600">
                      {payment.Loan?.loanId?.slice(-10) || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {payment.User?.userId ||
                        payment.User?.id?.slice(-8) ||
                        "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {payment.phoneNumber ||
                        payment.User?.phoneNumber ||
                        "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {payment.Loan?.loanLevel || "Level 1"}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(payment.completedAt || payment.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {payment.transactionId ||
                        payment.paymentReference ||
                        "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                        {payment.mobileMoneyProvider || "MTN"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {payment.Loan?.PrecollectionOfficer
                        ? `${payment.Loan.PrecollectionOfficer.firstName} ${payment.Loan.PrecollectionOfficer.lastName}`
                        : "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Page {pagination.current} of {pagination.pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handlePageChange(e, pagination.current - 1)}
                disabled={pagination.current === 1}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={(e) => handlePageChange(e, pagination.current + 1)}
                disabled={pagination.current === pagination.pages}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentRecord;
