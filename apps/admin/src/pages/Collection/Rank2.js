/**
 * Rank2.js — Collection Officer Performance Leaderboard
 * Blueprint Section 9.3
 * Gold / Silver / Bronze for top 3. Date range filter. Metric toggle. CSV export. Reward tracking.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiDownload,
  FiRefreshCw,
  FiAward,
  FiCalendar,
  FiBarChart2,
} from "react-icons/fi";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const toDateStr = (d) => d.toISOString().split("T")[0];

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_CLASS = [
  "text-yellow-600 bg-yellow-50 border-yellow-200",
  "text-gray-500 bg-gray-50 border-gray-200",
  "text-orange-500 bg-orange-50 border-orange-200",
];

const METRICS = [
  {
    key: "collectionPercentage",
    label: "Collection %",
    desc: "% of assigned amount collected",
  },
  {
    key: "totalCollected",
    label: "Amount Collected",
    desc: "Total GHS collected",
  },
  {
    key: "fullPaymentRate",
    label: "Full Payment Rate",
    desc: "% of cases fully resolved",
  },
];

function PctBar({ value, color = "bg-blue-500" }) {
  const v = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`${color} h-1.5 rounded-full transition-all`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

const Rank2 = () => {
  const [loading, setLoading] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [metric, setMetric] = useState("collectionPercentage");
  const [rewards, setRewards] = useState({}); // { [officerId]: { amount, note } }

  const today = toDateStr(new Date());
  const thirtyAgo = toDateStr(new Date(Date.now() - 29 * 86400000));
  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate] = useState(today);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(
        `${API_BASE}/collection/officer-performance?${params}`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        const sorted = [...(data.officers || [])].sort(
          (a, b) => (b[metric] || 0) - (a[metric] || 0),
        );
        setOfficers(sorted);
      } else {
        toast.error(data.message || "Failed to load performance data");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-sort client-side when metric changes without re-fetching
  const sorted = [...officers].sort(
    (a, b) => (b[metric] || 0) - (a[metric] || 0),
  );

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = [
      "Rank",
      "Officer",
      "Cases Assigned",
      "Amount Collected",
      "Full Payments",
      "Partial Payments",
      "Pending",
      "Collection %",
      "Full Payment Rate",
      "Reward Amount",
      "Reward Note",
    ];
    const rows = sorted.map((o, i) => {
      const rw = rewards[o.id] || {};
      return [
        i + 1,
        `${o.firstName} ${o.lastName}`,
        o.totalAssigned ?? 0,
        o.totalCollected ?? 0,
        o.fullPayments ?? 0,
        o.partialPayments ?? 0,
        o.pendingCases ?? 0,
        `${(o.collectionPercentage || 0).toFixed(1)}%`,
        `${(o.fullPaymentRate || 0).toFixed(1)}%`,
        rw.amount || "",
        rw.note || "",
      ].join(",");
    });
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `officer-performance-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateReward = (id, field, value) =>
    setRewards((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <FiAward className="text-yellow-500" size={22} />
            <h1 className="text-2xl font-bold text-gray-800">
              Officer Performance Leaderboard
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Collection team rankings · Top 3 earn Gold / Silver / Bronze
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold"
          >
            <FiDownload size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white border border-gray-100 rounded-xl shadow-sm items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            <FiCalendar size={11} className="inline mr-1" />
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            <FiBarChart2 size={11} className="inline mr-1" />
            Rank By
          </label>
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                title={m.desc}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${metric === m.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 Cards */}
      {!loading && sorted.length >= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {sorted.slice(0, 3).map((o, i) => (
            <div
              key={o.id}
              className={`relative bg-white border rounded-2xl p-5 shadow-sm ${MEDAL_CLASS[i]}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">{MEDALS[i]}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${MEDAL_CLASS[i]}`}
                >
                  #{i + 1}
                </span>
              </div>
              <p className="font-bold text-gray-800 text-base">
                {o.firstName} {o.lastName}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {o.Role?.displayName || "Officer"}
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Collection %</span>
                  <span className="font-bold text-gray-800">
                    {(o.collectionPercentage || 0).toFixed(1)}%
                  </span>
                </div>
                <PctBar
                  value={o.collectionPercentage}
                  color={
                    i === 0
                      ? "bg-yellow-400"
                      : i === 1
                        ? "bg-gray-400"
                        : "bg-orange-400"
                  }
                />
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-gray-500">Collected</span>
                  <span className="font-semibold text-gray-700">
                    {fmt(o.totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Full Payments</span>
                  <span className="font-semibold text-gray-700">
                    {o.fullPayments ?? 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Full Rankings</h2>
          <span className="text-xs text-gray-400">
            {sorted.length} officers
          </span>
        </div>
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: 900 }}
        >
          <thead>
            <tr className="bg-gray-50 text-left border-b border-gray-100">
              {[
                "Rank",
                "Officer",
                "Cases Assigned",
                "Collected",
                "Full",
                "Partial",
                "Pending",
                "Collection %",
                "Full Pay Rate",
                "Performance Reward",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">
                      Loading performance data…
                    </p>
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-16 text-center text-sm text-gray-400"
                >
                  No performance data for the selected period.
                </td>
              </tr>
            ) : (
              sorted.map((o, i) => {
                const rw = rewards[o.id] || {};
                const medal = i < 3 ? MEDALS[i] : null;
                return (
                  <tr
                    key={o.id}
                    className={`hover:bg-gray-50/60 transition-colors ${i < 3 ? "bg-yellow-50/20" : ""}`}
                  >
                    <td className="px-4 py-3 font-bold text-gray-500 text-center">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-sm">#{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">
                        {o.firstName} {o.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {o.Role?.displayName || o.Role?.name || "Officer"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">
                      {o.totalAssigned ?? 0}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {fmt(o.totalCollected)}
                    </td>
                    <td className="px-4 py-3 text-center text-green-700 font-semibold">
                      {o.fullPayments ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-amber-600 font-semibold">
                      {o.partialPayments ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 font-semibold">
                      {o.pendingCases ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${o.collectionPercentage >= 80 ? "text-green-600" : o.collectionPercentage >= 50 ? "text-amber-600" : "text-red-500"}`}
                        >
                          {(o.collectionPercentage || 0).toFixed(1)}%
                        </span>
                        <div className="flex-1 min-w-16">
                          <PctBar
                            value={o.collectionPercentage}
                            color={
                              o.collectionPercentage >= 80
                                ? "bg-green-500"
                                : o.collectionPercentage >= 50
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                            }
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold text-sm ${o.fullPaymentRate >= 60 ? "text-green-600" : o.fullPaymentRate >= 30 ? "text-amber-600" : "text-gray-500"}`}
                      >
                        {(o.fullPaymentRate || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-40">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            GHS
                          </span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={rw.amount || ""}
                            onChange={(e) =>
                              updateReward(o.id, "amount", e.target.value)
                            }
                            className="w-full pl-9 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Note (e.g. Best of Month)"
                          value={rw.note || ""}
                          onChange={(e) =>
                            updateReward(o.id, "note", e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {sorted.length > 0 && !loading && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400 px-1">
          <span>
            Period: <strong className="text-gray-600">{startDate}</strong> →{" "}
            <strong className="text-gray-600">{endDate}</strong>
          </span>
          <span>
            Total officers:{" "}
            <strong className="text-gray-600">{sorted.length}</strong>
          </span>
          <span>
            Avg collection %:{" "}
            <strong className="text-gray-600">
              {(
                sorted.reduce(
                  (sum, o) => sum + (o.collectionPercentage || 0),
                  0,
                ) / sorted.length
              ).toFixed(1)}
              %
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default Rank2;
