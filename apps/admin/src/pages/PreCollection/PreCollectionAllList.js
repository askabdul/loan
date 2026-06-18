/**
 * PreCollectionAllList.js — Blueprint Section 8
 * Shows all active loans approaching or past due date.
 * Accessible by: super-admin, admin, local-manager, precollection-lead, precollection-officer
 * Data source: GET /api/precollection/cases
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiLayers,
  FiDollarSign,
  FiCalendar,
  FiUser,
  FiPhone,
} from "react-icons/fi";
import { toast } from "react-toastify";

const RAW_API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const API_BASE = RAW_API_BASE.endsWith("/api")
  ? RAW_API_BASE
  : `${RAW_API_BASE.replace(/\/$/, "")}/api`;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const daysLabel = (dueDate) => {
  if (!dueDate) return { text: "—", cls: "bg-gray-100 text-gray-500" };
  const diff = Math.ceil((new Date(dueDate) - Date.now()) / 86400000);
  if (diff < 0)
    return {
      text: `${Math.abs(diff)}d overdue`,
      cls: "bg-red-100 text-red-700",
    };
  if (diff === 0)
    return { text: "Due today", cls: "bg-orange-100 text-orange-700" };
  if (diff <= 3)
    return { text: `${diff}d left`, cls: "bg-amber-100 text-amber-700" };
  return { text: `${diff}d left`, cls: "bg-emerald-100 text-emerald-700" };
};

const PRECOLL_STATUS_BADGE = {
  "pending-assignment": "bg-amber-50 text-amber-700 border-amber-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  processed: "bg-purple-50 text-purple-700 border-purple-200",
  "hung-up": "bg-red-50 text-red-700 border-red-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const LOAN_STATUS_BADGE = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-gray-100 text-gray-500 border-gray-200",
};

const PRECOLL_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "pending-assignment", label: "Pending Assignment" },
  { value: "assigned", label: "Assigned" },
  { value: "processed", label: "Processed" },
  { value: "hung-up", label: "Hung Up" },
  { value: "completed", label: "Completed" },
];

const PreCollectionAllList = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const LIMIT = 20;

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: LIMIT,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`${API_BASE}/precollection/cases?${params}`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        let list = data.loans || [];
        // Client-side search filter on name / phone / loanId
        if (search.trim()) {
          const q = search.toLowerCase();
          list = list.filter(
            (l) =>
              l.User?.firstName?.toLowerCase().includes(q) ||
              l.User?.lastName?.toLowerCase().includes(q) ||
              l.User?.phoneNumber?.includes(q) ||
              l.loanId?.toLowerCase().includes(q),
          );
        }
        setLoans(list);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load pre-collection cases");
      }
    } catch {
      toast.error("Network error — could not load cases");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiLayers size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Pre-Collection Cases
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Active loans being monitored before/after due date · {total} total
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchLoans()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
        >
          <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search name, phone, loan ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {PRECOLL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: 800 }}
        >
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {[
                "Loan ID",
                "Customer",
                "Phone",
                "Outstanding",
                "Due Date",
                "Status",
                "Pre-Coll Status",
                "Officer",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading cases…</p>
                  </div>
                </td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-16 text-center text-sm text-gray-400"
                >
                  No pre-collection cases found.
                </td>
              </tr>
            ) : (
              loans.map((loan) => {
                const { text: dText, cls: dCls } = daysLabel(
                  loan.extendedDueDate || loan.dueDate,
                );
                return (
                  <tr
                    key={loan.id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {loan.loanId?.slice(-10) || loan.id?.slice(-8)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 text-sm">
                        {loan.User?.firstName} {loan.User?.lastName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {loan.User?.phoneNumber || "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {fmt(loan.remainingBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-500">
                          {loan.extendedDueDate
                            ? new Date(
                                loan.extendedDueDate,
                              ).toLocaleDateString()
                            : loan.dueDate
                              ? new Date(loan.dueDate).toLocaleDateString()
                              : "—"}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${dCls}`}
                        >
                          {dText}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${LOAN_STATUS_BADGE[loan.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRECOLL_STATUS_BADGE[loan.precollectionStatus] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                      >
                        {loan.precollectionStatus || "unassigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {loan.PrecollectionOfficer ? (
                        `${loan.PrecollectionOfficer.firstName} ${loan.PrecollectionOfficer.lastName}`
                      ) : (
                        <span className="text-gray-300 italic">Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} · {total} total
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loans.length < LIMIT || loading}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default PreCollectionAllList;
