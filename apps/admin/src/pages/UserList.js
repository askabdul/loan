import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiEye,
  FiLock,
  FiUnlock,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";
import UserDetailModal from "../components/UserDetailModal/UserDetailModal";

const UserList = () => {
  const { hasActionPermission, hasDataAccess } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState("all");
  const [blockingUser, setBlockingUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterStatus]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== "") {
        setCurrentPage(1);
        fetchUsers(1, searchTerm);
      } else {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchUsers = async (page = currentPage, search = searchTerm) => {
    setLoading(true);
    try {
      const response = await apiService.getUsers({
        page,
        limit: usersPerPage,
        search,
        status: filterStatus !== "all" ? filterStatus : undefined,
      });

      if (response.success && response.data) {
        const formattedUsers = response.data.users.map(formatUserData);
        setUsers(formattedUsers);
        setPagination({
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 1,
        });
      } else {
        setUsers([]);
        setPagination({ total: 0, pages: 1 });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
      setPagination({ total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  const formatUserData = (user) => {
    return {
      id: user.id,
      userId: user.userId, // 6-digit display ID
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "N/A",
      phone: user.phoneNumber || "N/A",
      phoneNumber: user.phoneNumber || "N/A",
      status: user.isActive ? "active" : "inactive",
      isActive: user.isActive,
      registrationDate: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString()
        : "N/A",
      totalLoans: user.totalLoansCompleted || 0,
      activeLoans: user.activeLoans || 0,
      currentLevel: user.currentLoanLevel || 1,
      kycComplete: user.kycComplete || false,
      registrationComplete: user.registrationComplete || false,
      idVerified: user.idVerified || false,
      idNumber: user.idNumber || null,
      idType: user.idType || null,
      employmentStatus: user.employmentStatus || null,
      // Pass through all original fields for the DetailModal
      ...user,
    };
  };

  // Server-side filtering and pagination
  const totalPages = pagination.pages || 1;
  const currentUsers = users; // Users are already filtered and paginated by the server

  const handleViewUser = async (userId) => {
    try {
      const response = await apiService.getUserById(userId);
      if (response.success && response.data) {
        // Pass the full response.data (user + loans + payments + summary)
        setSelectedUser(response.data);
        setShowDetailModal(true);
      } else {
        console.error("Failed to fetch user details:", response.message);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };


  const exportUsers = () => {
    // Export users to CSV
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Name,Email,Phone,Status,Registration Date,Total Loans,Active Loans,Credit Score\n" +
      users
        .map(
          (user) =>
            `${user.name},${user.email},${user.phone},${user.status},${user.registrationDate},${user.totalLoans},${user.activeLoans},${user.creditScore}`,
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedUser(null);
  };

  const handleBlockUser = async (userId, isCurrentlyActive) => {
    try {
      setBlockingUser(userId);
      // Toggle: if currently active → deactivate; if inactive → activate
      const response = await apiService.updateUserStatus(
        userId,
        !isCurrentlyActive,
      );
      if (response.success) {
        await fetchUsers();
      } else {
        console.error("Failed to update user status");
      }
    } catch (error) {
      console.error("Error updating user status:", error);
    } finally {
      setBlockingUser(null);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiUsers size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              List of Users
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Registered platform users
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
        <button
          onClick={exportUsers}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 font-medium hover:bg-gray-50 transition"
        >
          <FiDownload size={14} /> Export CSV
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
            placeholder="Search by Name, Email, or Phone..."
            value={searchTerm}
            onChange={handleSearchChange}
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
            onChange={handleStatusFilterChange}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Registration Complete</option>
            <option value="incomplete">Registration Incomplete</option>
          </select>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: "Total Users", value: pagination.total || 0 },
          { label: "This Page", value: users.length },
          { label: "Pages", value: pagination.pages || 1 },
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
            <table className="w-full text-sm" style={{ minWidth: "860px" }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    User ID
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    Full Name
                  </th>
                  {hasDataAccess("users", "phone") && (
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                      Phone
                    </th>
                  )}
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    Reg. Date
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    KYC
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    Level
                  </th>
                  {hasDataAccess("users", "loanHistory") && (
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                      Loans Done
                    </th>
                  )}
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-center whitespace-nowrap">
                    Operations
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  currentUsers.map((user) => (
                    <tr
                      key={user.id || user.userId}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      {/* User ID — 6-digit display ID */}
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-blue-700">
                        {user.userId || "—"}
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {user.name}
                      </td>

                      {/* Phone (role-gated) */}
                      {hasDataAccess("users", "phone") && (
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">
                          {user.phone || "—"}
                        </td>
                      )}

                      {/* Registration Date */}
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {user.registrationDate}
                      </td>

                      {/* KYC Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            user.kycComplete
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {user.kycComplete ? "✓ Complete" : "Pending"}
                        </span>
                      </td>

                      {/* Loan Level */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          Lvl {user.currentLevel}
                        </span>
                      </td>

                      {/* Completed Loans (role-gated) */}
                      {hasDataAccess("users", "loanHistory") && (
                        <td className="px-4 py-3 text-xs text-center text-gray-700 font-semibold">
                          {user.totalLoans}
                        </td>
                      )}

                      {/* Account Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Operations */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasActionPermission("viewUsers") && (
                            <button
                              onClick={() => handleViewUser(user.id)}
                              title="View full profile & loan history"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                            >
                              <FiEye size={13} /> View
                            </button>
                          )}
                          {hasActionPermission("editUsers") && (
                            <button
                              onClick={() =>
                                handleBlockUser(user.id, user.isActive)
                              }
                              disabled={blockingUser === user.id}
                              title={
                                user.isActive
                                  ? "Deactivate this account"
                                  : "Activate this account"
                              }
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-transparent transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                user.isActive
                                  ? "text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
                                  : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100"
                              }`}
                            >
                              {blockingUser === user.id ? (
                                <FiRefreshCw
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : user.isActive ? (
                                <>
                                  <FiLock size={12} /> Block
                                </>
                              ) : (
                                <>
                                  <FiUnlock size={12} /> Unblock
                                </>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages} ({pagination.total} total
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
                  disabled={currentPage === totalPages || loading}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <UserDetailModal
        isOpen={showDetailModal}
        onClose={closeDetailModal}
        data={selectedUser}
        onStatusChange={() => {
          closeDetailModal();
          fetchUsers();
        }}
      />
    </div>
  );
};

export default UserList;
