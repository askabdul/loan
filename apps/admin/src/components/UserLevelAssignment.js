/**
 * UserLevelAssignment.js — Blueprint Section 5 (Users > Level Assignment)
 * Admin can view and manually change a user's loan level.
 * Uses Tailwind CSS, no legacy CSS dependency.
 * Field names match PostgreSQL / Sequelize (id, not _id; level, not levelNumber).
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch, FiFilter, FiEdit3, FiSave, FiX, FiArrowUp, FiArrowDown,
  FiRefreshCw, FiUsers, FiCheck,
} from "react-icons/fi";
import { toast } from "react-toastify";
import apiService from "../services/api";

const LEVEL_COLORS = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-red-100 text-red-800 border-red-200",
];

const levelColor = (lvl) => LEVEL_COLORS[(parseInt(lvl) - 1) % LEVEL_COLORS.length] || "bg-gray-100 text-gray-600 border-gray-200";
const userIdOf = (user) => user?._id || user?.id;
const levelIdOf = (level) => level?.id || level?._id;
const levelNumOf = (level) => {
  const number = Number(level?.level);
  return Number.isFinite(number) ? number : null;
};

const UserLevelAssignment = ({ onClose }) => {
  const [users, setUsers]           = useState([]);
  const [loanLevels, setLoanLevels] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [editLevel, setEditLevel]   = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLevel, setBulkLevel]   = useState("");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getUsersWithLevels({
        page,
        limit: 10,
        search: searchTerm,
        level: selectedLevel || undefined,
      });
      if (res.success) {
        setUsers(res.data.users || []);
        const pageCount =
          Number(res.data.pagination?.pages) ||
          Number(res.data.pagination?.totalPages) ||
          Number(res.data.pagination?.total) ||
          1;
        setTotalPages(pageCount);
        setTotalCount(res.data.pagination?.count || 0);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedLevel]);

  const fetchLevels = useCallback(async () => {
    try {
      const res = await apiService.getAllLevels();
      if (res.success || res.status === "success") {
        setLoanLevels(res.data?.levels || res.data || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchUsers(); fetchLevels(); }, [fetchUsers, fetchLevels]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const handleSaveEdit = async () => {
    if (!editLevel) { toast.error("Select a level"); return; }
    if (!editingUserId) { toast.error("No user selected"); return; }
    setLoading(true);
    try {
      const res = await apiService.updateUserLevel(editingUserId, editLevel);
      if (res.success) {
        toast.success("Level updated");
        setEditingUserId(null);
        setEditLevel("");
        fetchUsers();
      } else {
        toast.error(res.message || "Failed to update");
      }
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  const handleQuickLevel = async (userId, levelId) => {
    if (!userId || !levelId) {
      toast.error("Unable to update level. Please use Edit to select a valid level.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.updateUserLevel(userId, levelId);
      if (res.success) { toast.success("Level updated"); fetchUsers(); }
      else toast.error(res.message || "Failed");
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  const handleBulkUpdate = async () => {
    if (!bulkLevel || !selectedIds.length) {
      toast.error("Select users and a level");
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.bulkUpdateUserLevels(selectedIds, bulkLevel);
      if (res.success) {
        toast.success(`${selectedIds.length} users updated`);
        setSelectedIds([]); setBulkLevel(""); fetchUsers();
      } else toast.error(res.message || "Failed");
    } catch { toast.error("Network error"); }
    finally { setLoading(false); }
  };

  const allSelected = users.length > 0 && selectedIds.length === users.length;
  const toggleAll   = () => setSelectedIds(allSelected ? [] : users.map((u) => userIdOf(u)).filter(Boolean));
  const toggleOne   = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const inp = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const maxConfiguredLevel = Math.max(
    ...loanLevels.map((l) => levelNumOf(l)).filter(Number.isFinite),
    0,
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiUsers size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Level Assignment</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manually set or adjust user loan levels · {totalCount} users
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {onClose && (
            <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition">
              <FiX size={13} /> Close
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="relative min-w-[200px]">
          <FiFilter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Levels</option>
            {loanLevels.map((l) => (
              <option key={l.id} value={l.level}>{l.name} (Level {l.level})</option>
            ))}
            <option value="0">No Level Assigned</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-700">{selectedIds.length} selected</span>
          <select
            value={bulkLevel}
            onChange={(e) => setBulkLevel(e.target.value)}
            className="text-sm border border-blue-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select new level…</option>
            {loanLevels.map((l) => (
              <option key={l.id} value={l.id}>{l.name} (Level {l.level})</option>
            ))}
          </select>
          <button
            onClick={handleBulkUpdate}
            disabled={!bulkLevel || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 transition"
          >
            <FiSave size={13} /> Apply to Selected
          </button>
          <button onClick={() => setSelectedIds([])} className="ml-auto text-xs text-blue-500 hover:underline">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 760 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3.5 w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-blue-600" />
              </th>
              {["User", "Contact", "Current Level", "Loan History", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading users…</p>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">No users found.</td>
              </tr>
            ) : (
              users.map((user) => {
                const userId = userIdOf(user);
                const lvl = user.currentLevel;
                const lvlNum =
                  Number(lvl?.level) ||
                  Number(user.currentLoanLevel) ||
                  Number(user.loanLevel) ||
                  0;
                const isEditing = editingUserId === userId;
                return (
                  <tr key={userId} className={`hover:bg-gray-50/60 transition-colors ${selectedIds.includes(userId) ? "bg-blue-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(userId)} onChange={() => toggleOne(userId)} className="accent-blue-600" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{user.name || "—"}</p>
                      <p className="text-xs text-gray-400 font-mono">{userId?.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{user.email || "—"}</p>
                      <p className="text-xs text-gray-400">{user.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editLevel}
                            onChange={(e) => setEditLevel(e.target.value)}
                            className="text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            autoFocus
                          >
                            <option value="">No Level</option>
                            {loanLevels.map((l) => (
                              <option key={l.id} value={l.id}>{l.name} (Level {l.level})</option>
                            ))}
                          </select>
                          <button
                            onClick={handleSaveEdit}
                            disabled={loading}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
                          >
                            <FiCheck size={13} />
                          </button>
                          <button
                            onClick={() => { setEditingUserId(null); setEditLevel(""); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                          >
                            <FiX size={13} />
                          </button>
                        </div>
                      ) : lvl ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${levelColor(lvlNum)}`}>
                          {lvl.name} · Lvl {lvlNum}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No Level</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>Completed: <span className="font-semibold text-gray-800">{user.totalLoansCompleted || 0}</span></p>
                        <p>Repaid: <span className="font-semibold text-gray-800">GHS {(user.totalAmountRepaid || 0).toLocaleString()}</span></p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingUserId(userId);
                              const fallbackLevel = loanLevels.find(
                                (l) => levelNumOf(l) === lvlNum,
                              );
                              setEditLevel(levelIdOf(lvl) || levelIdOf(fallbackLevel) || "");
                            }}
                            disabled={loading}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                          >
                            <FiEdit3 size={11} /> Edit
                          </button>
                          {lvlNum > 1 && (
                            <button
                              onClick={() => {
                                const lower = loanLevels.find(
                                  (l) => levelNumOf(l) === lvlNum - 1,
                                );
                                if (!lower) {
                                  toast.error("Lower level not available");
                                  return;
                                }
                                handleQuickLevel(userId, levelIdOf(lower));
                              }}
                              disabled={loading}
                              title="Downgrade Level"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition disabled:opacity-50"
                            >
                              <FiArrowDown size={12} />
                            </button>
                          )}
                          {lvlNum > 0 && lvlNum < maxConfiguredLevel && (
                            <button
                              onClick={() => {
                                const higher = loanLevels.find(
                                  (l) => levelNumOf(l) === lvlNum + 1,
                                );
                                if (!higher) {
                                  toast.error("Higher level not available");
                                  return;
                                }
                                handleQuickLevel(userId, levelIdOf(higher));
                              }}
                              disabled={loading}
                              title="Upgrade Level"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition disabled:opacity-50"
                            >
                              <FiArrowUp size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default UserLevelAssignment;
