import React, { useState, useEffect, useCallback } from "react";
import {
  FiRefreshCw,
  FiSearch,
  FiAlertCircle,
  FiCheckCircle,
  FiDollarSign,
  FiUser,
  FiCalendar,
  FiZap,
  FiArrowRight,
} from "react-icons/fi";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import DetailModal from "../components/DetailModal/DetailModal";

// ─── helpers ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disbursed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  active: "bg-teal-50 text-teal-700 border-teal-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "under-review": "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  overdue: "bg-orange-50 text-orange-700 border-orange-200",
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLES[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
  >
    {status?.replace(/-/g, " ")}
  </span>
);

const fmtGHS = (v) =>
  `GHS ${parseFloat(v || 0).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// ─── Manual Disburse Modal ───────────────────────────────────────────────────
const ManualDisburseModal = ({ loan, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    channel: "momo",
    reference: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reference.trim()) {
      setError("Transaction reference is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiService.retryDisbursement(loan.id, form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to record disbursement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 md:left-64 right-0 bottom-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            Record Disbursement
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Loan{" "}
            <span className="font-semibold text-gray-700">#{loan.loanId}</span>{" "}
            — {fmtGHS(loan.amount)}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel
            </label>
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="momo">Mobile Money (MoMo)</option>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="manual">Other / Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. MTN-20260509-XXXX"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <FiAlertCircle size={14} /> {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? "Processing…" : "Confirm Disbursement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Quick-Action Disburse Button (for approved loans in the main queue) ─────
const QuickDisburseButton = ({ loan, onSuccess }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition"
      >
        <FiDollarSign size={12} /> Disburse
      </button>
      {open && (
        <ManualDisburseModal
          loan={loan}
          onClose={() => setOpen(false)}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "pending-disbursement", label: "Awaiting Disbursement" },
  { id: "disbursed", label: "Disbursed" },
  { id: "active", label: "Active Loans" },
  { id: "failed", label: "Failed Disbursements" },
];

const LoanDetails = () => {
  const { hasActionPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("pending-disbursement");
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [newLoanBadge, setNewLoanBadge] = useState(0);

  // Map tab → status filter
  const tabStatusMap = {
    "pending-disbursement": "approved",
    disbursed: "disbursed",
    active: "active-loans",
    failed: "failed",
  };

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "failed") {
        // Use the dedicated failed-disbursements endpoint
        const API_BASE =
          process.env.REACT_APP_API_URL || "http://localhost:8001/api";
        const token = localStorage.getItem("adminToken");
        const resp = await fetch(
          `${API_BASE}/loans/failed-disbursements?page=${page}&limit=20&search=${search}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await resp.json();
        setLoans(data.loans || []);
        setPagination(data.pagination || { total: 0, pages: 0 });
      } else {
        const statusFilter = tabStatusMap[activeTab];
        const resp = await apiService.getLoans(page, 20, statusFilter, search);
        setLoans(resp.loans || []);
        setPagination(resp.pagination || { total: 0, pages: 0 });
      }
    } catch (err) {
      setError("Failed to load loans. Please try again.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Real-time: listen for new loan applications
  useEffect(() => {
    const handleNewLoan = () => {
      setNewLoanBadge((n) => n + 1);
      if (activeTab === "pending-disbursement") fetchLoans();
    };
    window.addEventListener("adminNewLoan", handleNewLoan);
    return () => window.removeEventListener("adminNewLoan", handleNewLoan);
  }, [activeTab, fetchLoans]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === "pending-disbursement") setNewLoanBadge(0);
  };

  // DetailModal handlers
  const handleApprove = async (remarks) => {
    await apiService.updateLoanStatus(selectedLoan.id, "approved", remarks);
    setSelectedLoan(null);
    fetchLoans();
  };
  const handleReject = async (remarks) => {
    await apiService.updateLoanStatus(selectedLoan.id, "rejected", remarks);
    setSelectedLoan(null);
    fetchLoans();
  };
  const handleDisburse = async (remarks) => {
    await apiService.updateLoanStatus(selectedLoan.id, "disbursed", remarks);
    setSelectedLoan(null);
    fetchLoans();
  };
  const handleActivate = async (remarks) => {
    await apiService.updateLoanStatus(selectedLoan.id, "active", remarks);
    setSelectedLoan(null);
    fetchLoans();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Lending</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage loan disbursements and track active loans
          </p>
        </div>
        <button
          onClick={fetchLoans}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl px-4 py-2 text-sm font-medium transition"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.id === "pending-disbursement" && newLoanBadge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {newLoanBadge > 9 ? "9+" : newLoanBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <FiSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={14}
        />
        <input
          type="text"
          placeholder="Search by name, phone, loan ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-500">
          <FiAlertCircle size={32} />
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchLoans}
            className="text-blue-600 text-sm underline"
          >
            Retry
          </button>
        </div>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-gray-400">
          <FiCheckCircle size={40} />
          <p className="text-sm font-medium">No loans in this queue</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="mb-4 text-xs text-gray-500">
            Showing {loans.length} of {pagination.total} loan
            {pagination.total !== 1 ? "s" : ""}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Loan ID
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Term
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {activeTab === "pending-disbursement"
                      ? "Approved On"
                      : activeTab === "active"
                        ? "Due Date"
                        : "Date"}
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4 font-mono text-xs text-gray-600">
                      {loan.loanId}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <FiUser size={12} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 leading-none">
                            {loan.User?.firstName} {loan.User?.lastName}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {loan.User?.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900">
                        {fmtGHS(loan.amount)}
                      </p>
                      {loan.remainingBalance && activeTab === "active" && (
                        <p className="text-xs text-orange-500 mt-0.5">
                          Balance: {fmtGHS(loan.remainingBalance)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {loan.termInDays} days
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={loan.status} />
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      <div className="flex items-center gap-1">
                        <FiCalendar size={11} />
                        {activeTab === "pending-disbursement"
                          ? fmtDate(loan.approvalDate)
                          : activeTab === "active"
                            ? fmtDate(loan.dueDate)
                            : fmtDate(loan.updatedAt)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {/* View full details */}
                        <button
                          onClick={() => setSelectedLoan(loan)}
                          className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg px-3 py-1.5 transition"
                        >
                          View
                        </button>
                        {/* Quick Disburse for approved loans */}
                        {activeTab === "pending-disbursement" &&
                          hasActionPermission("approveLoans") && (
                            <QuickDisburseButton
                              loan={loan}
                              onSuccess={fetchLoans}
                            />
                          )}
                        {/* Activate for disbursed loans */}
                        {activeTab === "disbursed" &&
                          hasActionPermission("approveLoans") && (
                            <button
                              onClick={async () => {
                                await apiService.updateLoanStatus(
                                  loan.id,
                                  "active",
                                  "Activated after disbursement confirmation",
                                );
                                fetchLoans();
                              }}
                              className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition"
                            >
                              <FiZap size={11} /> Activate
                            </button>
                          )}
                        {/* Failed retry */}
                        {activeTab === "failed" &&
                          hasActionPermission("approveLoans") && (
                            <QuickDisburseButton
                              loan={loan}
                              onSuccess={fetchLoans}
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 transition"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {pagination.pages}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 transition"
              >
                Next <FiArrowRight className="inline" size={12} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLoan && (
        <DetailModal
          isOpen={!!selectedLoan}
          onClose={() => setSelectedLoan(null)}
          data={selectedLoan}
          onApprove={
            hasActionPermission("approveLoans") ? handleApprove : undefined
          }
          onReject={
            hasActionPermission("rejectLoans") ? handleReject : undefined
          }
          onDisburse={
            hasActionPermission("approveLoans") ? handleDisburse : undefined
          }
          onActivate={
            hasActionPermission("approveLoans") ? handleActivate : undefined
          }
        />
      )}
    </div>
  );
};

export default LoanDetails;
