import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import websocketService from '../services/websocket';
import { FiRefreshCw, FiBarChart2 } from 'react-icons/fi';

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);



  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2023, 2024, 2025];

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up WebSocket listeners for real-time analytics updates
    websocketService.on('analytics_update', (data) => {
      setAnalyticsData(prev => ({ ...prev, ...data }));
      setLastUpdated(new Date());
    });
    
    websocketService.on('loan_status_updated', () => {
      // Refresh analytics when loan status changes
      fetchAnalyticsData();
    });
    
    websocketService.on('user_registered', () => {
      // Refresh analytics when new user registers
      fetchAnalyticsData();
    });
    
    return () => {
      websocketService.off('analytics_update');
      websocketService.off('loan_status_updated');
      websocketService.off('user_registered');
    };
  }, [selectedPeriod, selectedMonth, selectedYear]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch loan analytics
      const loanAnalytics = await apiService.getLoanAnalytics(selectedPeriod);
      
      // Fetch user analytics
      const userAnalytics = await apiService.getUserAnalytics(selectedPeriod);
      
      // Combine analytics data
      const combinedData = {
        monthlyStats: {
          ...loanAnalytics.stats,
          ...userAnalytics.stats
        },
        loanTrends: loanAnalytics.trends || [],
        statusDistribution: loanAnalytics.statusDistribution || [],
        userLevels: userAnalytics.userLevels || [],
        paymentMethods: loanAnalytics.paymentMethods || [],
        topPerformers: userAnalytics.topPerformers || []
      };
      
      setAnalyticsData(combinedData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading Analytics Dashboard...
        </div>
      </div>
    );
  }

  const stats = analyticsData?.monthlyStats || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiBarChart2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Analytics Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Data statistics and trends'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchAnalyticsData} disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[
          ['Total Revenue', formatCurrency(stats.totalRevenue), '+12.5%', true],
          ['Total Loans', formatNumber(stats.totalLoans), '+8.3%', true],
          ['Active Users', formatNumber(stats.activeUsers), '+15.2%', true],
          ['Approval Rate', `${stats.approvalRate}%`, '+2.1%', true],
          ['Repayment Rate', `${stats.repaymentRate}%`, '-1.2%', false],
          ['Avg Loan', formatCurrency(stats.averageLoanAmount), '+5.8%', true],
        ].map(([lbl, val, change, positive]) => (
          <div key={lbl} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{lbl}</p>
            <p className="text-lg font-bold text-gray-800 m-0 truncate">{val}</p>
            <p className={`text-[10px] font-semibold m-0 mt-0.5 ${positive ? 'text-emerald-600' : 'text-red-500'}`}>{change}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Loan Trends Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Monthly Loan Trends</p>
          <div className="flex items-end gap-2 h-32">
            {(analyticsData?.loanTrends || []).map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-400">{item.loans}</span>
                <div className="w-full bg-blue-100 rounded-t-md" style={{ height: `${(item.loans / 85) * 100}%`, minHeight: '4px' }} />
                <span className="text-[9px] text-gray-400 truncate w-full text-center">{item.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Loan Status Distribution</p>
          <div className="space-y-3">
            {(analyticsData?.statusDistribution || []).map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600 capitalize">{item.status}</span>
                  <span className="text-xs text-gray-400">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {/* User Levels */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">User Level Distribution</p>
          <div className="space-y-3">
            {(analyticsData?.userLevels || []).map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Level {item.level}</span>
                  <span className="text-xs text-gray-400">{item.count} users</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Methods</p>
          <div className="space-y-3">
            {(analyticsData?.paymentMethods || []).map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">{item.method}</span>
                  <span className="text-xs text-gray-400">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Top Performers</p>
          <div className="space-y-3">
            {(analyticsData?.topPerformers || []).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 m-0 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400 m-0">{p.loans} loans · {formatCurrency(p.amount)}</p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 whitespace-nowrap">{p.repaymentRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">{months[selectedMonth]} {selectedYear} Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[['New Registrations', formatNumber(stats.newRegistrations)], ['Total Users', formatNumber(stats.totalUsers)],
            ['Loans Processed', formatNumber(stats.totalLoans)], ['Revenue Generated', formatCurrency(stats.totalRevenue)]
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{lbl}</p>
              <p className="text-base font-bold text-gray-800 m-0">{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

};

export default AnalyticsDashboard;
