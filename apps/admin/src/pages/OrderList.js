import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiShoppingCart,
  FiUser,
  FiCalendar,
  FiFilter,
  FiEye,
  FiAlertCircle,
} from "react-icons/fi";
import DetailModal from "../components/DetailModal/DetailModal";
import apiService from "../services/api";

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

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  "under-review": "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  disbursed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  active: "bg-teal-50 text-teal-700 border-teal-200",
  overdue: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  "hanged-up": "bg-gray-50 text-gray-600 border-gray-200",
  defaulted: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const ALL_STATUSES = [
  "pending",
  "under-review",
  "approved",
  "disbursed",
  "active",
  "overdue",
  "completed",
  "rejected",
  "hanged-up",
  "defaulted",
  "cancelled",
];

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
      STATUS_BADGE[status] || "bg-gray-50 text-gray-600 border-gray-200"
    }`}
  >
    {status?.replace(/-/g, " ") || "—"}
  </span>
);

const OrderList = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLoans = useCallback(
    async (page = currentPage, search = searchTerm, status = statusFilter) => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getLoans({
          page,
          limit: 15,
          status: status || undefined,
          search: search || undefined,
          sortBy: "created_at",
          sortOrder: "desc",
        });
        const data = res?.data || res;
        setLoans(data?.loans || []);
        setPagination({
          total: data?.pagination?.total || 0,
          pages: data?.pagination?.pages || 1,
        });
      } catch (err) {
        setError("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage, searchTerm, statusFilter],
  );

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchLoans(1, searchTerm, statusFilter);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter]);

  const openDetail = async (loan) => {
    try {
      const res = await apiService.getLoanById(loan.id);
      setSelectedLoan(res?.data?.loan || res?.loan || loan);
    } catch {
      setSelectedLoan(loan);
    }
    setModalOpen(true);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiShoppingCart size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Order List
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              All loan orders
              {pagination.total > 0 && (
                <span className="ml-2 font-semibold text-gray-600">
                  {pagination.total} total
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

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <FiSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name or ID…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="relative">
            <FiFilter
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 appearance-none"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </div>
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
            Loading orders…
          </div>
        ) : loans.length === 0 ? (
          <div className="py-16 text-center">
            <FiShoppingCart size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No orders found</p>
            {(searchTerm || statusFilter) && (
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your search or filter.
              </p>
            )}
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
                    "Status",
                    "Applied",
                    "Due Date",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loans.map((loan) => (
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
                    <td className="px-4 py-3">
                      <StatusBadge status={loan.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <FiCalendar size={11} />
                        {formatDate(loan.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {loan.dueDate ? (
                        <div className="flex items-center gap-1">
                          <FiCalendar size={11} />
                          {formatDate(loan.extendedDueDate || loan.dueDate)}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(loan)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="View details"
                      >
                        <FiEye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{pagination.total} total orders</span>
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

export default OrderList;
