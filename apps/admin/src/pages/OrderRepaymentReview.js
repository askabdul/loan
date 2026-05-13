import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  FiSearch,
  FiEye,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiClock,
  FiClipboard,
} from "react-icons/fi";
import DetailModal from "../components/DetailModal/DetailModal";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const OrderRepaymentReview = () => {
  const { hasActionPermission, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState("pending");

  // Data state
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [completedSubmissions, setCompletedSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const itemsPerPage = 10;
  const totalPages = Math.ceil((pagination.total || 0) / itemsPerPage);

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    action: "approve",
    reviewNotes: "",
    rejectionReason: "",
  });

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    paymentType: "",
    dateFrom: "",
    dateTo: "",
  });

  // Fetch submissions based on tab
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const status = activeTab === "pending" ? "pending" : "approved,rejected";
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        status,
        ...filters,
      }).toString();

      const response = await apiService.get(
        `/loan-clearance/list?${queryParams}`,
      );
      const body = response.data;

      if (body?.success) {
        const docs = body.data?.docs || body.data?.rows || [];
        if (activeTab === "pending") {
          setPendingSubmissions(docs);
        } else {
          setCompletedSubmissions(docs);
        }
        setPagination({
          total: body.data?.totalDocs || body.data?.count || 0,
          page: body.data?.page || currentPage,
          limit: body.data?.limit || itemsPerPage,
          totalPages:
            body.data?.totalPages ||
            Math.ceil((body.data?.totalDocs || 0) / itemsPerPage),
          hasNextPage: body.data?.hasNextPage ?? false,
          hasPrevPage: body.data?.hasPrevPage ?? false,
        });
      } else {
        setError("Failed to fetch submissions");
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
      setError("Error occurred while fetching submissions");
    } finally {
      setLoading(false);
    }
  };

  // Handle review submission
  const handleReviewSubmission = async (e) => {
    e.preventDefault();

    if (!selectedSubmission) return;

    try {
      setLoading(true);
      setError("");

      const reviewRes = await apiService.put(
        `/loan-clearance/review/${selectedSubmission.id}`,
        {
          action: reviewForm.action,
          reviewNotes: reviewForm.reviewNotes,
          ...(reviewForm.action === "reject" && {
            rejectionReason: reviewForm.rejectionReason,
          }),
        },
      );
      const reviewBody = reviewRes.data;

      if (reviewBody?.success) {
        setSuccess(`Submission ${reviewForm.action}d successfully`);
        setIsReviewModalOpen(false);
        setSelectedSubmission(null);
        setReviewForm({
          action: "approve",
          reviewNotes: "",
          rejectionReason: "",
        });
        fetchSubmissions();
      } else {
        setError(reviewBody?.message || "Failed to review submission");
      }
    } catch (error) {
      console.error("Error reviewing submission:", error);
      setError("Error occurred while reviewing submission");
    } finally {
      setLoading(false);
    }
  };

  // View submission details
  const handleViewSubmission = (submission) => {
    setSelectedSubmission(submission);
    setIsModalOpen(true);
  };

  // Start review process
  const handleStartReview = (submission) => {
    setSelectedSubmission(submission);
    setIsReviewModalOpen(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge class
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "pending";
      case "approved":
        return "approved";
      case "rejected":
        return "rejected";
      default:
        return "pending";
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: "",
      paymentType: "",
      dateFrom: "",
      dateTo: "",
    });
    setCurrentPage(1);
  };

  // Get current submissions based on active tab
  const getCurrentSubmissions = () => {
    return activeTab === "pending" ? pendingSubmissions : completedSubmissions;
  };

  // Effects
  useEffect(() => {
    fetchSubmissions();
  }, [activeTab, currentPage]);

  useEffect(() => {
    const debounceMs = filters.dateFrom || filters.dateTo ? 150 : 300;
    const delayedSearch = setTimeout(() => {
      if (currentPage === 1) {
        fetchSubmissions();
      } else {
        setCurrentPage(1);
      }
    }, debounceMs);

    return () => clearTimeout(delayedSearch);
  }, [filters]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (!hasActionPermission("loan_clearance")) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md">
          <p className="text-lg font-bold text-gray-700 mb-1">Access Denied</p>
          <p className="text-sm text-gray-400">
            You don't have permission to access loan clearance review
            functionality.
          </p>
        </div>
      </div>
    );
  }

  const STATUS_BADGE = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const currentSubs = getCurrentSubmissions();

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiClipboard size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Order Repayment Review
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Review and approve loan clearance submissions
            </p>
          </div>
        </div>
        <button
          onClick={fetchSubmissions}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-700 ml-4 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 mb-5 text-sm text-emerald-700 flex items-center justify-between">
          {success}
          <button
            onClick={() => setSuccess("")}
            className="text-emerald-400 hover:text-emerald-700 ml-4 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          {
            key: "pending",
            label: `Pending Review (${pendingSubmissions.length})`,
            icon: <FiClock size={13} />,
          },
          {
            key: "completed",
            label: `Completed (${completedSubmissions.length})`,
            icon: <FiCheck size={13} />,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition ${
              activeTab === t.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by User ID, Loan ID..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={filters.paymentType}
          onChange={(e) => handleFilterChange("paymentType", e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Payment Types</option>
          <option value="full">Full Payment</option>
          <option value="partial">Partial Payment</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange("dateTo", e.target.value)}
          className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={clearFilters}
          title="Clear Filters"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
        >
          <FiX size={13} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        {loading && currentSubs.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
            submissions...
          </div>
        ) : (
          <table style={{ minWidth: "780px" }} className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Submission ID",
                  "User Info",
                  "Loan ID",
                  "Payment Type",
                  "Amount",
                  "Status",
                  "Submitted",
                  ...(activeTab === "completed" ? ["Reviewed"] : []),
                  "Actions",
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
              {currentSubs.length > 0 ? (
                currentSubs.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {s.id?.slice(-8) || s.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-700 m-0">
                        {s.user?.fullName || "N/A"}
                      </p>
                      <p className="text-[10px] text-gray-400 m-0">
                        ID: {s.user?.userId || "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.loan?.loanId || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                      {s.paymentType}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {formatCurrency(s.amountCleared)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[s.status?.toLowerCase()] || STATUS_BADGE.pending}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(s.submittedAt)}
                    </td>
                    {activeTab === "completed" && (
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {s.reviewedAt ? formatDate(s.reviewedAt) : "N/A"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewSubmission(s)}
                          title="View Details"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                        >
                          <FiEye size={13} />
                        </button>
                        {activeTab === "pending" && (
                          <button
                            onClick={() => handleStartReview(s)}
                            title="Review"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition"
                          >
                            <FiCheck size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={activeTab === "completed" ? 9 : 8}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    {activeTab === "pending"
                      ? "No pending submissions"
                      : "No completed submissions"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isModalOpen && selectedSubmission && (
        <DetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSubmission(null);
          }}
          title="Clearance Submission Details"
          data={{
            "Submission ID": selectedSubmission._id,
            "User ID": selectedSubmission.user?.userId || "N/A",
            "User Name": selectedSubmission.user?.fullName || "N/A",
            "Loan ID": selectedSubmission.loan?.loanId || "N/A",
            "Loan Amount": formatCurrency(selectedSubmission.loan?.amount),
            "Outstanding Balance": formatCurrency(
              selectedSubmission.loan?.outstandingBalance,
            ),
            "Payment Type": selectedSubmission.paymentType,
            "Amount Cleared": formatCurrency(selectedSubmission.amountCleared),
            Status: selectedSubmission.status,
            "Submitted By": selectedSubmission.submittedBy?.fullName || "N/A",
            "Submitted At": formatDate(selectedSubmission.submittedAt),
            "Reviewed By":
              selectedSubmission.reviewedBy?.fullName || "Not reviewed",
            "Reviewed At": selectedSubmission.reviewedAt
              ? formatDate(selectedSubmission.reviewedAt)
              : "Not reviewed",
            Notes: selectedSubmission.notes || "No notes",
            "Review Notes": selectedSubmission.reviewNotes || "No review notes",
          }}
          additionalContent={
            selectedSubmission.popUrl && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Proof of Payment
                </p>
                {selectedSubmission.popUrl.endsWith(".pdf") ? (
                  <a
                    href={selectedSubmission.popUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline"
                  >
                    View PDF Document
                  </a>
                ) : (
                  <img
                    src={selectedSubmission.popUrl}
                    alt="Proof of Payment"
                    className="max-w-full rounded-xl border border-gray-100"
                  />
                )}
              </div>
            )
          }
        />
      )}

      {/* Review Modal */}
      {isReviewModalOpen &&
        selectedSubmission &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 250,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
              padding: "16px",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                maxWidth: "520px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                margin: "0 16px",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800 text-base m-0">
                  Review Submission
                </p>
                <button
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setSelectedSubmission(null);
                    setReviewForm({ action: "approve", reviewNotes: "" });
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                >
                  <FiX size={14} />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 mb-5">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Submission Summary
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      [
                        "User",
                        `${selectedSubmission.user?.fullName} (${selectedSubmission.user?.userId})`,
                      ],
                      ["Loan ID", selectedSubmission.loan?.loanId],
                      ["Payment Type", selectedSubmission.paymentType],
                      [
                        "Amount",
                        formatCurrency(selectedSubmission.amountCleared),
                      ],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide m-0">
                          {lbl}
                        </p>
                        <p className="text-sm text-gray-700 font-semibold m-0">
                          {val}
                        </p>
                      </div>
                    ))}
                  </div>
                  {selectedSubmission.popUrl && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Proof of Payment
                      </p>
                      {selectedSubmission.popUrl.endsWith(".pdf") ? (
                        <a
                          href={selectedSubmission.popUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline"
                        >
                          View PDF
                        </a>
                      ) : (
                        <img
                          src={selectedSubmission.popUrl}
                          alt="POP"
                          className="max-w-full rounded-xl border border-gray-100 mt-1"
                          style={{ maxHeight: "120px" }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <form onSubmit={handleReviewSubmission} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Review Decision
                    </label>
                    <div className="flex items-center gap-3">
                      {[
                        ["approve", "Approve", "text-emerald-600"],
                        ["reject", "Reject", "text-red-600"],
                      ].map(([val, lbl, cls]) => (
                        <label
                          key={val}
                          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border cursor-pointer transition ${
                            reviewForm.action === val
                              ? val === "approve"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                : "bg-red-50 border-red-300 text-red-700"
                              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="action"
                            value={val}
                            checked={reviewForm.action === val}
                            onChange={(e) =>
                              setReviewForm((p) => ({
                                ...p,
                                action: e.target.value,
                              }))
                            }
                            className="hidden"
                          />
                          {val === "approve" ? (
                            <FiCheck size={13} />
                          ) : (
                            <FiX size={13} />
                          )}{" "}
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Review Notes
                    </label>
                    <textarea
                      value={reviewForm.reviewNotes}
                      onChange={(e) =>
                        setReviewForm((p) => ({
                          ...p,
                          reviewNotes: e.target.value,
                        }))
                      }
                      placeholder="Add review notes (optional)..."
                      rows={3}
                      className={`${inp} resize-none`}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition ${
                        reviewForm.action === "approve"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {loading
                        ? "Processing..."
                        : `${reviewForm.action === "approve" ? "Approve" : "Reject"} Submission`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReviewModalOpen(false);
                        setSelectedSubmission(null);
                        setReviewForm({ action: "approve", reviewNotes: "" });
                      }}
                      className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default OrderRepaymentReview;
