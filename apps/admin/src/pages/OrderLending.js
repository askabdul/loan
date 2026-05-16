import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiDollarSign,
  FiUser,
  FiCalendar,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
} from "react-icons/fi";
import { toast } from "react-toastify";
import DetailModal from "../components/DetailModal/DetailModal";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  });

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Loans approved but not yet disbursed. Admin clicks "Disburse" to mark as disbursed.
const OrderLending = () => {
  const { hasActionPermission, isSuperAdmin } = useAuth();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [disbursing, setDisbursing] = useState(null); // loanId being processed
  const [remarkDialog, setRemarkDialog] = useState(null); // { loanId }
  const [remark, setRemark] = useState("");

  const canDisburse = hasActionPermission("updateLoanStatus") || isSuperAdmin;

  const fetchLoans = useCallback(
    async (page = currentPage, search = searchTerm) => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getLoans({
          page,
          limit: 15,
          status: "approved",
          search: search || undefined,
        });
        const data = res?.data || res;
        setLoans(data?.loans || []);
        setPagination({
          total: data?.pagination?.total || 0,
          pages: data?.pagination?.pages || 1,
        });
      } catch (err) {
        setError("Failed to load disbursement queue.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage, searchTerm],
  );

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchLoans(1, searchTerm);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleDisburse = async () => {
    if (!remarkDialog) return;
    try {
      setDisbursing(remarkDialog.loanId);
      await apiService.updateLoanStatus(
        remarkDialog.loanId,
        "disbursed",
        remark || "Disbursed by admin",
      );
      toast.success("Loan marked as disbursed");
      setRemarkDialog(null);
      setRemark("");
      fetchLoans();
    } catch (err) {
      toast.error(err?.message || "Failed to disburse loan");
    } finally {
      setDisbursing(null);
    }
  };

  const openDetail = async (loan) => {
    try {
      const res = await apiService.getLoanById(loan.id);
      setSelectedLoan(res?.data?.loan || res?.loan || loan);
      setModalOpen(true);
    } catch {
      setSelectedLoan(loan);
      setModalOpen(true);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <FiDollarSign size={18} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Order Lending
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Approved loans awaiting disbursement
              {pagination.total > 0 && (
                <span className="ml-2 text-green-600 font-semibold">
                  {pagination.total} pending
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => fetchLoans()}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
          <FiAlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Loading disbursement queue…
          </div>
        ) : loans.length === 0 ? (
          <div className="py-16 text-center">
            <FiCheckCircle size={36} className="text-green-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              No loans awaiting disbursement
            </p>
            <p className="text-gray-400 text-sm mt-1">
              All approved loans have been disbursed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Loan ID",
                    "Customer",
                    "Amount",
                    "Level",
                    "Approved",
                    "Request",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loans.map((loan) => {
                  const hasRequest = (loan.adminNotes || []).some(
                    (n) => n.type === "disbursement_request",
                  );
                  return (
                    <tr
                      key={loan.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        #{loan.loanId || loan.id?.slice(-8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <FiUser size={12} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {loan.User
                                ? `${loan.User.firstName} ${loan.User.lastName}`
                                : "—"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {loan.User?.phoneNumber || loan.User?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                          L{loan.loanLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1">
                          <FiCalendar size={11} />
                          {formatDate(loan.approvalDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {hasRequest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                            <FiCheckCircle size={10} /> Requested
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetail(loan)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="View details"
                          >
                            <FiEye size={14} />
                          </button>
                          {canDisburse && (
                            <button
                              onClick={() => {
                                setRemarkDialog({ loanId: loan.id });
                                setRemark("");
                              }}
                              disabled={disbursing === loan.id}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {disbursing === loan.id
                                ? "Processing…"
                                : "Disburse"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{pagination.total} total loans</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs font-medium">
                {currentPage} / {pagination.pages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.pages, p + 1))
                }
                disabled={currentPage === pagination.pages || loading}
                className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disburse remark dialog */}
      {remarkDialog && (
        <div
          className="fixed top-0 left-0 md:left-64 right-0 bottom-0 z-[1200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
          onClick={() => setRemarkDialog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-800 mb-1">
              Confirm Disbursement
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Mark this loan as disbursed. Add a note (e.g. MoMo reference
              number).
            </p>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Disbursement note / transaction reference (optional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemarkDialog(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDisburse}
                disabled={disbursing === remarkDialog?.loanId}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-40"
              >
                {disbursing === remarkDialog?.loanId
                  ? "Processing…"
                  : "Confirm Disbursement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modalOpen && selectedLoan && (
        <DetailModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          data={selectedLoan}
          readOnly={true}
        />
      )}
    </div>
  );
};

export default OrderLending;
