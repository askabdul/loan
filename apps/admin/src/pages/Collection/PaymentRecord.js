/**
 * Collection > Payment Record
 * Blueprint Section 9.1 — Completed payments on collection-assigned loans
 * Uses GET /api/collection/repayments
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiDollarSign,
  FiCreditCard,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CollectionPaymentRecord = () => {
  useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [officers, setOfficers] = useState([]);

  const [officerId, setOfficerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  // Fetch officers list for filter dropdown
  const fetchOfficers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/collection/officers`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) setOfficers(data.officers || []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchPayments = useCallback(
    async (p = page) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: p, limit: LIMIT });
        if (officerId) params.set("officerId", officerId);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`${API_BASE}/collection/repayments?${params}`, {
          headers: authHeader(),
        });
        const data = await res.json();
        if (data.success) {
          setPayments(data.payments || []);
          setTotal(data.total || 0);
        } else {
          setError(data.message || "Failed to load payment records");
        }
      } catch {
        setError("Network error — check that the backend is running");
      } finally {
        setLoading(false);
      }
    },
    [page, officerId, startDate, endDate],
  );

  // Officers loaded once
  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  // Payments refreshed on deps change
  useEffect(() => {
    fetchPayments(page);
  }, [fetchPayments, page]);

  const handleSearch = () => {
    setPage(1);
    fetchPayments(1);
  };

  const handleReset = () => {
    setOfficerId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    fetchPayments(1);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiCreditCard size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Collection Payment Records
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Completed payments on collection-assigned loans · {total} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          Filters
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Officer
            </label>
            <select
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.firstName} {o.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
            >
              <FiSearch size={13} /> Search
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto mb-5">
        <table className="w-full text-sm" style={{ minWidth: 800 }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {[
                "User",
                "Phone",
                "Amount",
                "Date",
                "Transaction ID",
                "Collection Officer",
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
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  <FiRefreshCw
                    size={16}
                    className="animate-spin inline-block mr-2"
                  />
                  Loading…
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No payment records found
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.User
                      ? `${p.User.firstName} ${p.User.lastName}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.User?.phoneNumber || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-700">
                    <span className="flex items-center gap-1">
                      <FiDollarSign size={11} />
                      {fmt(p.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(p.completedAt || p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {p.transactionId || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.Loan?.CollectionOfficer
                      ? `${p.Loan.CollectionOfficer.firstName} ${p.Loan.CollectionOfficer.lastName}`.trim()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionPaymentRecord;
