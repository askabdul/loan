import React, { useState, useEffect, useCallback } from "react";
import {
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiCreditCard,
  FiRefreshCw,
  FiBarChart2,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./Dashboard.css";

const PERIOD_OPTIONS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "Last Year", value: "1y" },
];

const PIE_COLORS = [
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#e74c3c",
  "#1abc9c",
];

const escapeDateLabel = (entry) => {
  const year = entry?._id?.year;
  const month = entry?._id?.month;
  const day = entry?._id?.day;

  if (!year || !month) {
    return "N/A";
  }

  const date = new Date(year, month - 1, day || 1);
  return day
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

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
    action: "Loan created",
    createdAt: loan.createdAt,
    amount: loan.amount,
    status: normalizeStatus(loan.status),
    userName:
      `${loan.user?.personalInfo?.firstName || ""} ${loan.user?.personalInfo?.lastName || ""}`.trim() ||
      loan.user?.email ||
      "Unknown User",
  }));

  const payments = (recentActivity.payments || []).map((payment) => ({
    id: `payment-${payment._id}`,
    action: "Payment recorded",
    createdAt: payment.createdAt,
    amount: payment.amount,
    status: normalizeStatus(payment.status),
    userName:
      `${payment.user?.personalInfo?.firstName || ""} ${payment.user?.personalInfo?.lastName || ""}`.trim() ||
      "Unknown User",
  }));

  const users = (recentActivity.users || []).map((user) => ({
    id: `user-${user._id}`,
    action: "User registered",
    createdAt: user.createdAt,
    status: "completed",
    userName:
      `${user.personalInfo?.firstName || ""} ${user.personalInfo?.lastName || ""}`.trim() ||
      user.email ||
      "Unknown User",
  }));

  return [...loans, ...payments, ...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);
};

