import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiFilter,
  FiEye,
  FiCheck,
  FiX,
  FiClock,
  FiDollarSign,
  FiUser,
  FiCalendar,
  FiRefreshCw,
  FiUsers,
  FiMoreVertical,
} from "react-icons/fi";
import DetailModal from "../components/DetailModal/DetailModal";
import OfficerAssignmentModal from "../components/OfficerAssignmentModal/OfficerAssignmentModal";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./CreditReviewList.css";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "under-review": "bg-blue-50 text-blue-700 border-blue-200",
  assigned: "bg-purple-50 text-purple-700 border-purple-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  "hanged-up": "bg-gray-50 text-gray-600 border-gray-200",
  disbursed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  active: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  overdue: "bg-orange-50 text-orange-700 border-orange-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS = {
  pending: "Pending review",
  "under-review": "Under review",
  "hanged-up": "Hanged up",
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLES[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
  >
    {STATUS_LABELS[status] || status?.replace(/-/g, " ")}
  </span>
);

const CreditReviewList = () => {
  const { hasActionPermission, hasDataAccess, user, isSuperAdmin } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationsPerPage] = useState(10);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [dropdownState, setDropdownState] = useState({
    id: null,
    top: 0,
    right: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [error, setError] = useState(null);

  // Persist active tab across refreshes
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("creditReview_activeTab") || "pending-assign",
  );
  const [selectedLoans, setSelectedLoans] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem("creditReview_activeTab", tabId);
    setCurrentPage(1);
    setSelectedLoans([]);
  };

  // Tab configurations
  const tabs = [
    { id: "pending-assign", label: "Pending Assign", icon: FiClock },
    { id: "assigned", label: "Assigned", icon: FiUsers },
    { id: "hanged-up", label: "Hanged Up", icon: FiX },
    { id: "approved", label: "Approved", icon: FiDollarSign },
    { id: "active-loans", label: "Active Loans", icon: FiRefreshCw },
    { id: "completed", label: "Completed", icon: FiCheck },
  ];

  const fetchApplications = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);

      // Determine status filter based on active tab
      let tabStatusFilter = "";
      switch (activeTab) {
        case "pending-assign":
          tabStatusFilter = "pending";
          break;
        case "assigned":
          tabStatusFilter = "assigned";
          break;
        case "hanged-up":
          tabStatusFilter = "hanged-up";
          break;
        case "approved":
          tabStatusFilter = "approved";
          break;
        case "active-loans":
          tabStatusFilter = "active-loans";
          break;
        case "completed":
          tabStatusFilter = "completed";
          break;
        default:
          tabStatusFilter = statusFilter !== "all" ? statusFilter : "";
      }

      const response = await apiService.getLoans(
        currentPage,
        applicationsPerPage,
        tabStatusFilter,
        searchTerm,
      );

      // Ensure we have valid data
      const loans = response.loans || [];
      const pagination = response.pagination || { total: 0, pages: 0 };

      setApplications(loans);
      setPagination(pagination);

      // Clear any previous errors on successful fetch
      if (error) setError(null);
    } catch (error) {
      console.error("Error fetching loan applications:", error);

      // Retry logic for network errors
      if (
        retryCount < 2 &&
        (error.code === "ECONNABORTED" || error.message.includes("timeout"))
      ) {
        console.log(`Retrying fetch... Attempt ${retryCount + 1}`);
        setTimeout(() => fetchApplications(retryCount + 1), 1000);
        return;
      }

      setError("Failed to load loan applications. Please try again.");
      setApplications([]);
      setPagination({ total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Fetch applications on component mount
  useEffect(() => {
    fetchApplications();
  }, []);

  // Fetch applications when page, filters, or active tab change
  useEffect(() => {
    fetchApplications();
  }, [currentPage, statusFilter, activeTab]);

  // Debounced search effect
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (currentPage === 1) {
        fetchApplications();
      } else {
        setCurrentPage(1); // This will trigger the above useEffect
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  // Refresh the open loan detail modal when customer confirms receipt
  useEffect(() => {
    const onReceipt = async (e) => {
      const { loanId } = e.detail || {};
      // Refresh list so adminNotes column is updated
      fetchApplications();
      // If this specific loan is open in the modal, refresh it
      if (selectedLoan && selectedLoan.id === loanId) {
        try {
          const response = await apiService.getLoanById(loanId);
          const refreshed = response.data?.loan || response.loan;
          if (refreshed) setSelectedLoan(refreshed);
        } catch (_) {
          // Non-critical — the modal will still show
        }
      }
    };
    window.addEventListener("adminReceiptConfirmed", onReceipt);
    return () => window.removeEventListener("adminReceiptConfirmed", onReceipt);
  }, [selectedLoan]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownState.id) return;
    const close = () => setDropdownState({ id: null, top: 0, right: 0 });
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dropdownState.id]);

  // Server-side pagination - use applications directly
  const totalPages = pagination.pages || 1;
  const currentApplications = applications;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleRefresh = () => {
    fetchApplications();
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
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

  const handleApprove = async (remarks) => {
    try {
      await apiService.updateLoanStatus(selectedLoan.id, "approved", remarks);
      setIsModalOpen(false);
      await fetchApplications();
    } catch (error) {
      console.error("Error approving application:", error);
      throw error;
    }
  };

  const handleReject = async (remarks) => {
    try {
      await apiService.updateLoanStatus(selectedLoan.id, "rejected", remarks);
      setIsModalOpen(false);
      await fetchApplications();
    } catch (error) {
      console.error("Error rejecting application:", error);
      throw error;
    }
  };

  const handleHangUp = async (remarks) => {
    try {
      await apiService.updateLoanStatus(selectedLoan.id, "hanged-up", remarks);
      setIsModalOpen(false);
      await fetchApplications();
    } catch (error) {
      console.error("Error hanging up application:", error);
      throw error;
    }
  };

  const handleDisburse = async (remarks) => {
    try {
      await apiService.updateLoanStatus(selectedLoan.id, "disbursed", remarks);
      setIsModalOpen(false);
      await fetchApplications();
    } catch (error) {
      console.error("Error disbursing loan:", error);
      throw error;
    }
  };

  const handleActivate = async (remarks) => {
    try {
      await apiService.updateLoanStatus(selectedLoan.id, "active", remarks);
      setIsModalOpen(false);
      await fetchApplications();
    } catch (error) {
      console.error("Error activating loan:", error);
      throw error;
    }
  };

  const handleRetryContact = async (loanId) => {
    if (
      window.confirm(
        "Are you sure you want to retry contacting this customer? This will move the loan back to assigned status.",
      )
    ) {
      try {
        await apiService.retryContactLoan(loanId);
        await fetchApplications();
      } catch (error) {
        console.error("Error retrying contact:", error);
        alert("Error occurred while retrying contact");
      }
    }
  };

  const handleViewDetails = (application, readOnly = false) => {
    setSelectedLoan(application);
    setIsReadOnly(readOnly);
    setIsModalOpen(true);
    setDropdownState({ id: null, top: 0, right: 0 });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLoan(null);
    setIsReadOnly(false);
  };

  const handleRowClick = (application) => {
    handleViewDetails(application);
  };

  const handleLoanSelect = (loanId) => {
    setSelectedLoans((prev) => {
      if (prev.includes(loanId)) {
        return prev.filter((id) => id !== loanId);
      } else {
        return [...prev, loanId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === applications.length) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(applications.map((app) => app.id));
    }
  };

  const handleAssignLoans = () => {
    if (selectedLoans.length === 0) {
      alert("Please select at least one loan to assign.");
      return;
    }
    setShowAssignModal(true);
  };

  const handleAssignmentComplete = async () => {
    setShowAssignModal(false);
    setSelectedLoans([]);
    await fetchApplications();
  };

  // Filter applications based on active tab - now handled by backend
  const getFilteredApplications = () => {
    // Since filtering is now done on the backend, return all applications
    // The backend already filters based on the tab status
    return applications;
  };

  // Handle loan reassignment
  const handleReassignLoan = async (loanId) => {
    try {
      setSelectedLoans([loanId]);
      setShowAssignModal(true);
    } catch (error) {
      console.error("Error preparing reassignment:", error);
    }
  };

  // Handle loan withdrawal
  const handleWithdrawLoan = async (loanId) => {
    if (
      window.confirm("Are you sure you want to withdraw this loan assignment?")
    ) {
      try {
        await apiService.withdrawLoanAssignment(loanId);
        await fetchApplications();
        alert("Loan assignment withdrawn successfully");
      } catch (error) {
        console.error("Error withdrawing loan:", error);
        alert("Failed to withdraw loan assignment");
      }
    }
  };

  const getTabCount = (tabId) => {
    // Show the current tab's total count from pagination
    if (tabId === activeTab) {
      return pagination.total || 0;
    }
    // For other tabs, we don't have the count yet - could be fetched separately
    return "?";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "under_review":
        return "info";
      case "approved":
        return "success";
      case "rejected":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case "low":
        return "success";
      case "medium":
        return "warning";
      case "high":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "success";
      default:
        return "secondary";
    }
  };

  return (
    <div className="p-5 bg-gray-50 min-h-screen">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Title + Refresh */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Credit Review
          </h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh data"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-3">
          {[
            {
              label: "Total",
              value: pagination.total || 0,
              color: "text-blue-600",
            },
            {
              label: "This page",
              value: applications.length,
              color: "text-gray-700",
            },
            { label: "Pages", value: totalPages, color: "text-gray-700" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2 min-w-[72px]"
            >
              <span className={`text-xl font-bold leading-none ${s.color}`}>
                {s.value}
              </span>
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-sm font-medium transition border-b-2 flex-shrink-0 ${
                  isActive
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                <IconComponent size={14} />
                {tab.label}
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {getTabCount(tab.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <FiSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={15}
          />
          <input
            type="text"
            placeholder="Search by name, email, or application ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        {activeTab !== "pending-assign" && (
          <div className="relative min-w-[180px]">
            <FiFilter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              size={14}
            />
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}

        {/* Assign selected */}
        {activeTab === "pending-assign" && selectedLoans.length > 0 && (
          <button
            onClick={handleAssignLoans}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiUsers size={14} />
            Assign Selected ({selectedLoans.length})
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-sm text-red-700 font-medium m-0">{error}</p>
          <button
            onClick={() => fetchApplications()}
            className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading loan applications…</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5">
            <table
              className="w-full text-sm border-collapse"
              style={{ minWidth: "100%" }}
            >
              <thead>
                <tr className="bg-gray-50 text-left">
                  {activeTab === "pending-assign" && (
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedLoans.length === applications.length &&
                          applications.length > 0
                        }
                        onChange={handleSelectAll}
                        className="accent-blue-600"
                      />
                    </th>
                  )}
                  {["Case ID", "Applicant", "User ID"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                  {hasDataAccess("loans", "amount") && (
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                      Loan Amount
                    </th>
                  )}
                  {hasDataAccess("loans", "terms") && (
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                      Loan Term
                    </th>
                  )}
                  {hasDataAccess("loans", "history") && (
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                      First/Re-Loan
                    </th>
                  )}
                  {hasDataAccess("users", "phone") && (
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                      Phone
                    </th>
                  )}
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                    Applied At
                  </th>
                  {activeTab === "assigned" && (
                    <>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Assigned Officer
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Assigned Date
                      </th>
                    </>
                  )}
                  {(activeTab === "completed" || activeTab === "hanged-up") && (
                    <>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Reviewed By
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Review Date
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Remarks
                      </th>
                    </>
                  )}
                  {activeTab === "active-loans" && (
                    <>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Disbursed
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Due Date
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                        Balance
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-100 whitespace-nowrap text-center">
                    Operation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentApplications.map((app) => (
                  <tr
                    key={app.id}
                    className={`transition-colors ${activeTab !== "pending-assign" ? "cursor-pointer hover:bg-blue-50/40" : ""}`}
                    onClick={() =>
                      activeTab !== "pending-assign" && handleRowClick(app)
                    }
                  >
                    {activeTab === "pending-assign" && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLoans.includes(app.id)}
                          onChange={() => handleLoanSelect(app.id)}
                          className="accent-blue-600"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-blue-600 font-mono font-semibold text-xs">
                      {app.loanId || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {app.User
                        ? `${app.User.firstName} ${app.User.lastName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                      {app.userId?.slice(0, 8)}…
                    </td>
                    {hasDataAccess("loans", "amount") && (
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        GHS {parseFloat(app.amount || 0).toLocaleString()}
                      </td>
                    )}
                    {hasDataAccess("loans", "terms") && (
                      <td className="px-4 py-3 text-gray-600">
                        {app.termInDays} days
                      </td>
                    )}
                    {hasDataAccess("loans", "history") && (
                      <td className="px-4 py-3 text-gray-600">
                        {app.loanType || "First Loan"}
                      </td>
                    )}
                    {hasDataAccess("users", "phone") && (
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {app.User?.phoneNumber
                          ? app.User.phoneNumber.replace(
                              /(\+?\d{3})(\d{4})(\d+)/,
                              "$1****$3",
                            )
                          : "N/A"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {app.createdAt
                        ? new Date(app.createdAt).toLocaleString()
                        : "—"}
                    </td>
                    {activeTab === "assigned" && (
                      <>
                        <td className="px-4 py-3 text-gray-700 font-medium text-xs">
                          {app.AssignedOfficer
                            ? `${app.AssignedOfficer.firstName} ${app.AssignedOfficer.lastName}`
                            : app.assignedOfficerId
                              ? `Officer …${app.assignedOfficerId.slice(-6)}`
                              : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {app.assignmentDate
                            ? new Date(app.assignmentDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </>
                    )}
                    {(activeTab === "completed" ||
                      activeTab === "hanged-up") && (
                      <>
                        <td className="px-4 py-3 text-gray-700 text-xs">
                          {app.ReviewedBy
                            ? `${app.ReviewedBy.firstName} ${app.ReviewedBy.lastName}`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {app.reviewDate
                            ? new Date(app.reviewDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td
                          className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate"
                          title={app.reviewRemarks}
                        >
                          {app.reviewRemarks || "N/A"}
                        </td>
                      </>
                    )}
                    {activeTab === "active-loans" && (
                      <>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {app.disbursementDate
                            ? new Date(
                                app.disbursementDate,
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {(() => {
                            if (app.dueDate)
                              return (
                                <span className="text-gray-700">
                                  {new Date(app.dueDate).toLocaleDateString()}
                                </span>
                              );
                            if (app.disbursementDate)
                              return (
                                <span className="text-amber-600">
                                  {new Date(
                                    new Date(app.disbursementDate).getTime() +
                                      (app.termInDays || 30) * 86400000,
                                  ).toLocaleDateString()}{" "}
                                  <span className="text-gray-400">(est.)</span>
                                </span>
                              );
                            return <span className="text-gray-400">—</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-600 text-sm">
                          {app.remainingBalance != null
                            ? `GHS ${parseFloat(app.remainingBalance).toLocaleString()}`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {activeTab === "assigned" ? (
                          <>
                            <button
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-md transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassignLoan(app.id);
                              }}
                            >
                              Reassign
                            </button>
                            <button
                              className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWithdrawLoan(app.id);
                              }}
                            >
                              Withdraw
                            </button>
                          </>
                        ) : activeTab === "hanged-up" ? (
                          <>
                            <button
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryContact(app.id);
                              }}
                            >
                              Retry Contact
                            </button>
                            <button
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-md transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReassignLoan(app.id);
                              }}
                            >
                              Reassign
                            </button>
                          </>
                        ) : (
                          <button
                            className="flex items-center justify-center w-7 h-7 bg-white border border-gray-200 rounded-md text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (dropdownState.id === app.id) {
                                setDropdownState({
                                  id: null,
                                  top: 0,
                                  right: 0,
                                });
                                return;
                              }
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setDropdownState({
                                id: app.id,
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                            }}
                          >
                            <FiMoreVertical size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {applications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-gray-400 text-sm">
                No loan applications found matching your criteria.
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 bg-white rounded-xl border border-gray-100">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-500 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || loading}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Fixed-position operation dropdown ───────────────────────── */}
      {dropdownState.id && (
        <div
          className="op-menu-fixed"
          style={{ top: dropdownState.top, right: dropdownState.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const app = applications.find((a) => a.id === dropdownState.id);
            if (!app) return null;
            const isApproved = app.status === "approved";
            const isDisbursed = app.status === "disbursed";
            return (
              <>
                {hasActionPermission("approveLoans") &&
                  !isApproved &&
                  !isDisbursed && (
                    <button
                      className="op-item op-review"
                      onClick={() => handleViewDetails(app, false)}
                    >
                      🔍 Review
                    </button>
                  )}
                {isApproved && hasActionPermission("approveLoans") && (
                  <button
                    className="op-item op-disburse"
                    onClick={() => handleViewDetails(app, false)}
                  >
                    💰 Disburse
                  </button>
                )}
                {isDisbursed && hasActionPermission("approveLoans") && (
                  <button
                    className="op-item op-disburse"
                    title="Confirm the customer has received the funds and start the repayment clock"
                    onClick={() => handleViewDetails(app, false)}
                  >
                    ✅ Activate Loan
                  </button>
                )}
                {hasActionPermission("viewLoans") && (
                  <button
                    className="op-item op-details"
                    onClick={() => handleViewDetails(app, true)}
                  >
                    📋 Details
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      <DetailModal
        isOpen={isModalOpen}
        type="loan"
        data={selectedLoan}
        readOnly={isReadOnly}
        onClose={handleCloseModal}
        onApprove={handleApprove}
        onReject={handleReject}
        onHangUp={handleHangUp}
        onDisburse={handleDisburse}
        onActivate={handleActivate}
      />

      <OfficerAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        selectedLoans={selectedLoans
          .map((loanId) => applications.find((app) => app.id === loanId))
          .filter(Boolean)}
        onAssignmentComplete={handleAssignmentComplete}
      />
    </div>
  );
};

export default CreditReviewList;
