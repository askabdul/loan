import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiEye, 
  FiSend, 
  FiGlobe, 
  FiSearch, 
  FiBell, 
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import websocketService from '../services/websocket';

const NotificationCenter = () => {
  const { hasActionPermission, isSuperAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'view'
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    recipient: {
      broadcast: false,
      user: '',
      admin: '',
      role: ''
    },
    data: {},
    expiresAt: ''
  });

  useEffect(() => {
    fetchNotifications();
    fetchStats();
    
    // WebSocket listeners for real-time updates
    websocketService.on('notification_created', (data) => {
      setNotifications(prev => [data.notification, ...prev]);
      showMessage('success', 'New notification created.');
    });
    
    websocketService.on('notification_updated', (data) => {
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === data.notification._id ? data.notification : notif
        )
      );
      showMessage('info', 'Notification updated.');
    });
    
    websocketService.on('notification_deleted', (data) => {
      setNotifications(prev => prev.filter(notif => notif._id !== data.notificationId));
      showMessage('info', 'Notification deleted.');
    });
    
    return () => {
      websocketService.off('notification_created');
      websocketService.off('notification_updated');
      websocketService.off('notification_deleted');
    };
  }, []);

  const fetchNotifications = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(recipientFilter !== 'all' && { recipient: recipientFilter }),
        ...(searchTerm && { search: searchTerm })
      };
      
      const response = await apiService.getNotifications(page, 10, typeFilter, statusFilter);
      setNotifications(response.data.data);
      setTotalPages(response.data.pagination.total);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      showMessage('error', 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.getNotificationStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleCreateNew = () => {
    setModalType('create');
    setSelectedNotification(null);
    setFormData({
      title: '',
      message: '',
      type: 'info',
      priority: 'medium',
      recipient: {
        broadcast: false,
        user: '',
        admin: '',
        role: ''
      },
      data: {},
      expiresAt: ''
    });
    setShowModal(true);
  };

  const handleEdit = (notification) => {
    setModalType('edit');
    setSelectedNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      recipient: notification.recipient,
      data: notification.data || {},
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt).toISOString().slice(0, 16) : ''
    });
    setShowModal(true);
  };

  const handleView = (notification) => {
    setModalType('view');
    setSelectedNotification(notification);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const submitData = {
        ...formData,
        ...(formData.expiresAt && { expiresAt: new Date(formData.expiresAt).toISOString() })
      };
      
      if (modalType === 'create') {
        await apiService.createNotification(submitData);
        showMessage('success', 'Notification created successfully');
      } else if (modalType === 'edit') {
        await apiService.updateNotification(selectedNotification._id, submitData);
        showMessage('success', 'Notification updated successfully');
      }
      
      setShowModal(false);
      fetchNotifications(currentPage);
      fetchStats();
    } catch (error) {
      console.error('Error saving notification:', error);
      showMessage('error', 'Failed to save notification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notificationId) => {
  if (!window.confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      await apiService.deleteNotification(notificationId);
      showMessage('success', 'Notification deleted successfully');
      fetchNotifications(currentPage);
      fetchStats();
    } catch (error) {
      console.error('Error deleting notification:', error);
      showMessage('error', 'Failed to delete notification');
    }
  };

  const handleBroadcast = async () => {
  if (!window.confirm('Send broadcast notification to all users?')) return;
    
    try {
      setSaving(true);
      const broadcastData = {
        ...formData,
        recipient: { broadcast: true }
      };
      
      await apiService.broadcastNotification(broadcastData);
      showMessage('success', 'Broadcast notification sent successfully');
      setShowModal(false);
      fetchNotifications(currentPage);
      fetchStats();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      showMessage('error', 'Failed to send broadcast notification');
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success': return <FiCheckCircle className="text-green-500" />;
      case 'warning': return <FiAlertCircle className="text-yellow-500" />;
      case 'error': return <FiAlertCircle className="text-red-500" />;
      case 'info': return <FiInfo className="text-blue-500" />;
      default: return <FiBell className="text-gray-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getRecipientDisplay = (recipient) => {
    if (recipient.broadcast) return 'All Users';
    if (recipient.user) return 'Specific User';
    if (recipient.admin) return 'Specific Admin';
    if (recipient.role) return `Role: ${recipient.role}`;
    return 'Unknown';
  };

  const PRIORITY_BADGE = {
    urgent: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };
  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (loading && notifications.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading notifications...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiBell size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Notification Center</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage and send notifications to users and admins</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchNotifications(currentPage)} disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {(hasActionPermission('createNotification') || isSuperAdmin()) && (
            <button onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition">
              <FiPlus size={14} /> Create Notification
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-blue-50 text-blue-700 border-blue-200'}`}>{message.text}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[['Total', stats.typeStats.reduce((s, x) => s + x.count, 0), 'bg-blue-50 text-blue-700'],
            ['Unread', stats.readStats.find(s => s._id === false)?.count || 0, 'bg-amber-50 text-amber-700'],
            ['System', stats.typeStats.find(s => s._id === 'system')?.count || 0, 'bg-purple-50 text-purple-700']
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className={`flex flex-col items-center ${cls} rounded-xl px-4 py-2 min-w-[64px] border border-transparent`}>
              <span className="text-xl font-bold leading-tight">{val}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{lbl}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search notifications..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchNotifications(1)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        {[['typeFilter', typeFilter, setTypeFilter, [['all','All Types'],['info','Info'],['success','Success'],['warning','Warning'],['error','Error'],['system','System']]],
          ['priorityFilter', priorityFilter, setPriorityFilter, [['all','All Priorities'],['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']]],
          ['recipientFilter', recipientFilter, setRecipientFilter, [['all','All Recipients'],['broadcast','Broadcast'],['users','Users'],['admins','Admins']]]
        ].map(([key, val, setter, opts]) => (
          <select key={key} value={val} onChange={(e) => setter(e.target.value)}
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <FiBell size={32} className="text-gray-200" />
            <p className="text-sm text-gray-400">No notifications found</p>
          </div>
        ) : notifications.map(n => (
          <div key={n._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 m-0">{n.title}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_BADGE[n.priority] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>{n.priority}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">{n.type}</span>
                  </div>
                  <p className="text-xs text-gray-500 m-0 truncate">{n.message}</p>
                  <p className="text-[10px] text-gray-400 m-0 mt-1">To: {getRecipientDisplay(n.recipient)} · {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleView(n)} title="View"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"><FiEye size={12} /></button>
                {(hasActionPermission('updateNotification') || isSuperAdmin()) && (
                  <button onClick={() => handleEdit(n)} title="Edit"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"><FiEdit size={12} /></button>
                )}
                {(hasActionPermission('deleteNotification') || isSuperAdmin()) && (
                  <button onClick={() => handleDelete(n._id)} title="Delete"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"><FiTrash2 size={12} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchNotifications(currentPage - 1)} disabled={currentPage === 1}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Previous</button>
            <button onClick={() => fetchNotifications(currentPage + 1)} disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: '0 16px' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800 text-base m-0">
                {modalType === 'create' ? 'Create Notification' : modalType === 'edit' ? 'Edit Notification' : 'Notification Details'}
              </p>
              <button onClick={() => setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><FiX size={14} /></button>
            </div>
            <div className="p-6">
              {modalType === 'view' ? (
                <div className="space-y-3">
                  {[['Title', selectedNotification?.title], ['Message', selectedNotification?.message], ['Type', selectedNotification?.type], ['Priority', selectedNotification?.priority],
                    ['Recipient', getRecipientDisplay(selectedNotification?.recipient)], ['Created', new Date(selectedNotification?.createdAt).toLocaleString()],
                    ...(selectedNotification?.expiresAt ? [['Expires', new Date(selectedNotification.expiresAt).toLocaleString()]] : [])
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex items-start justify-between gap-4">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{lbl}</span>
                      <span className="text-sm text-gray-700 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Title *</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required placeholder="Enter notification title" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Message *</label>
                    <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} required rows={3} placeholder="Enter notification message" className={`${inp} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Type</label>
                      <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className={inp}>
                        {['info','success','warning','error','system'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Priority</label>
                      <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className={inp}>
                        {['low','medium','high','urgent'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={formData.recipient.broadcast} onChange={(e) => setFormData({...formData, recipient: {...formData.recipient, broadcast: e.target.checked}})} className="accent-blue-600" />
                      Broadcast to all users
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Expiry Date (Optional)</label>
                    <input type="datetime-local" value={formData.expiresAt} onChange={(e) => setFormData({...formData, expiresAt: e.target.value})} className={inp} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button type="button" onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                    {formData.recipient.broadcast && modalType === 'create' ? (
                      <button type="button" onClick={handleBroadcast} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition">
                        <FiGlobe size={13} /> {saving ? 'Sending...' : 'Send Broadcast'}
                      </button>
                    ) : (
                      <button type="submit" disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                        <FiSend size={13} /> {saving ? 'Saving...' : modalType === 'create' ? 'Create' : 'Update'}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
      <div className="page-header">
        <div className="header-content">
          <h1>Notification Center</h1>
          <p>Manage and send notifications to users and admins</p>
        </div>
        {(hasActionPermission('createNotification') || isSuperAdmin()) && (
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <FiPlus /> Create Notification
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FiBell />
            </div>
            <div className="stat-content">
              <h3>{stats.typeStats.reduce((sum, stat) => sum + stat.count, 0)}</h3>
              <p>Total Notifications</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FiAlertCircle />
            </div>
            <div className="stat-content">
              <h3>{stats.readStats.find(s => s._id === false)?.count || 0}</h3>
              <p>Unread</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FiGlobe />
            </div>
            <div className="stat-content">
              <h3>{stats.typeStats.find(s => s._id === 'system')?.count || 0}</h3>
              <p>System Notifications</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="notification-filters">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchNotifications(1)}
          />
        </div>
        
        <div className="filter-group">
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="system">System</option>
          </select>
          
          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          
          <select 
            value={recipientFilter} 
            onChange={(e) => setRecipientFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Recipients</option>
            <option value="broadcast">Broadcast</option>
            <option value="users">Users</option>
            <option value="admins">Admins</option>
          </select>
          
          <button 
            className="btn btn-secondary"
            onClick={() => fetchNotifications(1)}
          >
            <FiFilter /> Apply Filters
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <FiBell className="empty-icon" />
            <h3>No notifications found</h3>
            <p>Create your first notification to get started.</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div key={notification._id} className="notification-item">
              <div className="notification-header">
                <div className="notification-title">
                  {getTypeIcon(notification.type)}
                  <h3>{notification.title}</h3>
                  <div className="notification-badges">
                    <span className={`badge badge-${getPriorityColor(notification.priority)}`}>
                      {notification.priority}
                    </span>
                    <span className="badge badge-secondary">
                      {notification.type}
                    </span>
                  </div>
                </div>
                <div className="notification-actions">
                  <button 
                    className="btn-icon" 
                    onClick={() => handleView(notification)}
                    title="View Details"
                  >
                    <FiEye />
                  </button>
                  {(hasActionPermission('updateNotification') || isSuperAdmin()) && (
                    <button 
                      className="btn-icon" 
                      onClick={() => handleEdit(notification)}
                      title="Edit"
                    >
                      <FiEdit />
                    </button>
                  )}
                  {(hasActionPermission('deleteNotification') || isSuperAdmin()) && (
                    <button 
                      className="btn-icon btn-danger" 
                      onClick={() => handleDelete(notification._id)}
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="notification-content">
                <p>{notification.message}</p>
                <div className="notification-meta">
                  <span>To: {getRecipientDisplay(notification.recipient)}</span>
                  <span>Created: {new Date(notification.createdAt).toLocaleDateString()}</span>
                  {notification.expiresAt && (
                    <span>Expires: {new Date(notification.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="btn btn-secondary"
            disabled={currentPage === 1}
            onClick={() => fetchNotifications(currentPage - 1)}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            className="btn btn-secondary"
            disabled={currentPage === totalPages}
            onClick={() => fetchNotifications(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal notification-modal">
            <div className="modal-header">
              <h2>
                {modalType === 'create' && 'Create Notification'}
                {modalType === 'edit' && 'Edit Notification'}
                {modalType === 'view' && 'Notification Details'}
              </h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              {modalType === 'view' ? (
                <div className="notification-details">
                  <div className="detail-group">
                    <label>Title:</label>
                    <p>{selectedNotification?.title}</p>
                  </div>
                  <div className="detail-group">
                    <label>Message:</label>
                    <p>{selectedNotification?.message}</p>
                  </div>
                  <div className="detail-group">
                    <label>Type:</label>
                    <p>{selectedNotification?.type}</p>
                  </div>
                  <div className="detail-group">
                    <label>Priority:</label>
                    <p>{selectedNotification?.priority}</p>
                  </div>
                  <div className="detail-group">
                    <label>Recipient:</label>
                    <p>{getRecipientDisplay(selectedNotification?.recipient)}</p>
                  </div>
                  <div className="detail-group">
                    <label>Created:</label>
                    <p>{new Date(selectedNotification?.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedNotification?.expiresAt && (
                    <div className="detail-group">
                      <label>Expires:</label>
                      <p>{new Date(selectedNotification.expiresAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                      placeholder="Enter notification title"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Message *</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      required
                      rows={4}
                      placeholder="Enter notification message"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Recipients</label>
                    <div className="recipient-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.recipient.broadcast}
                          onChange={(e) => setFormData({
                            ...formData, 
                            recipient: {
                              ...formData.recipient,
                              broadcast: e.target.checked
                            }
                          })}
                        />
                        Broadcast to all users
                      </label>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Expiry Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
                    />
                  </div>
                  
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    {formData.recipient.broadcast && modalType === 'create' ? (
                      <button 
                        type="button" 
                        className="btn btn-warning" 
                        onClick={handleBroadcast}
                        disabled={saving}
                      >
                        <FiGlobe /> {saving ? 'Sending...' : 'Send Broadcast'}
                      </button>
                    ) : (
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        <FiSend /> {saving ? 'Saving...' : modalType === 'create' ? 'Create' : 'Update'}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;