const Dashboard = () => {
  const { hasActionPermission } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [period, setPeriod] = useState("30d");
  const [recentActivities, setRecentActivities] = useState([]);
  const [chartData, setChartData] = useState({
    loanTrends: [],
    userGrowth: [],
    loanStatus: [],
    registrationCompletion: [],
    amountDistribution: [],
    levelDistribution: [],
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewResult, loanAnalyticsResult, userAnalyticsResult] =
        await Promise.allSettled([
          apiService.getDashboardOverview(),
          apiService.getLoanAnalytics(period),
          apiService.getUserAnalytics(period),
        ]);

      if (overviewResult.status !== "fulfilled") {
        throw overviewResult.reason;
      }

      const overviewPayload = overviewResult.value?.data || {};
      const stats = overviewPayload.stats || {};
      const loanAnalytics =
        loanAnalyticsResult.status === "fulfilled"
          ? loanAnalyticsResult.value?.data
          : {};
      const userAnalytics =
        userAnalyticsResult.status === "fulfilled"
          ? userAnalyticsResult.value?.data
          : {};

      setDashboardData(stats);
      setRecentActivities(
        buildRecentActivities(overviewPayload.recentActivity),
      );
      setChartData({
        loanTrends: (loanAnalytics.loanTrends || []).map((entry) => ({
          label: escapeDateLabel(entry),
          applications: entry.count || 0,
          amount: entry.totalAmount || 0,
        })),
        userGrowth: (userAnalytics.userGrowth || []).map((entry) => ({
          label: escapeDateLabel(entry),
          users: entry.count || 0,
        })),
        loanStatus: (loanAnalytics.statusDistribution || []).map(
          (entry, index) => ({
            name: entry._id || "Unknown",
            value: entry.count || 0,
            color: PIE_COLORS[index % PIE_COLORS.length],
          }),
        ),
        registrationCompletion: (
          userAnalytics.registrationCompletion || []
        ).map((entry, index) => ({
          name: entry._id ? "Completed" : "Incomplete",
          value: entry.count || 0,
          color: PIE_COLORS[index % PIE_COLORS.length],
        })),
        amountDistribution: (loanAnalytics.amountDistribution || []).map(
          (entry) => ({
            range: entry._id === "50000+" ? "50k+" : `${entry._id}`,
            count: entry.count || 0,
          }),
        ),
        levelDistribution: (userAnalytics.levelDistribution || []).map(
          (entry) => ({
            level: `Level ${entry._id || 0}`,
            users: entry.count || 0,
          }),
        ),
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to load dashboard data. Please try again.");
      console.error("Dashboard fetch error:", err);
      setDashboardData(null);
      setRecentActivities([]);
      setChartData({
        loanTrends: [],
        userGrowth: [],
        loanStatus: [],
        registrationCompletion: [],
        amountDistribution: [],
        levelDistribution: [],
      });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const stats = [
    {
      title: "Total Users",
      value: dashboardData?.totalUsers?.toLocaleString() || "0",
      change: `${dashboardData?.activeUsers || 0} active users`,
      changeType: "positive",
      icon: <FiUsers />,
      color: "#3498db",
    },
    {
      title: "Active Loans",
      value: dashboardData?.activeLoans?.toLocaleString() || "0",
      change: `${dashboardData?.pendingLoans || 0} pending`,
      changeType: "positive",
      icon: <FiDollarSign />,
      color: "#2ecc71",
    },
    {
      title: "Total Disbursed",
      value: `₵${dashboardData?.totalDisbursed?.toLocaleString() || "0"}`,
      change: `${dashboardData?.totalLoans || 0} loans total`,
      changeType: "positive",
      icon: <FiTrendingUp />,
      color: "#e74c3c",
    },
    {
      title: "Repayment Rate",
      value: `${dashboardData?.repaymentRate || 0}%`,
      change: `${dashboardData?.successfulPayments || 0} successful payments`,
      changeType: "positive",
      icon: <FiCreditCard />,
      color: "#f39c12",
    },
  ];

  const STATUS_BADGE = {
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
  };

  if (error && !dashboardData) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center max-w-sm">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiBarChart2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Data Statistics
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Analytics, trends and insights
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">
              Period:
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="py-2 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => {
          const ICON_COLORS = [
            "bg-blue-50 text-blue-600",
            "bg-emerald-50 text-emerald-600",
            "bg-red-50 text-red-600",
            "bg-amber-50 text-amber-600",
          ];
          const VALUE_COLORS = [
            "text-blue-600",
            "text-emerald-600",
            "text-red-600",
            "text-amber-600",
          ];
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${ICON_COLORS[i]}`}
              >
                {s.icon}
              </div>
              <div className="min-w-0">
                {loading ? (
                  <div className="w-16 h-5 bg-gray-100 rounded animate-pulse mb-1" />
                ) : (
                  <p
                    className={`text-xl font-bold leading-tight m-0 ${VALUE_COLORS[i]}`}
                  >
                    {s.value}
                  </p>
                )}
                <p className="text-xs text-gray-400 m-0 truncate">{s.title}</p>
                <p className="text-[11px] text-gray-400 m-0 truncate">
                  {s.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <FiBarChart2 size={16} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-800 m-0">
            Analytics &amp; Insights
          </h2>
          <span className="text-xs text-gray-400">
            Real-time data from backend
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: "Loan Trend",
              sub: "Loan applications over time",
              chart: (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData.loanTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="applications"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Applications"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "User Growth",
              sub: "Registered users over time",
              chart: (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="users"
                      fill="#8b5cf6"
                      name="Users"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Registration Completion",
              sub: "Completed vs incomplete registrations",
              chart: (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData.registrationCompletion}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {chartData.registrationCompletion.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "Loan Status Breakdown",
              sub: "Distribution of current loan statuses",
              chart: (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData.loanStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {chartData.loanStatus.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ),
            },
          ].map(({ title, sub, chart }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            >
              <p className="text-sm font-bold text-gray-800 m-0 mb-0.5">
                {title}
              </p>
              <p className="text-xs text-gray-400 m-0 mb-4">{sub}</p>
              {chart}
            </div>
          ))}
        </div>

        {/* Full-width charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {[
            {
              title: "Loan Amount Distribution",
              sub: "Applications grouped by amount bucket",
              chart: (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.amountDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="count"
                      fill="#10b981"
                      name="Applications"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
            {
              title: "User Level Distribution",
              sub: "Users grouped by current loan level",
              chart: (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.levelDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="users"
                      fill="#475569"
                      name="Users"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ),
            },
          ].map(({ title, sub, chart }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            >
              <p className="text-sm font-bold text-gray-800 m-0 mb-0.5">
                {title}
              </p>
              <p className="text-xs text-gray-400 m-0 mb-4">{sub}</p>
              {chart}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row: Recent activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-800 m-0">
              Recent Activities
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "500px" }}>
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["User", "Action", "Amount", "Status", "Date"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentActivities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-gray-400"
                    >
                      No recent activities
                    </td>
                  </tr>
                ) : (
                  recentActivities.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-700 text-xs">
                        {a.userName}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {a.action}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs font-mono">
                        {a.amount
                          ? `₵${Number(a.amount).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[normalizeStatus(a.status)] || "bg-gray-50 text-gray-500 border-gray-200"}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {a.createdAt
                          ? new Date(a.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 m-0 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              {
                label: "Add New User",
                icon: FiUsers,
                show: hasActionPermission("createUsers"),
                color: "text-blue-600 bg-blue-50 hover:bg-blue-100",
              },
              {
                label: "Process Loan",
                icon: FiDollarSign,
                show: hasActionPermission("approveLoans"),
                color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
              },
              {
                label: "View Reports",
                icon: FiTrendingUp,
                show: hasActionPermission("viewReports"),
                color: "text-amber-600 bg-amber-50 hover:bg-amber-100",
              },
              {
                label: "Manage Payments",
                icon: FiCreditCard,
                show: hasActionPermission("managePayments"),
                color: "text-purple-600 bg-purple-50 hover:bg-purple-100",
              },
            ]
              .filter((a) => a.show !== false)
              .map((a, i) => (
                <button
                  key={i}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition text-left ${a.color}`}
                >
                  <a.icon size={15} />
                  {a.label}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
