import React, { useState, useEffect } from "react";
import {
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiCreditCard,
  FiRefreshCw,
  FiBarChart2,
  FiArrowRight,
  FiActivity,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";

const normalizeStatus = (status) => {
  if (!status) return "pending";
  if (["approved", "completed", "disbursed", "active"].includes(status))
    return "approved";
  if (["rejected", "failed", "inactive"].includes(status)) return "rejected";
  return status;
};

const buildRecentActivities = (recentActivity = {}) => {
  const loans = (recentActivity.loans || []).map((loan) => ({
    id: `loan-${loan._id}`,
    title: "Loan application submitted",
    description:
      `${loan.user?.personalInfo?.firstName || ""} ${loan.user?.personalInfo?.lastName || ""}`.trim() ||
      "Unknown user",
    status: normalizeStatus(loan.status),
    createdAt: loan.createdAt,
    icon: "loan",
  }));

  const payments = (recentActivity.payments || []).map((payment) => ({
    id: `payment-${payment._id}`,
    title: "Payment processed",
    description: `₵${Number(payment.amount || 0).toLocaleString()} repayment received`,
    status: normalizeStatus(payment.status),
    createdAt: payment.createdAt,
    icon: "payment",
  }));

  const users = (recentActivity.users || []).map((user) => ({
    id: `user-${user._id}`,
    title: "New user registration",
    description:
      `${user.personalInfo?.firstName || ""} ${user.personalInfo?.lastName || ""}`.trim() ||
      user.email ||
      "New user",
    status: "completed",
    createdAt: user.createdAt,
    icon: "user",
  }));

  return [...users, ...loans, ...payments]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
};

const ACTIVITY_STATUS_STYLES = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

const ActivityIcon = ({ type }) => {
  const base =
    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0";
  if (type === "user")
    return (
      <div className={`${base} bg-blue-50`}>
        <FiUsers size={15} className="text-blue-500" />
      </div>
    );
  if (type === "payment")
    return (
      <div className={`${base} bg-emerald-50`}>
        <FiDollarSign size={15} className="text-emerald-500" />
      </div>
    );
  return (
    <div className={`${base} bg-amber-50`}>
      <FiCreditCard size={15} className="text-amber-500" />
    </div>
  );
};

const SimpleDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDashboardOverview();
      const data = response?.data || {};
      setDashboardData(data.stats || null);
      setRecentActivities(buildRecentActivities(data.recentActivity));
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to load dashboard data. Please try again.");
      setDashboardData(null);
      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getUserName = () => {
    if (user?.personalInfo?.firstName && user?.personalInfo?.lastName)
      return `${user.personalInfo.firstName} ${user.personalInfo.lastName}`;
    return user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user?.email || "Administrator";
  };

  const statCards = [
    {
      title: "Total Users",
      value: dashboardData?.totalUsers?.toLocaleString() || "0",
      icon: FiUsers,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueCls: "text-blue-600",
    },
    {
      title: "Active Loans",
      value: dashboardData?.activeLoans?.toLocaleString() || "0",
      icon: FiCreditCard,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueCls: "text-emerald-600",
    },
    {
      title: "Total Disbursed",
      value: `₵${dashboardData?.totalDisbursed?.toLocaleString() || "0"}`,
      icon: FiDollarSign,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      valueCls: "text-amber-600",
    },
    {
      title: "Collection Rate",
      value: `${dashboardData?.repaymentRate || "0"}%`,
      icon: FiTrendingUp,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      valueCls: "text-purple-600",
    },
  ];

  const quickActions = [
    {
      label: "Detailed Analytics",
      sub: "Comprehensive charts & insights",
      icon: FiBarChart2,
      path: "/data-statistics/dashboard",
      color: "text-blue-600 bg-blue-50 hover:bg-blue-100",
    },
    {
      label: "Manage Users",
      sub: "View and manage user accounts",
      icon: FiUsers,
      path: "/user/list",
      color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
    },
    {
      label: "View Loans",
      sub: "Monitor loan applications",
      icon: FiCreditCard,
      path: "/credit-review/list",
      color: "text-amber-600 bg-amber-50 hover:bg-amber-100",
    },
    {
      label: "Payment Management",
      sub: "Handle payments and transactions",
      icon: FiDollarSign,
      path: "/fund-management/payments",
      color: "text-purple-600 bg-purple-50 hover:bg-purple-100",
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-tight">
            Welcome back, {getUserName()}!
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Here's a quick overview of your loan platform performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 transition disabled:opacity-40"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-6">
          <p className="text-sm text-red-700 m-0">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="text-sm font-semibold text-red-600 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
          >
            <div
              className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}
            >
              <s.icon size={20} className={s.iconColor} />
            </div>
            <div className="min-w-0">
              {loading ? (
                <div className="w-16 h-5 bg-gray-100 rounded animate-pulse mb-1" />
              ) : (
                <p
                  className={`text-xl font-bold leading-tight m-0 ${s.valueCls}`}
                >
                  {s.value}
                </p>
              )}
              <p className="text-xs text-gray-400 m-0 truncate">{s.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 m-0">
              Quick Actions
            </h2>
            <FiActivity size={16} className="text-gray-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((a, i) => (
              <button
                key={i}
                onClick={() => navigate(a.path)}
                className={`flex items-center gap-3 p-3 rounded-xl transition text-left ${a.color}`}
              >
                <div className="w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                  <a.icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold m-0 leading-tight">
                    {a.label}
                  </p>
                  <p className="text-[11px] opacity-70 m-0 mt-0.5 truncate">
                    {a.sub}
                  </p>
                </div>
                <FiArrowRight
                  size={14}
                  className="ml-auto flex-shrink-0 opacity-60"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 m-0">
              Recent Activity
            </h2>
            <button
              onClick={() => navigate("/data-statistics/dashboard")}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              View all <FiArrowRight size={11} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-gray-50 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <FiActivity size={18} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No recent activity yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  <ActivityIcon type={act.icon} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 m-0 leading-tight truncate">
                      {act.title}
                    </p>
                    <p className="text-xs text-gray-400 m-0 mt-0.5 truncate">
                      {act.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ACTIVITY_STATUS_STYLES[act.status] || "bg-gray-50 text-gray-500 border-gray-200"}`}
                    >
                      {act.status}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {act.createdAt
                        ? new Date(act.createdAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleDashboard;
