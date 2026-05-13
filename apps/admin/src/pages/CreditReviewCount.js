import React, { useState, useEffect, useCallback } from "react";
import {
  FiBarChart2,
  FiRefreshCw,
  FiClock,
  FiUser,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiUsers,
} from "react-icons/fi";
import apiService from "../services/api";

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
  });

const StatCard = ({ label, value, sub, color = "blue", icon: Icon }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {label}
        </span>
        {Icon && <Icon size={18} className="opacity-60" />}
      </div>
      <p className="text-3xl font-bold m-0">{value ?? "—"}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
};

const CreditReviewCount = () => {
  const [stats, setStats] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [officerStats, setOfficerStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch loans grouped by status for credit review
      const [
        pendingRes,
        underReviewRes,
        approvedRes,
        rejectedRes,
        hangedRes,
        activeRes,
        completedRes,
        officersRes,
      ] = await Promise.allSettled([
        apiService.getLoans({ status: "pending", limit: 1 }),
        apiService.getLoans({ status: "assigned", limit: 1 }),
        apiService.getLoans({ status: "approved", limit: 1 }),
        apiService.getLoans({ status: "rejected", limit: 1 }),
        apiService.getLoans({ status: "hanged-up", limit: 1 }),
        apiService.getLoans({ status: "active-loans", limit: 1 }),
        apiService.getLoans({ status: "completed", limit: 1 }),
        apiService.getOfficersByRole("review-officer,review-lead"),
      ]);

      const count = (res) => {
        if (res.status !== "fulfilled") return 0;
        const data = res.value?.data || res.value;
        return data?.pagination?.total || 0;
      };

      setStats({
        pending: count(pendingRes),
        underReview: count(underReviewRes),
        approved: count(approvedRes),
        rejected: count(rejectedRes),
        hangedUp: count(hangedRes),
        activeLoans: count(activeRes),
        completed: count(completedRes),
      });

      if (officersRes.status === "fulfilled") {
        setOfficers(officersRes.value?.data || []);
      }
    } catch (err) {
      setError("Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Also fetch per-officer assignment counts
  const fetchOfficerStats = useCallback(async () => {
    // Fetch assigned loans to count per officer (sampled, not exact)
    try {
      const res = await apiService.getLoans({ status: "assigned", limit: 200 });
      const data = res?.data || res;
      const loans = data?.loans || [];
      const counts = {};
      loans.forEach((loan) => {
        const oid = loan.assignedOfficerId;
        if (oid) counts[oid] = (counts[oid] || 0) + 1;
      });
      setOfficerStats(counts);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchOfficerStats();
  }, [fetchAll, fetchOfficerStats]);

  const total = stats
    ? stats.pending +
      stats.underReview +
      stats.approved +
      stats.rejected +
      stats.hangedUp
    : 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <FiBarChart2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Credit Review — Count
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Live overview of all credit review cases
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchAll();
            fetchOfficerStats();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition text-gray-600 disabled:opacity-40"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
          <FiAlertCircle size={15} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">
          Loading statistics…
        </div>
      ) : (
        <>
          {/* Status breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Unassigned"
              value={stats?.pending}
              icon={FiClock}
              color="amber"
              sub="Awaiting officer assignment"
            />
            <StatCard
              label="Under Review"
              value={stats?.underReview}
              icon={FiUser}
              color="blue"
              sub="Currently being reviewed"
            />
            <StatCard
              label="Approved"
              value={stats?.approved}
              icon={FiCheckCircle}
              color="emerald"
              sub="Awaiting disbursement"
            />
            <StatCard
              label="Rejected"
              value={stats?.rejected}
              icon={FiXCircle}
              color="red"
              sub="Application declined"
            />
            <StatCard
              label="Hanged Up"
              value={stats?.hangedUp}
              icon={FiAlertCircle}
              color="gray"
              sub="On hold / escalated"
            />
            <StatCard
              label="Active Loans"
              value={stats?.activeLoans}
              icon={FiCheckCircle}
              color="indigo"
              sub="Disbursed & repaying"
            />
            <StatCard
              label="Completed"
              value={stats?.completed}
              icon={FiCheckCircle}
              color="purple"
              sub="Fully repaid"
            />
            <StatCard
              label="Total In Review"
              value={total}
              icon={FiBarChart2}
              color="blue"
              sub="Pending + Under review + Approved"
            />
          </div>

          {/* Officers workload */}
          {officers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <FiUsers size={15} className="text-blue-500" />
                <h2 className="text-sm font-bold text-gray-700 m-0">
                  Officer Workload
                </h2>
                <span className="text-xs text-gray-400 ml-auto">
                  Based on currently assigned loans
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {officers.map((officer) => {
                  const assigned = officerStats[officer.id] || 0;
                  const maxForBar = Math.max(...Object.values(officerStats), 1);
                  const pct = Math.round((assigned / maxForBar) * 100);
                  return (
                    <div
                      key={officer.id}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FiUser size={13} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {officer.name}
                          </p>
                          <span className="text-xs font-semibold text-gray-600 ml-2 flex-shrink-0">
                            {assigned} loan{assigned !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {officer.role?.displayName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {officers.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <FiUsers size={28} className="text-amber-400 mx-auto mb-2" />
              <p className="text-amber-700 font-semibold text-sm">
                No review officers onboarded yet
              </p>
              <p className="text-amber-600 text-xs mt-1">
                Go to <strong>System → Admin Management</strong> to add review
                officers.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CreditReviewCount;
