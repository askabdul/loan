import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiEye,
  FiSend,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiBell,
  FiUsers,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiX,
} from "react-icons/fi";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const NotificationManagement = () => {
  const { hasActionPermission } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
  });

  // Create notification form state
  const [createForm, setCreateForm] = useState({
    title: "",
    message: "",
    type: "info",
    priority: "medium",
    recipientType: "broadcast",
    specificUsers: [],
    specificAdmins: [],
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = async (
    page = 1,
    search = "",
    status = "",
    type = "",
  ) => {
    try {
      setLoading(true);
      const response = await apiService.getNotifications(
        page,
        10,
        type,
        status,
      );

      if (response.success) {
        setNotifications(response.data.notifications || []);
        setCurrentPage(response.data.pagination?.currentPage || 1);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalNotifications(
          response.data.pagination?.totalNotifications || 0,
        );
      } else {
        setError(response.message || "Failed to fetch notifications");
      }
    } catch (err) {
      setError("Error fetching notifications: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notification stats
  const fetchStats = async () => {
    try {
      const response = await apiService.getNotificationStats();
      if (response.success) {
        setStats(response.data || stats);
      }
    } catch (err) {
      console.error("Error fetching notification stats:", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications(currentPage, searchTerm, statusFilter, typeFilter);
    await fetchStats();
    setRefreshing(false);
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    fetchNotifications(1, value, statusFilter, typeFilter);
  };

  // Handle status filter
  const handleStatusFilter = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    setCurrentPage(1);
    fetchNotifications(1, searchTerm, value, typeFilter);
  };

  // Handle type filter
  const handleTypeFilter = (e) => {
    const value = e.target.value;
    setTypeFilter(value);
    setCurrentPage(1);
    fetchNotifications(1, searchTerm, statusFilter, value);
  };

  // Handle pagination
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchNotifications(newPage, searchTerm, statusFilter, typeFilter);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchNotifications(newPage, searchTerm, statusFilter, typeFilter);
    }
  };

  // Handle view details
  const handleViewDetails = (notification) => {
    setSelectedNotification(notification);
    setShowDetailModal(true);
  };

  // Handle send notification
  const handleSendNotification = async (notificationId) => {
    try {
      const response = await apiService.sendNotification(notificationId);
      if (response.success) {
        await handleRefresh();
        alert("Notification sent successfully!");
      } else {
        alert("Failed to send notification: " + response.message);
      }
    } catch (err) {
      alert("Error sending notification: " + err.message);
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (notificationId) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        const response = await apiService.deleteNotification(notificationId);
        if (response.success) {
          await handleRefresh();
          alert("Notification deleted successfully!");
        } else {
          alert("Failed to delete notification: " + response.message);
        }
      } catch (err) {
        alert("Error deleting notification: " + err.message);
      }
    }
  };

  // Close modals
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedNotification(null);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      title: "",
      message: "",
      type: "info",
      priority: "medium",
      recipientType: "broadcast",
      specificUsers: [],
      specificAdmins: [],
    });
  };

  // Handle create form changes
  const handleCreateFormChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle create notification
  const handleCreateNotification = async (e) => {
    e.preventDefault();

    if (!createForm.title.trim() || !createForm.message.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setCreateLoading(true);
    try {
      const notificationData = {
        title: createForm.title.trim(),
        message: createForm.message.trim(),
        type: createForm.type,
        priority: createForm.priority,
        recipient: {
          broadcast: createForm.recipientType === "broadcast",
          user:
            createForm.recipientType === "users"
              ? createForm.specificUsers
              : undefined,
          admin:
            createForm.recipientType === "admins"
              ? createForm.specificAdmins
              : undefined,
        },
      };

      const response = await apiService.createNotification(notificationData);
      if (response.success) {
        closeCreateModal();
        await handleRefresh();
        alert("Notification created successfully!");
      } else {
        alert("Failed to create notification: " + response.message);
      }
    } catch (err) {
      alert("Error creating notification: " + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Helper functions
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "sent":
        return "status-success";
      case "pending":
        return "status-warning";
      case "failed":
        return "status-danger";
      case "draft":
        return "status-secondary";
      default:
        return "status-secondary";
    }
  };

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case "loan":
        return "badge bg-primary";
      case "payment":
        return "badge bg-success";
      case "system":
        return "badge bg-info";
      case "marketing":
        return "badge bg-warning";
      default:
        return "badge bg-secondary";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const STATUS_BADGE = {
    sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    draft: "bg-gray-100 text-gray-500 border-gray-200",
  };

  const TYPE_BADGE = {
    loan: "bg-blue-50 text-blue-700 border-blue-200",
    payment: "bg-emerald-50 text-emerald-700 border-emerald-200",
    system: "bg-indigo-50 text-indigo-700 border-indigo-200",
    marketing: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-gray-100 text-gray-600 border-gray-200",
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading
          notifications...
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
            <FiBell size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Notification Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Create and manage platform notifications
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiRefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
        {hasActionPermission("manageNotifications") && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
          >
            <FiPlus size={14} /> Create Notification
          </button>
        )}
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: "Total", value: stats.total },
          { label: "Sent", value: stats.sent },
          { label: "Pending", value: stats.pending },
          { label: "Failed", value: stats.failed },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2 min-w-[72px]"
          >
            <span className="text-lg font-bold text-blue-600 leading-tight">
              {value}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={statusFilter}
            onChange={handleStatusFilter}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={typeFilter}
            onChange={handleTypeFilter}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="loan">Loan</option>
            <option value="payment">Payment</option>
            <option value="system">System</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        <table className="w-full text-sm" style={{ minWidth: "700px" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50">
              {[
                "Title",
                "Type",
                "Recipients",
                "Status",
                "Created",
                "Sent",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No notifications found
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr
                  key={n._id || n.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FiBell
                        size={13}
                        className="text-gray-400 mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 m-0 truncate">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 m-0 truncate">
                          {n.message?.substring(0, 50)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_BADGE[n.type] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                    >
                      {n.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <FiUsers size={11} className="text-gray-400" />{" "}
                      {n.recipientCount || "All"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[n.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(n.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {n.sentAt ? formatDate(n.sentAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewDetails(n)}
                        title="View Details"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                      >
                        <FiEye size={13} />
                      </button>
                      {(n.status === "draft" || n.status === "pending") &&
                        hasActionPermission("manageNotifications") && (
                          <button
                            onClick={() =>
                              handleSendNotification(n._id || n.id)
                            }
                            title="Send"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition"
                          >
                            <FiSend size={13} />
                          </button>
                        )}
                      {hasActionPermission("manageNotifications") && (
                        <button
                          onClick={() =>
                            handleDeleteNotification(n._id || n.id)
                          }
                          title="Delete"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages} ({totalNotifications} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal &&
        selectedNotification &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={closeDetailModal}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "520px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Notification Details
                </h3>
                <button
                  onClick={closeDetailModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { label: "Title", value: selectedNotification.title },
                  {
                    label: "Type",
                    value: selectedNotification.type,
                    badge: TYPE_BADGE[selectedNotification.type],
                  },
                  {
                    label: "Status",
                    value: selectedNotification.status,
                    badge: STATUS_BADGE[selectedNotification.status],
                  },
                  {
                    label: "Recipients",
                    value: selectedNotification.recipientCount || "All Users",
                  },
                  {
                    label: "Created",
                    value: formatDate(selectedNotification.createdAt),
                  },
                  ...(selectedNotification.sentAt
                    ? [
                        {
                          label: "Sent",
                          value: formatDate(selectedNotification.sentAt),
                        },
                      ]
                    : []),
                ].map(({ label, value, badge }) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 py-2 border-b border-gray-50"
                  >
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-24 flex-shrink-0">
                      {label}
                    </span>
                    {badge ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge}`}
                      >
                        {value}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-700">{value}</span>
                    )}
                  </div>
                ))}
                <div className="py-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Message
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">
                    {selectedNotification.message}
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Create Modal */}
      {showCreateModal &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={closeCreateModal}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "560px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Create Notification
                </h3>
                <button
                  onClick={closeCreateModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <form
                onSubmit={handleCreateNotification}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) =>
                      handleCreateFormChange("title", e.target.value)
                    }
                    placeholder="Enter notification title"
                    required
                    disabled={createLoading}
                    className={inp}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Message *
                  </label>
                  <textarea
                    value={createForm.message}
                    onChange={(e) =>
                      handleCreateFormChange("message", e.target.value)
                    }
                    placeholder="Enter notification message"
                    rows={4}
                    required
                    disabled={createLoading}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Type
                    </label>
                    <select
                      value={createForm.type}
                      onChange={(e) =>
                        handleCreateFormChange("type", e.target.value)
                      }
                      disabled={createLoading}
                      className={inp}
                    >
                      {[
                        "info",
                        "success",
                        "warning",
                        "error",
                        "loan_status",
                        "payment",
                        "system",
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Priority
                    </label>
                    <select
                      value={createForm.priority}
                      onChange={(e) =>
                        handleCreateFormChange("priority", e.target.value)
                      }
                      disabled={createLoading}
                      className={inp}
                    >
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Recipients
                  </label>
                  <select
                    value={createForm.recipientType}
                    onChange={(e) =>
                      handleCreateFormChange("recipientType", e.target.value)
                    }
                    disabled={createLoading}
                    className={inp}
                  >
                    <option value="broadcast">All Users (Broadcast)</option>
                    <option value="users">Specific Users</option>
                    <option value="admins">Specific Admins</option>
                  </select>
                </div>
                {createForm.recipientType === "users" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      User IDs (comma separated)
                    </label>
                    <textarea
                      value={createForm.specificUsers.join(", ")}
                      onChange={(e) =>
                        handleCreateFormChange(
                          "specificUsers",
                          e.target.value
                            .split(",")
                            .map((id) => id.trim())
                            .filter((id) => id),
                        )
                      }
                      disabled={createLoading}
                      rows={3}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                )}
                {createForm.recipientType === "admins" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Admin IDs (comma separated)
                    </label>
                    <textarea
                      value={createForm.specificAdmins.join(", ")}
                      onChange={(e) =>
                        handleCreateFormChange(
                          "specificAdmins",
                          e.target.value
                            .split(",")
                            .map((id) => id.trim())
                            .filter((id) => id),
                        )
                      }
                      disabled={createLoading}
                      rows={3}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    disabled={createLoading}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {createLoading ? "Creating..." : "Create Notification"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default NotificationManagement;
