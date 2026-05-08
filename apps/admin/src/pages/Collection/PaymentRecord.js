import React, { useState, useEffect } from 'react';
import { FiDownload, FiSearch, FiRefreshCw, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const PaymentRecord = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  // Handle row click to show loan details
  const handleRowClick = (loanId) => {
    const url = `/loan-details/${loanId}`;
    window.open(url, '_blank');
  };

  // Filter states
  const [filters, setFilters] = useState({
    phoneNumber: '',
    officer: '',
    group: '',
    team: '',
    startDate: null,
    endDate: null,
    userId: '',
    loanId: '',
    transactionId: '',
    status: 'all',
    paymentType: 'all'
  });

  const [teams, setTeams] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Fetch payments data
  const fetchPayments = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page,
        limit: pagination.limit,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === 'all' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await apiService.getPayments(params);
      setPayments(response.payments || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Failed to fetch payment records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch teams and officers
  const fetchTeamsAndOfficers = async () => {
    try {
      // Mock data for teams and officers - replace with actual API calls
      setTeams([
        { id: 'COL-T01', name: 'Collection Team 1' },
        { id: 'COL-T02', name: 'Collection Team 2' },
        { id: 'COL-T03', name: 'Collection Team 3' },
        { id: 'COL-T04', name: 'Collection Team 4' }
      ]);
      
      setOfficers([
        { id: 'officer1', name: 'Mike Johnson', team: 'COL-T01' },
        { id: 'officer2', name: 'Sarah Wilson', team: 'COL-T02' },
        { id: 'officer3', name: 'David Brown', team: 'COL-T03' },
        { id: 'officer4', name: 'Lisa Davis', team: 'COL-T04' }
      ]);
    } catch (err) {
      console.error('Error fetching teams and officers:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTeamsAndOfficers();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchPayments(1);
  };

  const handleReset = () => {
    setFilters({
      phoneNumber: '',
      officer: '',
      group: '',
      team: '',
      startDate: null,
      endDate: null,
      userId: '',
      loanId: '',
      transactionId: '',
      status: 'all',
      paymentType: 'all'
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchPayments(1);
  };

  const handlePageChange = (event, page) => {
    setPagination(prev => ({ ...prev, current: page }));
    fetchPayments(page);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'success',
      pending: 'warning',
      processing: 'info',
      failed: 'error',
      cancelled: 'default',
      refunded: 'secondary'
    };
    return colors[status] || 'default';
  };

  const exportData = () => {
    // Implementation for exporting payment records
    console.log('Exporting payment records...');
  };

  const STATUS_BADGE = { completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', pending: 'bg-amber-50 text-amber-700 border-amber-200', failed: 'bg-red-50 text-red-700 border-red-200', processing: 'bg-blue-50 text-blue-700 border-blue-200', cancelled: 'bg-gray-100 text-gray-500 border-gray-200' };
  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiCreditCard size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Collection Payment Records</h1>
            <p className="text-xs text-gray-400 mt-0.5">Total: {pagination.total} | Showing: {payments.length}</p>
          </div>
        </div>
        <button onClick={exportData}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition">
          <FiDownload size={13} /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Filters</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {[['userId','User ID','text'],['loanId','Loan ID','text'],['transactionId','Transaction ID','text'],['phoneNumber','Phone Number','text']].map(([f,l,t]) => (
            <div key={f}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{l}</label>
              <input type={t} value={filters[f]} onChange={(e) => handleFilterChange(f, e.target.value)} className={inp} />
            </div>
          ))}
          {[['status','Payment Status',[['all','All Status'],['completed','Completed'],['pending','Pending'],['processing','Processing'],['failed','Failed'],['cancelled','Cancelled']]],
            ['paymentType','Payment Type',[['all','All Types'],['full','Full Payment'],['partial','Partial Payment']]],
            ['officer','Collection Officer',[['','All Officers'],...officers.map(o => [o.id, o.name])]],
            ['team','Collection Team',[['','All Teams'],...teams.map(t => [t.id, t.name])]]
          ].map(([f, l, opts]) => (
            <div key={f}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{l}</label>
              <select value={filters[f]} onChange={(e) => handleFilterChange(f, e.target.value)} className={inp}>
                {opts.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
            <input type="date" value={filters.startDate || ''} onChange={(e) => handleFilterChange('startDate', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
            <input type="date" value={filters.endDate || ''} onChange={(e) => handleFilterChange('endDate', e.target.value)} className={inp} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSearch}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition">
            <FiSearch size={13} /> Search
          </button>
          <button onClick={handleReset}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">Reset</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading...
          </div>
        ) : (
          <table style={{ minWidth: '900px' }} className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Loan ID','User ID','Phone','Loan Level','Amount','Date','Transaction ID','Channel','Officer'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">No payment records found</td></tr>
              ) : payments.map(p => (
                <tr key={p._id} className="hover:bg-gray-50/60 transition cursor-pointer" onClick={() => handleRowClick(p.loan?.loanId)}>
                  <td className="px-4 py-3 text-xs font-semibold text-blue-600">{p.loan?.loanId || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.user?.userId || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.mobileNumber || p.user?.phoneNumber || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.user?.currentLevel || p.loan?.loanLevel || 'Level 1'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700"><span className="flex items-center gap-1"><FiDollarSign size={11} />{formatCurrency(p.amount)}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.completedAt || p.createdAt)}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.transactionId || p.paymentReference || 'N/A'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">{p.mobileMoneyProvider || 'MTN'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{officers.find(o => o.id === p.assignedOfficer)?.name || 'Collection Officer'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {pagination.current} of {pagination.pages}</span>
          <div className="flex items-center gap-2">
            <button onClick={(e) => handlePageChange(e, pagination.current - 1)} disabled={pagination.current === 1}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Previous</button>
            <button onClick={(e) => handlePageChange(e, pagination.current + 1)} disabled={pagination.current === pagination.pages}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );

};

export default PaymentRecord;
