import React, { useState, useEffect } from 'react';
import { FiPhone, FiUser, FiCalendar, FiDollarSign, FiSearch, FiRefreshCw, FiLayers } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const PreCollectionAllList = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [amountFilter, setAmountFilter] = useState('');

  // Fetch all approved loans (God Mode for super-admin)
  const fetchAllApprovedLoans = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/loans?status=approved', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data.loans)) {
        setLoans(data.data.loans);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching approved loans:', error);
      setError(`Failed to load approved loans: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only super-admin can access this page
    if (user?.role?.name === 'super-admin') {
      fetchAllApprovedLoans();
    } else {
      setError('Access denied. This page is only available to super-admin users.');
      setLoading(false);
    }
  }, [user]);

  // Filter loans based on search and filter criteria
  useEffect(() => {
    let filtered = loans;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(loan => 
        loan.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.loanId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.user?.phoneNumber?.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }

    // Amount filter
    if (amountFilter) {
      const amount = parseFloat(amountFilter);
      if (!isNaN(amount)) {
        filtered = filtered.filter(loan => loan.amount >= amount);
      }
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(loan => {
        const dueDate = new Date(loan.dueDate);
        const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'due-soon':
            return daysDiff <= 3 && daysDiff >= -2;
          case 'overdue':
            return daysDiff < 0;
          case 'future':
            return daysDiff > 3;
          default:
            return true;
        }
      });
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, statusFilter, dateFilter, amountFilter]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const getDaysToDue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'active': return 'primary';
      case 'overdue': return 'error';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  const getDueDateColor = (daysToDue) => {
    if (daysToDue < 0) return 'error';
    if (daysToDue <= 2) return 'warning';
    return 'default';
  };

  const STATUS_BADGE = { approved:'bg-emerald-50 text-emerald-700 border-emerald-200', active:'bg-blue-50 text-blue-700 border-blue-200', overdue:'bg-red-50 text-red-700 border-red-200', completed:'bg-gray-100 text-gray-500 border-gray-200' };
  const inp = "px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400"><FiRefreshCw size={16} className="animate-spin" /> Loading loans...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><FiLayers size={18} className="text-blue-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">All Approved Loans (God Mode)</h1>
          <p className="text-xs text-gray-400 mt-0.5">Super-admin view of all approved loans</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, email, loan ID, or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inp}>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inp}>
            <option value="all">All Dates</option>
            <option value="due-soon">Due Soon (≤3 days)</option>
            <option value="overdue">Overdue</option>
            <option value="future">Future (&gt;3 days)</option>
          </select>
          <div className="relative">
            <FiDollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="number" placeholder="Min Amount" value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)}
              className="pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-36" />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">Showing {filteredLoans.length} of {loans.length} approved loans</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        <table style={{ minWidth: '760px' }} className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Loan ID','Client Name','Phone','Amount','Due Date','Days to Due','Status','Pre-collection Status'].map(h => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLoans.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No approved loans found matching your criteria.</td></tr>
            ) : filteredLoans.map(loan => {
              const days = getDaysToDue(loan.dueDate);
              const daysCls = days < 0 ? 'bg-red-50 text-red-700 border-red-200' : days <= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200';
              return (
                <tr key={loan._id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{loan.loanId}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700"><span className="flex items-center gap-1"><FiUser size={11} />{loan.user?.firstName} {loan.user?.lastName}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500"><span className="flex items-center gap-1"><FiPhone size={11} />{loan.user?.phoneNumber}</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">{formatCurrency(loan.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500"><span className="flex items-center gap-1"><FiCalendar size={11} />{new Date(loan.dueDate).toLocaleDateString()}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${daysCls}`}>{days} days</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[loan.status]||'bg-gray-100 text-gray-500 border-gray-200'}`}>{loan.status}</span></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">{loan.precollectionStatus||'pending-assignment'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

};

export default PreCollectionAllList;
