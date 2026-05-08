import React, { useState, useEffect } from "react";
import {
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
  FiTarget,
  FiAward,
  FiUser,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";

const Rank2 = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [officerData, setOfficerData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 6)),
  ); // Last 7 days
  const [endDate, setEndDate] = useState(new Date());
  const [collectionType, setCollectionType] = useState("both"); // 'pre-collection', 'collection', 'both'
  const [teamFilter, setTeamFilter] = useState("all");
  const [rankingMetric, setRankingMetric] = useState("amount_collected"); // 'amount_collected', 'collection_percentage', 'full_payment_percentage'
  const [teams, setTeams] = useState([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    fetchTeams();
    fetchOfficerPerformance();
  }, [startDate, endDate, collectionType, teamFilter, rankingMetric]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [officerData, teamFilter, sortBy, sortOrder]);

  const fetchTeams = async () => {
    try {
      const response = await fetch("/api/admin/teams", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
  };

  const fetchOfficerPerformance = async () => {
    try {
      setLoading(true);
      setError("");

      const typeParam =
        collectionType === "both" ? "" : `&type=${collectionType}`;
      const response = await fetch(
        `/api/performance/rankings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${typeParam}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch officer performance data");
      }

      const data = await response.json();

      // Transform the rankings data to match the expected format
      const transformedData = (data.rankings || []).map((officer, index) => ({
        ...officer,
        rank: index + 1,
        officerName: officer.officerName || officer.name || "Unknown Officer",
        teamName: officer.teamName || officer.team || "No Team",
        casesAssigned: officer.casesAssigned || officer.totalCases || 0,
        casesProcessed: officer.casesProcessed || officer.processedCases || 0,
        totalAmountAssigned:
          officer.totalAmountAssigned || officer.assignedAmount || 0,
        totalAmountCollected:
          officer.totalAmountCollected || officer.collectedAmount || 0,
        collectionPercentage:
          officer.collectionPercentage || officer.performanceScore || 0,
        fullPaymentPercentage:
          officer.fullPaymentPercentage || officer.fullPaymentRate || 0,
      }));

      setOfficerData(transformedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...officerData];

    // Filter by team
    if (teamFilter !== "all") {
      filtered = filtered.filter((officer) => officer.teamId === teamFilter);
    }

    // Sort data
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "officerName":
          aValue = a.officerName.toLowerCase();
          bValue = b.officerName.toLowerCase();
          break;
        case "teamName":
          aValue = a.teamName.toLowerCase();
          bValue = b.teamName.toLowerCase();
          break;
        case "casesAssigned":
          aValue = a.casesAssigned;
          bValue = b.casesAssigned;
          break;
        case "casesProcessed":
          aValue = a.casesProcessed;
          bValue = b.casesProcessed;
          break;
        case "totalAmountAssigned":
          aValue = a.totalAmountAssigned;
          bValue = b.totalAmountAssigned;
          break;
        case "totalAmountCollected":
          aValue = a.totalAmountCollected;
          bValue = b.totalAmountCollected;
          break;
        case "collectionPercentage":
          aValue = a.collectionPercentage;
          bValue = b.collectionPercentage;
          break;
        case "fullPayments":
          aValue = a.fullPayments;
          bValue = b.fullPayments;
          break;
        case "fullPaymentPercentage":
          aValue = a.fullPaymentPercentage;
          bValue = b.fullPaymentPercentage;
          break;
        case "rank":
        default:
          aValue = a.rank;
          bValue = b.rank;
          break;
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredData(filtered);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const exportData = async (format) => {
    try {
      const response = await fetch("/api/admin/rankings/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          collectionType,
          teamFilter,
          rankingMetric,
          format,
          reportType: "officer-performance",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `officer-performance-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getRankColor = (rank) => {
    if (rank <= 3) return "success";
    if (rank <= 10) return "info";
    if (rank <= 20) return "warning";
    return "default";
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 80) return "success";
    if (percentage >= 60) return "info";
    if (percentage >= 40) return "warning";
    return "error";
  };

  const inp =
    "px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const avgColl =
    filteredData.length > 0
      ? filteredData.reduce((s, o) => s + o.collectionPercentage, 0) /
        filteredData.length
      : 0;
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const paginatedData = filteredData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiTrendingUp size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Officer Performance Rankings (Rank2)
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Detailed daily performance metrics for officers
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Start Date
            </label>
            <input
              type="date"
              value={
                startDate instanceof Date
                  ? startDate.toISOString().split("T")[0]
                  : startDate
              }
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              End Date
            </label>
            <input
              type="date"
              value={
                endDate instanceof Date
                  ? endDate.toISOString().split("T")[0]
                  : endDate
              }
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Collection Type
            </label>
            <select
              value={collectionType}
              onChange={(e) => setCollectionType(e.target.value)}
              className={inp}
            >
              <option value="both">Both</option>
              <option value="pre-collection">Pre-Collection</option>
              <option value="collection">Collection</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className={inp}
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Ranking Metric
            </label>
            <select
              value={rankingMetric}
              onChange={(e) => setRankingMetric(e.target.value)}
              className={inp}
            >
              <option value="amount_collected">Amount Collected</option>
              <option value="collection_percentage">Collection %</option>
              <option value="full_payment_percentage">Full Payment %</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => exportData("csv")}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              <FiDownload size={13} /> CSV
            </button>
            <button
              onClick={() => exportData("pdf")}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              <FiDownload size={13} /> PDF
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          [
            "Total Officers",
            filteredData.length,
            FiUser,
            "text-emerald-600 bg-emerald-50",
          ],
          [
            "Avg Collection %",
            formatPercentage(avgColl),
            FiTarget,
            "text-blue-600 bg-blue-50",
          ],
          [
            "Total Cases",
            filteredData.reduce((s, o) => s + o.casesAssigned, 0),
            FiTrendingUp,
            "text-amber-600 bg-amber-50",
          ],
          [
            "Top Performer",
            filteredData[0]?.officerName || "N/A",
            FiAward,
            "text-purple-600 bg-purple-50",
          ],
        ].map(([lbl, val, Icon, cls]) => (
          <div
            key={lbl}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div
              className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center mb-2`}
            >
              <Icon size={15} />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              {lbl}
            </p>
            <p className="text-base font-bold text-gray-800 m-0 truncate">
              {val}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
          rankings...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            <button
              onClick={() => exportData("csv")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition ml-auto"
            >
              <FiDownload size={12} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table style={{ minWidth: "900px" }} className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Group",
                    "Managing Group",
                    "User Name",
                    "Cases Assigned",
                    "Cases Processed",
                    "Amount Assigned",
                    "Amount Processed",
                    "Processing %",
                    "Full Payments",
                    "Rank",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No pre-collection performance data available for the
                      selected criteria
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((o) => {
                    const perfCls =
                      o.collectionPercentage >= 80
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : o.collectionPercentage >= 60
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : o.collectionPercentage >= 40
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200";
                    return (
                      <tr key={o.officerId} className="hover:bg-gray-50/60">
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {o.teamName || "MCH-T0"}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          Phmulo's Team
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-gray-700">
                          {o.officerName}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 text-right">
                          {o.casesAssigned}
                        </td>
                        <td className="px-3 py-3 text-xs text-blue-600 font-semibold text-right">
                          {o.casesProcessed}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 text-right">
                          {formatCurrency(o.totalAmountAssigned)}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-blue-600 text-right">
                          {formatCurrency(o.totalAmountCollected)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${perfCls}`}
                          >
                            {formatPercentage(o.collectionPercentage)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 text-right">
                          {o.fullPayments}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-blue-600 text-right">
                          {o.rank}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Rank2;
