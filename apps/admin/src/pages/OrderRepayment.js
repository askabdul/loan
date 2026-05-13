import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiUpload,
  FiPlus,
  FiEye,
  FiRefreshCw,
  FiUser,
  FiCreditCard,
  FiCheckCircle,
} from "react-icons/fi";
import DetailModal from "../components/DetailModal/DetailModal";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const OrderRepayment = () => {
  const { hasActionPermission, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search form state
  const [searchForm, setSearchForm] = useState({
    userId: "",
    loanId: "",
  });
  const [searchedLoan, setSearchedLoan] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Clearance form state
  const [clearanceForm, setClearanceForm] = useState({
    paymentType: "full",
    amountCleared: "",
    popFile: null,
    notes: "",
  });

  // Submissions list
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const itemsPerPage = 10;
  const totalPages = Math.ceil((pagination.total || 0) / itemsPerPage);

  // Fetch submissions
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/loan-clearance/list?page=${currentPage}&limit=${itemsPerPage}`,
      );
      const body = response.data;

      if (body?.success) {
        setSubmissions(body.data?.docs || body.data?.rows || []);
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

  // Search for loan
  const handleLoanSearch = async (e) => {
    e.preventDefault();

    if (!searchForm.userId || !searchForm.loanId) {
      setError("Please enter both User ID and Loan ID");
      return;
    }

    try {
      setSearchLoading(true);
      setError("");

      const response = await apiService.get(
        `/loan-clearance/search-loan?userId=${searchForm.userId}&loanId=${searchForm.loanId}`,
      );
      const body = response.data;

      if (body?.success) {
        const loanData = body.data?.loan || body.loan;
        // backend returns remainingBalance, map to outstandingBalance for UI
        const normalizedLoan = loanData
          ? {
              ...loanData,
              outstandingBalance:
                loanData.outstandingBalance ?? loanData.remainingBalance ?? 0,
              user: {
                fullName:
                  `${body.data?.user?.firstName || ""} ${body.data?.user?.lastName || ""}`.trim(),
              },
            }
          : null;
        setSearchedLoan(normalizedLoan);
        setClearanceForm((prev) => ({
          ...prev,
          amountCleared: normalizedLoan?.outstandingBalance || "",
        }));
      } else {
        setError(body?.message || "Loan not found");
        setSearchedLoan(null);
      }
    } catch (error) {
      console.error("Error searching loan:", error);
      setError("Error occurred while searching for loan");
      setSearchedLoan(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setError("File size must be less than 5MB");
        return;
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPEG, PNG, and PDF files are allowed");
        return;
      }

      setClearanceForm((prev) => ({ ...prev, popFile: file }));
      setError("");
    }
  };

  // Submit clearance request
  const handleSubmitClearance = async (e) => {
    e.preventDefault();

    if (!searchedLoan) {
      setError("Please search for a loan first");
      return;
    }

    if (!clearanceForm.popFile) {
      setError("Please upload proof of payment");
      return;
    }

    if (
      clearanceForm.paymentType === "partial" &&
      !clearanceForm.amountCleared
    ) {
      setError("Please enter the amount cleared for partial payment");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("userId", searchForm.userId);
      formData.append("loanId", searchForm.loanId);
      formData.append("paymentType", clearanceForm.paymentType);
      formData.append("amountCleared", clearanceForm.amountCleared);
      formData.append("popFile", clearanceForm.popFile);
      formData.append("notes", clearanceForm.notes);

      const response = await apiService.post(
        "/loan-clearance/submit",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const body = response.data;
      if (body?.success) {
        setSuccess("Loan clearance request submitted successfully");
        // Reset forms
        setSearchForm({ userId: "", loanId: "" });
        setClearanceForm({
          paymentType: "full",
          amountCleared: "",
          popFile: null,
          notes: "",
        });
        setSearchedLoan(null);
        // Refresh submissions
        fetchSubmissions();
      } else {
        setError(body?.message || "Failed to submit clearance request");
      }
    } catch (error) {
      console.error("Error submitting clearance:", error);
      setError("Error occurred while submitting clearance request");
    } finally {
      setLoading(false);
    }
  };

  // View submission details
  const handleViewSubmission = (submission) => {
    setSelectedSubmission(submission);
    setIsModalOpen(true);
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
    const badges = {
      pending: "badge-pending",
      approved: "badge-approved",
      rejected: "badge-rejected",
      withdrawn: "badge-withdrawn",
    };
    return badges[status] || "badge-pending";
  };

  useEffect(() => {
    fetchSubmissions();
  }, [currentPage]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const STATUS_BADGE = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    withdrawn: "bg-gray-100 text-gray-500 border-gray-200",
  };

  if (!hasActionPermission("loan_clearance")) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md">
          <p className="text-lg font-bold text-gray-700 mb-1">Access Denied</p>
          <p className="text-sm text-gray-400">
            You don't have permission to access loan clearance functionality.
          </p>
        </div>
      </div>
    );
  }

  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiCheckCircle size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Order Repayment
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Submit and track loan clearance requests
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

      {/* Loan Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          Search Loan
        </p>
        <form
          onSubmit={handleLoanSearch}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              User ID
            </label>
            <div className="relative">
              <FiUser
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchForm.userId}
                onChange={(e) =>
                  setSearchForm((prev) => ({ ...prev, userId: e.target.value }))
                }
                placeholder="Enter User ID"
                required
                className={`${inp} pl-9`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Loan ID
            </label>
            <div className="relative">
              <FiCreditCard
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchForm.loanId}
                onChange={(e) =>
                  setSearchForm((prev) => ({ ...prev, loanId: e.target.value }))
                }
                placeholder="Enter Loan ID"
                required
                className={`${inp} pl-9`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            <FiSearch size={13} /> {searchLoading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {/* Loan Details & Clearance Form */}
      {searchedLoan && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Loan Details
            </p>
            <div className="space-y-2.5">
              {[
                ["Borrower", searchedLoan.user?.fullName || "N/A"],
                ["Loan Amount", formatCurrency(searchedLoan.amount)],
                [
                  "Outstanding Balance",
                  formatCurrency(searchedLoan.outstandingBalance),
                ],
                ["Status", searchedLoan.status],
                ["Due Date", formatDate(searchedLoan.dueDate)],
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {lbl}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Submit Clearance
            </p>
            <form onSubmit={handleSubmitClearance} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Payment Type
                </label>
                <select
                  value={clearanceForm.paymentType}
                  onChange={(e) =>
                    setClearanceForm((prev) => ({
                      ...prev,
                      paymentType: e.target.value,
                      amountCleared:
                        e.target.value === "full"
                          ? searchedLoan.outstandingBalance
                          : "",
                    }))
                  }
                  className={inp}
                >
                  <option value="full">Full Payment</option>
                  <option value="partial">Partial Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Amount Cleared
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={searchedLoan.outstandingBalance}
                  value={clearanceForm.amountCleared}
                  onChange={(e) =>
                    setClearanceForm((prev) => ({
                      ...prev,
                      amountCleared: e.target.value,
                    }))
                  }
                  placeholder="Enter amount cleared"
                  disabled={clearanceForm.paymentType === "full"}
                  required
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Proof of Payment
                </label>
                <label
                  htmlFor="popFile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 bg-gray-50 text-gray-500 hover:text-blue-600 transition"
                >
                  <FiUpload size={13} />
                  {clearanceForm.popFile
                    ? clearanceForm.popFile.name
                    : "Choose file (JPG, PNG, PDF)"}
                </label>
                <input
                  type="file"
                  id="popFile"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Notes (Optional)
                </label>
                <textarea
                  value={clearanceForm.notes}
                  onChange={(e) =>
                    setClearanceForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Add any additional notes..."
                  rows={2}
                  className={`${inp} resize-none`}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition w-full justify-center"
              >
                <FiPlus size={13} />{" "}
                {loading ? "Submitting..." : "Submit Clearance"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Submissions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest m-0">
            Recent Submissions
          </p>
        </div>
        {loading && submissions.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
            submissions...
          </div>
        ) : (
          <table style={{ minWidth: "700px" }} className="w-full">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Submission ID",
                  "User ID",
                  "Loan ID",
                  "Payment Type",
                  "Amount",
                  "Status",
                  "Submitted",
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
              {submissions.length > 0 ? (
                submissions.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {s.id?.slice(-8) || s.id}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.user?.userId || "N/A"}
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[s.status] || STATUS_BADGE.pending}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(s.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewSubmission(s)}
                        title="View Details"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                      >
                        <FiEye size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    No submissions found
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
    </div>
  );
};

export default OrderRepayment;
