import React, { useState, useEffect } from 'react';
import { FiSearch, FiUpload, FiCalendar, FiRefreshCw, FiUser, FiCreditCard } from 'react-icons/fi';

const LoanExtension = () => {
  const [searchData, setSearchData] = useState({
    userId: '',
    loanId: ''
  });
  const [loanDetails, setLoanDetails] = useState(null);
  const [extensionData, setExtensionData] = useState({
    extensionDays: '',
    popFile: null
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [extensionFee, setExtensionFee] = useState(0);
  const [recentExtensions, setRecentExtensions] = useState([]);
  const [extensionHistory, setExtensionHistory] = useState([]);

  // Check admin permissions
  const hasPermission = () => {
    const adminData = JSON.parse(localStorage.getItem('adminUser') || '{}');
    // Check for super-admin role (God mode)
    if (adminData.role && adminData.role.name === 'super-admin') {
      return true;
    }
    // Check for manage_loans permission
    return adminData.permissions && adminData.permissions.includes('manage_loans');
  };

  useEffect(() => {
    fetchRecentExtensions();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const fetchRecentExtensions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/loan-extension/admin/recent`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentExtensions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching recent extensions:', error);
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExtensionChange = (e) => {
    const { name, value } = e.target;
    setExtensionData(prev => ({
      ...prev,
      [name]: value
    }));

    // Calculate extension fee when days change
    if (name === 'extensionDays' && value && loanDetails) {
      calculateExtensionFee(value);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        showAlert('error', 'Please upload only JPEG, PNG, or PDF files');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showAlert('error', 'File size must be less than 5MB');
        return;
      }

      setExtensionData(prev => ({
        ...prev,
        popFile: file
      }));
    }
  };

  const searchLoan = async () => {
    if (!searchData.userId || !searchData.loanId) {
      showAlert('error', 'Please enter both User ID and Loan ID');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/loan-extension/search?userId=${searchData.userId}&loanId=${searchData.loanId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setLoanDetails(data.loan);
        setExtensionHistory(data.extensionHistory || []);
        showAlert('success', 'Loan found successfully');
      } else {
        showAlert('error', data.message || 'Loan not found');
        setLoanDetails(null);
        setExtensionHistory([]);
      }
    } catch (error) {
      showAlert('error', 'Error searching for loan');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateExtensionFee = async (days) => {
    if (!loanDetails || !days) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/loan-extension/calculate-fee`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            loanId: loanDetails.loanId,
            extensionDays: parseInt(days)
          })
        }
      );

      const data = await response.json();
      if (response.ok) {
        setExtensionFee(data.extensionFee);
      }
    } catch (error) {
      console.error('Error calculating extension fee:', error);
    }
  };

  const submitExtension = async () => {
    if (!loanDetails) {
      showAlert('error', 'Please search for a loan first');
      return;
    }

    if (!extensionData.extensionDays || extensionData.extensionDays < 1 || extensionData.extensionDays > 30) {
      showAlert('error', 'Extension days must be between 1 and 30');
      return;
    }

    if (!extensionData.popFile) {
      showAlert('error', 'Please upload proof of payment');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('adminToken');
      const formData = new FormData();
      formData.append('userId', searchData.userId);
      formData.append('loanId', searchData.loanId);
      formData.append('extensionDays', extensionData.extensionDays);
      formData.append('popFile', extensionData.popFile);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/loan-extension/admin-extend`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (response.ok) {
        showAlert('success', 'Loan extended successfully');
        // Reset form
        setExtensionData({ extensionDays: '', popFile: null });
        setExtensionFee(0);
        // Refresh loan details
        searchLoan();
        fetchRecentExtensions();
      } else {
        showAlert('error', data.message || 'Failed to extend loan');
      }
    } catch (error) {
      showAlert('error', 'Error extending loan');
      console.error('Extension error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `GH₵ ${parseFloat(amount).toFixed(2)}`;
  };

  if (!hasPermission()) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center max-w-md">
          <p className="text-lg font-bold text-gray-700 mb-1">Access Denied</p>
          <p className="text-sm text-gray-400">You don't have permission to access loan extension functionality.</p>
        </div>
      </div>
    );
  }

  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiCalendar size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Loan Extension</h1>
          <p className="text-xs text-gray-400 mt-0.5">Extend loan terms for customers with proper documentation</p>
        </div>
      </div>

      {alert.show && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border ${
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {alert.message}
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Search Loan</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">User ID</label>
            <div className="relative">
              <FiUser size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" name="userId" value={searchData.userId} onChange={handleSearchChange} placeholder="Enter User ID" className={`${inp} pl-9`} />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Loan ID</label>
            <div className="relative">
              <FiCreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" name="loanId" value={searchData.loanId} onChange={handleSearchChange} placeholder="Enter Loan ID" className={`${inp} pl-9`} />
            </div>
          </div>
          <button onClick={searchLoan} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap">
            <FiSearch size={13} /> {loading ? 'Searching...' : 'Search Loan'}
          </button>
        </div>
      </div>

      {loanDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Loan Details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Loan Details</p>
            <div className="space-y-2.5">
              {[
                ['Loan ID', loanDetails.loanId],
                ['Amount', formatCurrency(loanDetails.amount)],
                ['Status', loanDetails.status],
                ['Due Date', formatDate(loanDetails.dueDate)],
                ['Extended Due Date', loanDetails.extendedDueDate ? formatDate(loanDetails.extendedDueDate) : 'Not Extended'],
                ['Extension Count', loanDetails.extensionCount || 0]
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{lbl}</span>
                  <span className="text-sm font-semibold text-gray-700">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extension Form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Extend Loan</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Extension Days (1-30)</label>
                  <input type="number" name="extensionDays" value={extensionData.extensionDays} onChange={handleExtensionChange} min="1" max="30" placeholder="Days" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Extension Fee</label>
                  <input type="text" value={formatCurrency(extensionFee)} readOnly className={`${inp} bg-gray-50 text-gray-500`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Proof of Payment (POP)</label>
                <label htmlFor="popFileExt" className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 bg-gray-50 text-gray-500 hover:text-blue-600 transition">
                  <FiUpload size={13} />
                  {extensionData.popFile ? extensionData.popFile.name : 'Choose file (JPG, PNG, PDF)'}
                </label>
                <input type="file" id="popFileExt" onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
              </div>
              <button onClick={submitExtension} disabled={submitting}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition w-full justify-center">
                <FiCalendar size={13} /> {submitting ? 'Extending...' : 'Extend Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extension History */}
      {extensionHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest m-0">Extension History</p>
          </div>
          <table style={{ minWidth: '600px' }} className="w-full">
            <thead className="bg-gray-50">
              <tr>{['Date','Days Extended','Fee','Extended By','Status'].map(h => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {extensionHistory.map((ext, i) => (
                <tr key={i} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ext.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-semibold">{ext.extensionDays}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-semibold">{formatCurrency(ext.extensionFee)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ext.extendedBy}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">{ext.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Extensions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto w-full">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest m-0">Recent Extensions</p>
        </div>
        {recentExtensions.length > 0 ? (
          <table style={{ minWidth: '700px' }} className="w-full">
            <thead className="bg-gray-50">
              <tr>{['Date','User ID','Loan ID','Days','Fee','Extended By','Status'].map(h => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentExtensions.map(ext => (
                <tr key={ext._id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ext.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ext.userId}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ext.loanId}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-semibold">{ext.extensionDays}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-semibold">{formatCurrency(ext.extensionFee)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{ext.extendedBy}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">{ext.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">No recent extensions found</div>
        )}
      </div>
    </div>
  );

};

export default LoanExtension;
