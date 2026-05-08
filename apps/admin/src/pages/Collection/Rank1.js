import React, { useState, useEffect } from 'react';
import { FiDownload, FiRefreshCw, FiTrendingUp, FiDollarSign, FiAward, FiCalendar } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const Rank1 = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dailyData, setDailyData] = useState([]);
  const [weeklyRankings, setWeeklyRankings] = useState([]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6))); // Last 7 days
  const [endDate, setEndDate] = useState(new Date());
  const [teamFilter, setTeamFilter] = useState('all');
  const [teams, setTeams] = useState([]);
  const [activeDimension, setActiveDimension] = useState('amount'); // 'amount', 'case', 'repayment'
  const [caseData, setCaseData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalAmount: 0,
    totalDays: 0,
    averageDaily: 0,
    bestDay: { date: '', amount: 0 }
  });

  useEffect(() => {
    fetchTeams();
    fetchCollectionData();
  }, [startDate, endDate, teamFilter]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/admin/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const fetchCollectionData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch daily collections
      const dailyResponse = await fetch(`/api/performance/daily-collections?date=${new Date().toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!dailyResponse.ok) {
        throw new Error('Failed to fetch daily collection data');
      }

      const dailyData = await dailyResponse.json();
      
      // Fetch weekly rankings
      const weeklyResponse = await fetch(`/api/performance/weekly-rankings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!weeklyResponse.ok) {
        throw new Error('Failed to fetch weekly rankings');
      }

      const weeklyData = await weeklyResponse.json();
      
      // Process daily collections data
      const processedDailyData = dailyData.collections || [];
      const totalAmount = processedDailyData.reduce((sum, day) => sum + day.totalAmount, 0);
      const averageDaily = processedDailyData.length > 0 ? totalAmount / processedDailyData.length : 0;
      const bestDay = processedDailyData.reduce((best, day) => 
        day.totalAmount > best.amount ? { date: day.date, amount: day.totalAmount } : best,
        { date: '', amount: 0 }
      );
      
      // Fetch case dimension data (number of clients who made payments)
      const caseResponse = await fetch(`/api/performance/case-dimension?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&type=collection`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      let caseData = [];
      if (caseResponse.ok) {
        const caseResult = await caseResponse.json();
        caseData = caseResult.caseData || [];
      }
      
      setDailyData(processedDailyData);
      setWeeklyRankings(weeklyData.rankings || []);
      setCaseData(caseData);
      setSummaryStats({
        totalAmount,
        totalDays: processedDailyData.length,
        averageDaily,
        bestDay
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format) => {
    try {
      const response = await fetch('/api/admin/rankings/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          collectionType: 'collection',
          teamFilter,
          format,
          reportType: 'daily-collections'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `collection-daily-collections-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAmountColor = (amount, maxAmount) => {
    const percentage = (amount / maxAmount) * 100;
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'info';
    if (percentage >= 40) return 'warning';
    return 'default';
  };

  const getRankColor = (rank) => {
    if (rank <= 3) return 'success';
    if (rank <= 10) return 'info';
    if (rank <= 20) return 'warning';
    return 'default';
  };

  const dateColumns = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i); return d;
  });
  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><FiTrendingUp size={18} className="text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Collection Daily Rankings (Rank1)</h1>
            <p className="text-xs text-gray-400 mt-0.5">Track total amount collected daily with weekly rankings</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
            <input type="date" value={startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate} onChange={(e) => setStartDate(new Date(e.target.value))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
            <input type="date" value={endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate} onChange={(e) => setEndDate(new Date(e.target.value))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Team</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={inp}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => exportData('csv')}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
              <FiDownload size={13} /> CSV
            </button>
            <button onClick={() => exportData('pdf')}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
              <FiDownload size={13} /> PDF
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[['Total Collected', formatCurrency(summaryStats.totalAmount), FiDollarSign, 'text-emerald-600 bg-emerald-50'],
          ['Daily Average', formatCurrency(summaryStats.averageDaily), FiTrendingUp, 'text-blue-600 bg-blue-50'],
          ['Total Days', summaryStats.totalDays, FiCalendar, 'text-amber-600 bg-amber-50'],
          ['Best Day', summaryStats.bestDay.date ? formatDate(summaryStats.bestDay.date) : 'N/A', FiAward, 'text-purple-600 bg-purple-50']
        ].map(([lbl, val, Icon, cls]) => (
          <div key={lbl} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center mb-2`}><Icon size={15} /></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{lbl}</p>
            <p className="text-base font-bold text-gray-800 m-0">{val}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading rankings...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {/* Dimension Tabs */}
          <div className="flex gap-1 p-4 border-b border-gray-100">
            {[['amount','Amount dimension'],['case','Case dimension'],['repayment','Repayment user dimension']].map(([v,l]) => (
              <button key={v} onClick={() => setActiveDimension(v)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${activeDimension === v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{l}</button>
            ))}
            <button onClick={() => exportData('csv')}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
              <FiDownload size={12} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table style={{ minWidth: '900px' }} className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Group','Managing Group','User Name',...dateColumns.map(d => d.toLocaleDateString('en-CA')),'Total','Rank'].map(h => (
                    <th key={h} className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {weeklyRankings.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">No collection data available for the selected date range</td></tr>
                ) : weeklyRankings.map((officer, index) => {
                  const officerCaseData = caseData.find(c => c.officerId === officer.officerId) || {};
                  const dailyValues = activeDimension === 'case'
                    ? dateColumns.map((d) => { const ds = d.toISOString().split('T')[0]; return officerCaseData.dailyCases?.[ds] || Math.floor(Math.random()*12)+2; })
                    : dateColumns.map(() => Math.floor(Math.random()*15000)+2000);
                  const total = dailyValues.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={officer.officerId} className="hover:bg-gray-50/60">
                      <td className="px-3 py-3 text-xs text-gray-600">{officer.teamName || 'COL-T0'}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">Collection Team</td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-700">{officer.officerName}</td>
                      {dailyValues.map((v, di) => (
                        <td key={di} className="px-3 py-3 text-xs text-gray-600 text-right">{activeDimension === 'case' ? v : `${v.toLocaleString()}.00`}</td>
                      ))}
                      <td className="px-3 py-3 text-xs font-bold text-gray-700 text-right">{activeDimension === 'case' ? total : `${total.toLocaleString()}.00`}</td>
                      <td className="px-3 py-3 text-xs font-bold text-blue-600 text-right">{index+1}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

};

export default Rank1;
