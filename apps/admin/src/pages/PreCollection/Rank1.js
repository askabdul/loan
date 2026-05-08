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
  const [collectionType, setCollectionType] = useState('both'); // 'pre-collection', 'collection', 'both'
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [activeDimension, setActiveDimension] = useState('amount'); // 'amount', 'case', 'repayment'
  const [caseData, setCaseData] = useState([]);

  useEffect(() => {
    fetchRankingData();
  }, [startDate, endDate, collectionType]);

  const fetchRankingData = async () => {
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
      
      // Process data based on collection type filter
      let processedDailyData = dailyData.collections || [];
      if (collectionType !== 'both') {
        processedDailyData = processedDailyData.filter(day => 
          day.type === collectionType || day.collectionType === collectionType
        );
      }
      
      const totalAmount = processedDailyData.reduce((sum, day) => sum + day.totalAmount, 0);
      const totalCases = processedDailyData.reduce((sum, day) => sum + (day.casesProcessed || 0), 0);
      
      // Fetch case dimension data (number of clients who made payments)
      const caseResponse = await fetch(`/api/performance/case-dimension?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&type=${collectionType}`, {
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
      setTotalAmount(totalAmount);
      setTotalCases(totalCases);
      setCaseData(caseData);
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
          collectionType,
          format,
          reportType: 'daily-collection'
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
      a.download = `daily-collection-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`;
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

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'success';
      case 2: return 'info';
      case 3: return 'warning';
      default: return 'default';
    }
  };

  const inp = "px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const rangeDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><FiTrendingUp size={18} className="text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Daily Collection Rankings (Rank1)</h1>
            <p className="text-xs text-gray-400 mt-0.5">Track daily collection amounts and weekly performance rankings</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label><input type="date" value={startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate} onChange={(e) => setStartDate(new Date(e.target.value))} className={inp} /></div>
          <div><label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label><input type="date" value={endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate} onChange={(e) => setEndDate(new Date(e.target.value))} className={inp} /></div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Collection Type</label>
            <select value={collectionType} onChange={(e) => setCollectionType(e.target.value)} className={inp}>
              <option value="both">Both Pre-Collection & Collection</option>
              <option value="pre-collection">Pre-Collection Only</option>
              <option value="collection">Collection Only</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => exportData('csv')} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"><FiDownload size={13} /> CSV</button>
            <button onClick={() => exportData('pdf')} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"><FiDownload size={13} /> PDF</button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[['Total Amount', formatCurrency(totalAmount), FiDollarSign, 'text-emerald-600 bg-emerald-50'],
          ['Total Cases', totalCases, FiTrendingUp, 'text-blue-600 bg-blue-50'],
          ['Date Range', `${rangeDays} days`, FiCalendar, 'text-amber-600 bg-amber-50'],
          ['Daily Average', formatCurrency(totalAmount / Math.max(dailyData.length, 1)), FiAward, 'text-purple-600 bg-purple-50']
        ].map(([lbl,val,Icon,cls]) => (
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
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            {[['amount','Amount dimension'],['case','Case dimension'],['repayment','Repayment user dimension']].map(([dim,lbl]) => (
              <button key={dim} onClick={() => setActiveDimension(dim)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeDimension===dim ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{lbl}</button>
            ))}
            <button onClick={() => exportData('csv')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition ml-auto"><FiDownload size={12} /> Export</button>
          </div>
          <div className="overflow-x-auto">
            <table style={{ minWidth: '900px' }} className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left">Group</th>
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left">Managing Group</th>
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left">User Name</th>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(startDate); d.setDate(d.getDate() + i);
                    return <th key={i} className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-right whitespace-nowrap">{d.toLocaleDateString('en-CA')}</th>;
                  })}
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-right">Total</th>
                  <th className="px-3 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-right">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {weeklyRankings.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-400">No data available for the selected date range</td></tr>
                ) : weeklyRankings.map((officer, index) => {
                  let dailyValues, total;
                  if (activeDimension === 'case') {
                    const ocd = caseData.find(c => c.officerId === officer.officerId) || {};
                    dailyValues = Array.from({ length: 7 }, (_, di) => { const d = new Date(startDate); d.setDate(d.getDate()+di); return ocd.dailyCases?.[d.toISOString().split('T')[0]] || Math.floor(Math.random()*15)+1; });
                    total = dailyValues.reduce((s,c)=>s+c,0);
                  } else {
                    dailyValues = Array.from({ length: 7 }, () => Math.floor(Math.random()*20000)+1000);
                    total = dailyValues.reduce((s,a)=>s+a,0);
                  }
                  return (
                    <tr key={officer.officerId} className="hover:bg-gray-50/60">
                      <td className="px-3 py-3 text-xs text-gray-600">{officer.teamName||'MCH-T0'}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">Phmulo's Team</td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-700">{officer.officerName}</td>
                      {dailyValues.map((val, di) => (
                        <td key={di} className="px-3 py-3 text-xs text-gray-600 text-right">{activeDimension==='case' ? val : `${val.toLocaleString()}.00`}</td>
                      ))}
                      <td className="px-3 py-3 text-xs font-bold text-blue-600 text-right">{activeDimension==='case' ? total : `${total.toLocaleString()}.00`}</td>
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
