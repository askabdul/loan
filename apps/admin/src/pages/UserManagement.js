import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import {
  FiSearch,
  FiFilter,
  FiEdit,
  FiKey,
  FiUserX,
  FiUserCheck,
  FiEye,
  FiRefreshCw,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";

const UserManagement = () => {
  const { hasActionPermission, hasDataAccess } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, filterStatus, filterLevel]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsersList({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
        status: filterStatus || undefined,
        level: filterLevel || undefined,
      });
      // getUsersList normalises to { users, pagination }
      setUsers(response.users || []);
      setPagination(
        response.pagination || { total: 0, pages: 1, currentPage: 1, limit: 10 },
      );
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterStatus = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterLevel = (e) => {
    setFilterLevel(e.target.value);
    setCurrentPage(1);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phoneNumber: user.phoneNumber || "",
      email: user.email || "",
      currentLoanLevel: user.currentLoanLevel || 1,
    });
    setShowEditModal(true);
  };

  const handleResetPin = (user) => {
    setSelectedUser(user);
    setNewPin("");
    setShowResetPinModal(true);
  };

  const handleToggleStatus = (user) => {
    if (user.isActive) {
      // Deactivating — require confirmation first
      setUserToDeactivate(user);
      setShowDeactivateConfirm(true);
    } else {
      // Reactivating — no confirmation needed
      applyToggleStatus(user, true);
    }
  };

  const applyToggleStatus = async (user, newStatus) => {
    try {
      await apiService.updateUserStatus(user.id, newStatus);
      toast.success(`User ${newStatus ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updateData = {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        email: editFormData.email,
        phoneNumber: editFormData.phoneNumber,
      };

      await apiService.updateUserInfo(selectedUser.id, updateData);

      // Update loan level separately if it changed
      if (editFormData.currentLoanLevel !== selectedUser.currentLoanLevel) {
        await apiService.adminSetUserLevel(selectedUser.id, editFormData.currentLoanLevel);
      }

      toast.success("User information updated successfully");
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user information");
    }
  };

  const handleSaveResetPin = async () => {
    try {
      if (!newPin || newPin.length !== 4) {
        toast.error("PIN must be 4 digits");
        return;
      }

      await apiService.resetUserPin(selectedUser.id, { newPin });
      toast.success("PIN reset successfully");
      setShowResetPinModal(false);
      setNewPin("");
    } catch (error) {
      console.error("Error resetting PIN:", error);
      toast.error("Failed to reset PIN");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pagination.pages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiUsers size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            User Management
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Edit info, reset PINs, and control access
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          title="Refresh"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
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
            placeholder="Search by user ID, name, phone, or email..."
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
            value={filterStatus}
            onChange={handleFilterStatus}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={filterLevel}
            onChange={handleFilterLevel}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Levels</option>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: "Total Users", value: pagination.total || 0 },
          { label: "Active", value: users.filter((u) => u.isActive).length },
          { label: "This Page", value: users.length },
          { label: "Total Pages", value: pagination.pages || 1 },
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
          users...
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
            <table className="w-full text-sm" style={{ minWidth: "640px" }}>
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "20%" }} />
                {hasDataAccess("users", "phone") && (
                  <col style={{ width: "14%" }} />
                )}
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50">
                  {[
                    "User ID",
                    "Full Name",
                    ...(hasDataAccess("users", "phone") ? ["Phone"] : []),
                    "Reg. Date",
                    "Level",
                    "Status",
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
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-700">
                        {user.userId || user.id?.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {user.firstName || user.lastName
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                          : "N/A"}
                      </td>
                      {hasDataAccess("users", "phone") && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.phoneNumber || "N/A"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Level {user.currentLoanLevel || 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {hasActionPermission("editUsers") && (
                            <button
                              onClick={() => handleEditUser(user)}
                              title="Edit User"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                            >
                              <FiEdit size={13} />
                            </button>
                          )}
                          {hasActionPermission("resetPin") && (
                            <button
                              onClick={() => handleResetPin(user)}
                              title="Reset PIN"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition"
                            >
                              <FiKey size={13} />
                            </button>
                          )}
                          {hasActionPermission("toggleUserStatus") && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              title={
                                user.isActive
                                  ? "Disable Account"
                                  : "Enable Account"
                              }
                              className={`w-7 h-7 flex items-center justify-center rounded-lg border border-transparent transition ${user.isActive ? "text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100"}`}
                            >
                              {user.isActive ? (
                                <FiUserX size={13} />
                              ) : (
                                <FiUserCheck size={13} />
                              )}
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {pagination.pages} ({pagination.total} total
              users)
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
                disabled={currentPage >= pagination.pages || loading}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit User Modal */}
      {showEditModal &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 250,
              right: 0,
              bottom: 0,
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={() => setShowEditModal(false)}
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
                  Edit User Information
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: "First Name", field: "firstName", type: "text" },
                  { label: "Last Name", field: "lastName", type: "text" },
                  { label: "Phone", field: "phoneNumber", type: "text" },
                  { label: "Email", field: "email", type: "email" },
                ].map(({ label, field, type }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type={type}
                      value={editFormData[field] || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          [field]: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Loan Level
                  </label>
                  <select
                    value={editFormData.currentLoanLevel || 1}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        currentLoanLevel: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>
                        Level {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateConfirm &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 250,
              right: 0,
              bottom: 0,
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={() => setShowDeactivateConfirm(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "420px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Disable Account
                </h3>
                <button
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-1">
                  Are you sure you want to disable the account for{" "}
                  <strong className="text-gray-900">
                    {userToDeactivate?.firstName
                      ? `${userToDeactivate.firstName} ${userToDeactivate.lastName || ""}`.trim()
                      : "this user"}
                  </strong>
                  ?
                </p>
                <p className="text-xs text-red-500 mt-2 m-0">
                  The user will not be able to log in until the account is re-enabled.
                </p>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <button
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeactivateConfirm(false);
                    applyToggleStatus(userToDeactivate, false);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition"
                >
                  Disable Account
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Reset PIN Modal */}
      {showResetPinModal &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 250,
              right: 0,
              bottom: 0,
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={() => setShowResetPinModal(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "400px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Reset User PIN
                </h3>
                <button
                  onClick={() => setShowResetPinModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4 m-0">
                  Reset PIN for:{" "}
                  <strong className="text-gray-800">
                    {selectedUser?.firstName
                      ? `${selectedUser.firstName} ${selectedUser.lastName || ""}`.trim()
                      : "User"}
                  </strong>
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    New PIN (4 digits)
                  </label>
                  <input
                    type="password"
                    maxLength="4"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Enter 4-digit PIN"
                    className="w-full px-4 py-2.5 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white tracking-widest text-center"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <button
                  onClick={() => setShowResetPinModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveResetPin}
                  disabled={newPin.length !== 4}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Reset PIN
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default UserManagement;
