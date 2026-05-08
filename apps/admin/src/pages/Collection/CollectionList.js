import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FiPhone, FiUser, FiCalendar, FiDollarSign, FiAlertTriangle, FiSearch, FiX, FiRefreshCw, FiLayers } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import RemarkDialog from '../../components/RemarkDialog';

const CollectionList = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assignOfficer, setAssignOfficer] = useState('');
  const [officers, setOfficers] = useState([]);
  
  // Remark dialog states
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedLoanForRemark, setSelectedLoanForRemark] = useState(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overdueFilter, setOverdueFilter] = useState('all');
  const [amountFilter, setAmountFilter] = useState({ min: '', max: '' });
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  
  // Tab state - Updated with new tabs
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetchCollectionLoans();
    fetchOfficers();
  }, []);

  // Filter loans based on search criteria
  useEffect(() => {
    let filtered = [...loans];

    // Search by name, email, or loan ID
    if (searchTerm) {
      filtered = filtered.filter(loan => {
        const fullName = `${loan.userId?.firstName || ''} ${loan.userId?.lastName || ''}`.toLowerCase();
        const email = loan.userId?.email?.toLowerCase() || '';
        const loanId = loan.loanId?.toLowerCase() || '';
        const searchLower = searchTerm.toLowerCase();
        
        return fullName.includes(searchLower) || 
               email.includes(searchLower) || 
               loanId.includes(searchLower);
      });
    }

    // Filter by collection status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => 
        (loan.collectionStatus || 'pending') === statusFilter
      );
    }

    // Filter by overdue days
    if (overdueFilter !== 'all') {
      filtered = filtered.filter(loan => {
        const daysOverdue = calculateDaysOverdue(loan.dueDate);
        
        switch (overdueFilter) {
          case 'early': return daysOverdue <= 7;
          case 'critical': return daysOverdue > 7 && daysOverdue <= 30;
          case 'severe': return daysOverdue > 30;
          default: return true;
        }
      });
    }

    // Filter by assignment status
    if (assignmentFilter !== 'all') {
      if (assignmentFilter === 'assigned') {
        filtered = filtered.filter(loan => loan.collectionOfficer);
      } else if (assignmentFilter === 'unassigned') {
        filtered = filtered.filter(loan => !loan.collectionOfficer);
      }
    }

    // Filter by amount range
    if (amountFilter.min || amountFilter.max) {
      filtered = filtered.filter(loan => {
        const amount = loan.outstandingAmount || loan.loanAmount || 0;
        const min = parseFloat(amountFilter.min) || 0;
        const max = parseFloat(amountFilter.max) || Infinity;
        return amount >= min && amount <= max;
      });
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, statusFilter, overdueFilter, amountFilter, assignmentFilter]);

  const fetchOfficers = async () => {
    try {
      const response = await fetch('/api/admin/officers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOfficers(data.officers || []);
      }
    } catch (err) {
      console.error('Failed to fetch officers:', err);
    }
  };

  const fetchCollectionLoans = async (tabIndex = activeTab) => {
    try {
      setLoading(true);
      
      // Map tab index to collection status - Updated with new tabs
      const statusMap = {
        0: 'pending_assignment', // Pending Assignment
        1: 'assigned',          // Assigned
        2: 'processed',         // Processed (with remarks)
        3: 'hung_up',          // Hung Up
        4: 'completed'         // Completed
      };
      
      const collectionStatus = statusMap[tabIndex] || 'pending_assignment';
      const response = await fetch(`/api/admin/loans?status=overdue&collectionStatus=${collectionStatus}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch loans');
      }
      
      const data = await response.json();
      setLoans(data.loans || []);
      setFilteredLoans(data.loans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    fetchCollectionLoans(newValue);
  };

  const handleAction = (loan, action) => {
    if (action === 'add_remark' || action === 'contacted') {
      // Open remark dialog for processed actions
      setSelectedLoanForRemark(loan);
      setRemarkDialogOpen(true);
    } else {
      // Handle other actions with existing dialog
      setSelectedLoan(loan);
      setActionType(action);
      setDialogOpen(true);
      setRemarks('');
      setCallOutcome('');
      setNextFollowUp('');
      setAssignOfficer('');
    }
  };

  const handleSubmitAction = async () => {
    if (!selectedLoan || !actionType) return;
    
    try {
      setSubmitting(true);
      
      // Handle assignment action
      if (actionType === 'assign' && assignOfficer) {
        const assignResponse = await fetch(`/api/loans/${selectedLoan._id}/assign`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({
            officerId: assignOfficer,
            assignedBy: user._id,
            type: 'collection'
          })
        });
        
        if (!assignResponse.ok) {
          throw new Error('Failed to assign loan');
        }
      }
      
      // Add remark for processing actions
      if (remarks && (actionType === 'add_remark' || actionType === 'contacted' || actionType === 'payment_plan' || actionType === 'legal_action')) {
        const remarkResponse = await fetch(`/api/loans/${selectedLoan._id}/remarks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({
            type: 'collection',
            content: remarks,
            callOutcome,
            nextFollowUp: nextFollowUp || null,
            addedBy: user._id
          })
        });
        
        if (!remarkResponse.ok) {
          throw new Error('Failed to add remark');
        }
      }
      
      // Update collection status if needed
      if (actionType === 'contacted' || actionType === 'payment_plan' || actionType === 'legal_action' || actionType === 'hung_up') {
        const statusResponse = await fetch(`/api/loans/${selectedLoan._id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          },
          body: JSON.stringify({
            collectionStatus: actionType === 'contacted' ? 'processed' : actionType
          })
        });
        
        if (!statusResponse.ok) {
          throw new Error('Failed to update status');
        }
      }
      
      setDialogOpen(false);
      fetchCollectionLoans(); // Refresh the list
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle remark dialog submission
  const handleRemarkSubmit = async (remarkData) => {
    try {
      // Add remark
      const remarkResponse = await fetch(`/api/loans/${selectedLoanForRemark._id}/remarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          type: 'collection',
          content: remarkData.remark,
          paymentStatus: remarkData.paymentStatus,
          paymentAmount: remarkData.paymentAmount,
          addedBy: user._id
        })
      });
      
      if (!remarkResponse.ok) {
        throw new Error('Failed to add remark');
      }
      
      // Update collection status to processed
      const statusResponse = await fetch(`/api/loans/${selectedLoanForRemark._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          collectionStatus: 'processed',
          updatedBy: user._id
        })
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to update status');
      }
      
      setRemarkDialogOpen(false);
      setSelectedLoanForRemark(null);
      fetchCollectionLoans();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_assignment': return 'warning';
      case 'assigned': return 'info';
      case 'processed': return 'primary';
      case 'hung_up': return 'error';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const calculateDaysOverdue = (dueDate) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getOverdueSeverity = (days) => {
    if (days <= 7) return { color: 'warning', label: 'Early' };
    if (days <= 30) return { color: 'error', label: 'Critical' };
    return { color: 'error', label: 'Severe' };
  };

  const STATUS_BADGE = {
    pending_assignment: 'bg-amber-50 text-amber-700 border-amber-200',
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    processed: 'bg-purple-50 text-purple-700 border-purple-200',
    hung_up: 'bg-red-50 text-red-700 border-red-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };
  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const TABS = ['Pending Assignment', 'Assigned', 'Processed', 'Hung Up', 'Completed'];

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading collection loans...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiLayers size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Collection Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage overdue loans requiring collection actions</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => handleTabChange(null, i)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeTab === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, email, or loan ID..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            {['pending_assignment','assigned','processed','hung_up','completed'].map(v => (
              <option key={v} value={v}>{v.replace(/_/g,' ')}</option>
            ))}
          </select>
          <select value={overdueFilter} onChange={(e) => setOverdueFilter(e.target.value)}
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Overdue</option>
            <option value="early">Early (≤7 days)</option>
            <option value="critical">Critical (8-30 days)</option>
            <option value="severe">Severe (&gt;30 days)</option>
          </select>
          <select value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)}
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Assignment</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        <table style={{ minWidth: '800px' }} className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Loan ID','Client','Due Date','Days Overdue','Outstanding','Status','Officer','Actions'].map(h => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLoans.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No loans found for the current criteria</td></tr>
            ) : filteredLoans.map(loan => {
              const daysOverdue = calculateDaysOverdue(loan.dueDate);
              const sevCls = daysOverdue <= 7 ? 'bg-amber-50 text-amber-700 border-amber-200' : daysOverdue <= 30 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-100 text-red-800 border-red-300';
              return (
                <tr key={loan._id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{loan.loanId}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-700 m-0">{loan.userId?.firstName} {loan.userId?.lastName}</p>
                    <p className="text-[10px] text-gray-400 m-0">{loan.userId?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FiCalendar size={11} />{new Date(loan.dueDate).toLocaleDateString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sevCls}`}>
                      <FiAlertTriangle size={9} /> {daysOverdue}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                    <span className="flex items-center gap-1"><FiDollarSign size={11} />{formatCurrency(loan.outstandingAmount || loan.loanAmount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[loan.collectionStatus] || STATUS_BADGE.pending_assignment}`}>
                      {(loan.collectionStatus || 'pending').replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {loan.collectionOfficer ? (
                      <span className="flex items-center gap-1"><FiUser size={11} />{loan.collectionOfficer.firstName} {loan.collectionOfficer.lastName}</span>
                    ) : <span className="text-gray-300 italic">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {activeTab === 0 && (
                        <button onClick={() => handleAction(loan, 'assign')}
                          className="px-2.5 py-1 text-[10px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Assign</button>
                      )}
                      {activeTab === 1 && (
                        <>
                          <button onClick={() => handleAction(loan, 'contacted')}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition"><FiPhone size={10} /> Contact</button>
                          <button onClick={() => handleAction(loan, 'add_remark')}
                            className="px-2.5 py-1 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Remark</button>
                        </>
                      )}
                      {activeTab === 2 && (
                        <>
                          <button onClick={() => handleAction(loan, 'payment_plan')}
                            className="px-2.5 py-1 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Plan</button>
                          <button onClick={() => handleAction(loan, 'hung_up')}
                            className="px-2.5 py-1 text-[10px] font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition">Hung Up</button>
                        </>
                      )}
                      {activeTab === 3 && (
                        <button onClick={() => handleAction(loan, 'legal_action')}
                          className="px-2.5 py-1 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Legal</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Modal */}
      {dialogOpen && selectedLoan && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: '0 16px' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800 text-base m-0">
                {actionType === 'assign' ? 'Assign Loan to Officer' :
                 actionType === 'contacted' ? 'Record Contact Attempt' :
                 actionType === 'add_remark' ? 'Add Remark' :
                 actionType === 'payment_plan' ? 'Set Payment Plan' :
                 actionType === 'legal_action' ? 'Initiate Legal Action' : 'Mark as Hung Up'}
              </p>
              <button onClick={() => setDialogOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><FiX size={14} /></button>
            </div>
            <div className="p-6 space-y-4">
              {actionType === 'assign' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Select Officer</label>
                  <select value={assignOfficer} onChange={(e) => setAssignOfficer(e.target.value)} className={inp}>
                    <option value="">Select an officer...</option>
                    {officers.map(o => (
                      <option key={o._id} value={o._id}>{o.firstName} {o.lastName} - {o.email}</option>
                    ))}
                  </select>
                </div>
              )}
              {['contacted','add_remark','payment_plan','legal_action','hung_up'].includes(actionType) && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Remarks *</label>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={4} className={`${inp} resize-none`} />
                  </div>
                  {actionType === 'contacted' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Call Outcome</label>
                        <select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)} className={inp}>
                          <option value="">Select outcome...</option>
                          {['answered','no_answer','busy','wrong_number','promised_payment'].map(v => (
                            <option key={v} value={v}>{v.replace(/_/g,' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Next Follow-up</label>
                        <input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className={inp} />
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSubmitAction} disabled={submitting || (actionType === 'assign' && !assignOfficer) || (['contacted','add_remark','payment_plan','legal_action','hung_up'].includes(actionType) && !remarks)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                  {submitting ? <><FiRefreshCw size={13} className="animate-spin" /> Processing...</> : 'Submit'}
                </button>
                <button onClick={() => setDialogOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <RemarkDialog
        open={remarkDialogOpen}
        onClose={() => { setRemarkDialogOpen(false); setSelectedLoanForRemark(null); }}
        onSubmit={handleRemarkSubmit}
        loan={selectedLoanForRemark}
      />
    </div>
  );

};

export default CollectionList;
