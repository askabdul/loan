/**
 * Collection > Rank 1
 * Blueprint Section 9.1 — Daily collection amounts by officer
 * Uses GET /api/collection/officer-performance (full officer stats)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiRefreshCw,
  FiTrendingUp,
  FiDollarSign,
  FiAward,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(n || 0);

const CollectionRank1 = () => {
  useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [officers, setOfficers] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(
        `${API_BASE}/collection/officer-performance?${params}`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        // Sort by total collected descending
        const sorted = [...(data.officers || [])].sort(
          (a, b) => b.totalCollected - a.totalCollected,
        );
        setOfficers(sorted);
      } else {
        setError(data.message || "Failed to load data");
      }
    } catch {
      setError("Network error — check that the backend is running");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCollected = officers.reduce((s, o) => s + o.totalCollected, 0);
  const totalAssigned = officers.reduce((s, o) => s + o.totalAssigned, 0);
  const totalFull = officers.reduce((s, o) => s + o.fullPayments, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center">
            <FiAward size={18} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Collection Rank 1
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Amount collected by officer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: FiDollarSign,
            label: "Total Collected",
            value: fmt(totalCollected),
            color: "text-green-600 bg-green-100",
          },
          {
            icon: FiUsers,
            label: "Total Assigned Cases",
            value: totalAssigned,
            color: "text-blue-600 bg-blue-100",
          },
          {
            icon: FiTrendingUp,
            label: "Full Payments",
            value: totalFull,
            color: "text-purple-600 bg-purple-100",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
            >
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">
                {label}
              </p>
              <p className="text-lg font-bold text-gray-800 m-0">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Rank table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 620 }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Officer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Role
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assigned
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Full Paid
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Collected
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Rate %
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-400 text-sm"
                >
                  Loading…
                </td>
              </tr>
            ) : officers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-400 text-sm"
                >
                  No data for selected period
                </td>
              </tr>
            ) : (
              officers.map((o, i) => (
                <tr
                  key={o.officerId || o.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-yellow-400 text-white"
                          : i === 1
                            ? "bg-gray-300 text-gray-800"
                            : i === 2
                              ? "bg-orange-400 text-white"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {o.officerName ||
                      `${o.firstName || ""} ${o.lastName || ""}`.trim()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.Role?.displayName || o.Role?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {o.totalAssigned}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {o.fullPayments}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {fmt(o.totalCollected)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        o.collectionPercentage >= 75
                          ? "bg-green-100 text-green-700"
                          : o.collectionPercentage >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {o.collectionPercentage}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectionRank1;
