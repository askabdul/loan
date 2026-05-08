import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  FiSearch,
  FiFilter,
  FiEdit3,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiTrendingUp,
  FiEdit,
  FiSave,
  FiX,
  FiArrowUp,
  FiArrowDown,
  FiRefreshCw,
} from "react-icons/fi";
import apiService from "../services/api";
import "./UserLevelAssignment.css";

const UserLevelAssignment = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [loanLevels, setLoanLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [newLevel, setNewLevel] = useState("");
  const [bulkAction, setBulkAction] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const usersPerPage = 10;

  useEffect(() => {
    fetchUsers();
    fetchLoanLevels();
    initializeWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [currentPage, searchTerm, selectedLevel]);

  const initializeWebSocket = () => {
    try {
      socketRef.current = io(
        process.env.REACT_APP_SOCKET_URL || "http://localhost:8001",
        {
          transports: ["websocket"],
          upgrade: true,
        },
      );

      socketRef.current.on("connect", () => {
        setIsConnected(true);
      });

      socketRef.current.on("disconnect", () => {
        setIsConnected(false);
      });

      socketRef.current.on("userLevelUpdated", (data) => {
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user._id === data.userId
              ? { ...user, currentLevel: data.newLevel }
              : user,
          ),
        );
        setSuccess(
          `User level updated: ${data.userName} is now ${data.newLevel?.name || "No Level"}`,
        );
        setTimeout(() => setSuccess(""), 3000);
      });

      socketRef.current.on("bulkLevelUpdate", (data) => {
        fetchUsers(); // Refresh the entire list for bulk updates
        setSuccess(`Bulk update completed: ${data.updatedCount} users updated`);
        setTimeout(() => setSuccess(""), 3000);
      });

      socketRef.current.on("error", (error) => {
        console.error("WebSocket error:", error);
        setError("Real-time connection error");
        setTimeout(() => setError(""), 5000);
      });
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsersWithLevels({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        level: selectedLevel,
      });

      if (response.success) {
        // Handle the correct API response structure
        setUsers(response.data.users || []);
        setTotalPages(response.data.pagination?.total || 1);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanLevels = async () => {
    try {
      const response = await apiService.getAllLevels();
      if (response.success || response.status === "success") {
        // Handle different API response structures
        setLoanLevels(response.data?.levels || response.data || []);
      }
    } catch (error) {
      console.error("Error fetching loan levels:", error);
    }
  };

  const handleLevelChange = async (userId, levelId) => {
    try {
      setLoading(true);
      const response = await apiService.updateUserLevel(userId, levelId);

      if (response.success) {
        setSuccess("User level updated successfully");
        setEditingUser(null);
        fetchUsers(); // Refresh the list
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to update user level");
      }
    } catch (error) {
      console.error("Error updating user level:", error);
      setError("Failed to update user level");
    } finally {
      setLoading(false);
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleBulkLevelChange = async () => {
    if (!bulkAction || selectedUsers.length === 0) {
      setError("Please select users and a level");
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.bulkUpdateUserLevels(
        selectedUsers,
        bulkAction,
      );

      if (response.success) {
        setSuccess(`Successfully updated ${selectedUsers.length} users`);
        setSelectedUsers([]);
        setBulkAction("");
        fetchUsers();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to update users");
      }
    } catch (error) {
      console.error("Error bulk updating users:", error);
      setError("Failed to update users");
    } finally {
      setLoading(false);
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((user) => user._id));
    }
  };

  const getLevelName = (levelId) => {
    const level = loanLevels.find((l) => l._id === levelId);
    return level ? `${level.name} (Level ${level.levelNumber})` : "No Level";
  };

  const getLevelColor = (levelNumber) => {
    const colors = {
      1: "#28a745", // Green
      2: "#17a2b8", // Cyan
      3: "#ffc107", // Yellow
      4: "#fd7e14", // Orange
      5: "#dc3545", // Red
    };
    return colors[levelNumber] || "#6c757d";
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm),
  );

  return (
    <div className="user-level-assignment">
      <div className="assignment-header">
        <div className="header-left">
          <FiUsers className="header-icon" />
          <h2>User Level Assignment</h2>
          <div
            className={`connection-status ${isConnected ? "connected" : "disconnected"}`}
          >
            <div className="status-indicator"></div>
            <span>{isConnected ? "Live Updates" : "Offline"}</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={onClose}>
          <FiX /> Close
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {success && <div className="alert alert-success">{success}</div>}

      {/* Search and Filter Controls */}
      <div className="assignment-controls">
        <div className="search-section">
          <div className="search-input">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search users by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-select">
            <FiFilter className="filter-icon" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="">All Levels</option>
              {loanLevels.map((level) => (
                <option key={level._id} value={level._id}>
                  {level.name} (Level {level.levelNumber})
                </option>
              ))}
              <option value="no-level">No Level Assigned</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {selectedUsers.length} user{selectedUsers.length !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
            >
              <option value="">Select Level</option>
              {loanLevels.map((level) => (
                <option key={level._id} value={level._id}>
                  {level.name} (Level {level.levelNumber})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={handleBulkLevelChange}
              disabled={loading || !bulkAction}
            >
              {loading ? <FiRefreshCw className="spinning" /> : <FiSave />}
              Update Selected
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    selectedUsers.length === users.length && users.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th>User</th>
              <th>Contact</th>
              <th>Current Level</th>
              <th>Loan History</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center">
                  <FiRefreshCw className="spinning" /> Loading users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => handleUserSelection(user._id)}
                    />
                  </td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-id">ID: {user._id.slice(-8)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="contact-info">
                      <div>{user.email}</div>
                      <div>{user.phone}</div>
                    </div>
                  </td>
                  <td>
                    {editingUser === user._id ? (
                      <div className="level-edit">
                        <select
                          value={newLevel}
                          onChange={(e) => setNewLevel(e.target.value)}
                          className="level-select"
                        >
                          <option value="">No Level</option>
                          {loanLevels.map((level) => (
                            <option key={level._id} value={level._id}>
                              {level.name} (Level {level.level})
                            </option>
                          ))}
                        </select>
                        <div className="edit-actions">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() =>
                              handleLevelChange(user._id, newLevel)
                            }
                            disabled={loading}
                          >
                            <FiSave />
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setEditingUser(null);
                              setNewLevel("");
                            }}
                          >
                            <FiX />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="current-level">
                        {user.currentLevel ? (
                          <span
                            className="level-badge"
                            style={{
                              backgroundColor: getLevelColor(
                                user.currentLevel.level,
                              ),
                              color: "white",
                            }}
                          >
                            {user.currentLevel.name} (Level{" "}
                            {user.currentLevel.level})
                          </span>
                        ) : (
                          <span className="no-level">No Level</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="loan-stats">
                      <div>Completed: {user.totalLoansCompleted || 0}</div>
                      <div>Amount Repaid: ${user.totalAmountRepaid || 0}</div>
                    </div>
                  </td>
                  <td>
                    <div className="user-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setEditingUser(user._id);
                          setNewLevel(user.currentLoanLevel?._id || "");
                        }}
                        disabled={loading}
                      >
                        <FiEdit /> Edit Level
                      </button>
                      {user.currentLoanLevel &&
                        user.currentLoanLevel.levelNumber > 1 && (
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => {
                              const lowerLevel = loanLevels.find(
                                (l) =>
                                  l.levelNumber ===
                                  user.currentLoanLevel.levelNumber - 1,
                              );
                              if (lowerLevel) {
                                handleLevelChange(user._id, lowerLevel._id);
                              }
                            }}
                            disabled={loading}
                            title="Downgrade Level"
                          >
                            <FiArrowDown />
                          </button>
                        )}
                      {user.currentLoanLevel &&
                        user.currentLoanLevel.levelNumber < 5 && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => {
                              const higherLevel = loanLevels.find(
                                (l) =>
                                  l.levelNumber ===
                                  user.currentLoanLevel.levelNumber + 1,
                              );
                              if (higherLevel) {
                                handleLevelChange(user._id, higherLevel._id);
                              }
                            }}
                            disabled={loading}
                            title="Upgrade Level"
                          >
                            <FiArrowUp />
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
        <div className="pagination">
          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default UserLevelAssignment;
