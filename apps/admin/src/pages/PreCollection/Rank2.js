/**
 * PreCollection > Rank 2 — Officers ranked by collection percentage
 * Blueprint Section 8.1 — Uses GET /api/precollection/officer-performance
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiRefreshCw,
  FiTarget,
  FiAward,
  FiUsers,
  FiPercent,
} from "react-icons/fi";

const RAW_API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const API_BASE = RAW_API_BASE.endsWith("/api")
  ? RAW_API_BASE
  : `${RAW_API_BASE.replace(/\/$/, "")}/api`;
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});
const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const PreCollectionRank2 = () => {
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
        `${API_BASE}/precollection/officer-performance?${params}`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        setOfficers(
          [...(data.officers || [])].sort(
            (a, b) => b.collectionPercentage - a.collectionPercentage,
          ),
        );
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

  const avgPct = officers.length
    ? (
        officers.reduce((s, o) => s + o.collectionPercentage, 0) /
        officers.length
      ).toFixed(1)
    : "0.0";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <FiTarget size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Pre-Collection Rank 2
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Collection percentage by officer
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
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: FiUsers,
            label: "Total Officers",
            value: officers.length,
            color: "text-blue-600 bg-blue-100",
          },
          {
            icon: FiPercent,
            label: "Average Rate",
            value: `${avgPct}%`,
            color: "text-purple-600 bg-purple-100",
          },
          {
            icon: FiAward,
            label: "Top Performer",
            value: officers[0]?.officerName || "—",
            color: "text-amber-600 bg-amber-100",
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
              <p className="text-lg font-bold text-gray-800 m-0 truncate max-w-[150px]">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {[
                "Rank",
                "Officer",
                "Role",
                "Assigned",
                "Full Paid",
                "Collection %",
                "Collected",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? "text-left w-12" : i >= 3 ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading rankings…</p>
                  </div>
                </td>
              </tr>
            ) : officers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No officer data found for the selected date range.
                </td>
              </tr>
            ) : (
              officers.map((o, i) => (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "text-gray-400"}`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {o.officerName}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {o.Role?.displayName || o.Role?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {o.totalAssigned}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {o.fullPayments}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        o.collectionPercentage >= 80
                          ? "bg-green-100 text-green-700"
                          : o.collectionPercentage >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {o.collectionPercentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {fmt(o.totalCollected)}
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

export default PreCollectionRank2;
