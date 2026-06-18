/**
 * CollectionList.js
 * Blueprint Section 9.1 — Collection case management.
 * 5 tabs: Pending Assignment | Assigned | Processed | Hung Up | Completed
 * Features: single assign, bulk assign (equal split), redistribute from indisposed officer
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiUsers,
  FiX,
  FiChevronDown,
  FiRotateCcw,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const TABS = [
  {
    key: "pending-assignment",
    label: "Pending Assignment",
    icon: "🕐",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    key: "assigned",
    label: "Assigned",
    icon: "👤",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    key: "processed",
    label: "Processed",
    icon: "📞",
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    key: "hung-up",
    label: "Hung Up / Reserved",
    icon: "⏸️",
    color: "text-red-600 bg-red-50 border-red-200",
  },
  {
    key: "completed",
    label: "Completed",
    icon: "✅",
    color: "text-green-600 bg-green-50 border-green-200",
  },
];

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const daysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate)) / 86400000));
};

function OfficerSelect({
  officers,
  value,
  onChange,
  placeholder = "Select officer",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = officers.find((o) => o.id === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={sel ? "text-gray-800" : "text-gray-400"}>
          {sel
            ? `${sel.firstName} ${sel.lastName} (${sel.activeCases ?? 0} cases)`
            : placeholder}
        </span>
        <FiChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {officers.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">
              No officers available
            </p>
          ) : (
            officers.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${value === o.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700"}`}
              >
                {o.firstName} {o.lastName}
                <span className="ml-2 text-xs text-gray-400">
                  {o.activeCases ?? 0} active ·{" "}
                  {o.Role?.displayName || o.Role?.name || ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OfficerMultiSelect({ officers, selected, onChange }) {
  const toggle = (id) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  return (
    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
      {officers.length === 0 && (
        <p className="px-3 py-3 text-sm text-gray-400">No officers available</p>
      )}
      {officers.map((o) => (
        <label
          key={o.id}
          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
            className="accent-blue-600"
          />
          <span className="text-sm text-gray-800 flex-1">
            {o.firstName} {o.lastName}
          </span>
          <span className="text-xs text-gray-400">
            {o.activeCases ?? 0} cases
          </span>
        </label>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 left-0 md:left-64 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-[92vw] ${wide ? "md:w-[72vw] lg:w-[62vw] max-w-2xl" : "md:w-[60vw] lg:w-[50vw] max-w-xl"} flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function OverdueBadge({ days }) {
  const cls =
    days === 0
      ? "bg-gray-100 text-gray-500"
      : days <= 7
        ? "bg-amber-100 text-amber-700"
        : days <= 30
          ? "bg-orange-100 text-orange-700"
          : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {days}d overdue
    </span>
  );
}

const CollectionList = () => {
  const { user, isSuperAdmin } = useAuth();
  const roleName = user?.role?.name || user?.Role?.name;
  const isCollectionOfficer = roleName === "collection-officer";
  const isLeadRole = ["super-admin", "admin", "local-manager", "collection-lead"].includes(roleName) || isSuperAdmin();

  // Officers default to their assigned cases; leads see the full assignment queue
  const [activeTab, setActiveTab] = useState(
    isCollectionOfficer ? "assigned" : "pending-assignment",
  );
  const [loans, setLoans] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(""); // raw input — no debounce
  const [search, setSearch] = useState(""); // debounced value used for API
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [redistributeModal, setRedistributeModal] = useState(false);
  const [assignOfficer, setAssignOfficer] = useState("");
  const [bulkOfficers, setBulkOfficers] = useState([]);
  const [bulkMode, setBulkMode] = useState("equal");
  const [fromOfficer, setFromOfficer] = useState("");
  const [toOfficers, setToOfficers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Debounce search input — wait 400ms after typing stops before fetching
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page,
        limit: 20,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`${API_BASE}/collection/cases?${params}`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setLoans(data.loans || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error("Failed to load collection cases");
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  const fetchOfficers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/collection/officers`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) setOfficers(data.officers || []);
    } catch {
      /* silent */
    }
  }, []);

  // Fetch officers once on mount
  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  // Fetch loans whenever tab, page, or debounced search changes
  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const allSelected = loans.length > 0 && selectedIds.length === loans.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : loans.map((l) => l.id));
  const toggleOne = (id) =>
    setSelectedIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const handleAssign = async () => {
    if (!assignOfficer) return toast.error("Select an officer");
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/collection/cases/${assignModal.loanId}/assign`,
        {
          method: "PATCH",
          headers: authHeader(),
          body: JSON.stringify({ officerId: assignOfficer }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Case assigned successfully");
        setAssignModal(null);
        setAssignOfficer("");
        fetchLoans();
        fetchOfficers();
      } else toast.error(data.message || "Assignment failed");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (loanId) => {
    try {
      const res = await fetch(
        `${API_BASE}/collection/cases/${loanId}/unassign`,
        { method: "PATCH", headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Case unassigned");
        fetchLoans();
        fetchOfficers();
      } else toast.error(data.message || "Failed");
    } catch {
      toast.error("Network error");
    }
  };

  const handleReserve = async (loanId) => {
    try {
      const res = await fetch(
        `${API_BASE}/collection/cases/${loanId}/reserve`,
        { method: "PATCH", headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Case reserved — 10-day hold applied");
        fetchLoans();
      } else toast.error(data.message || "Failed");
    } catch {
      toast.error("Network error");
    }
  };

  const handleBulkAssign = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : loans.map((l) => l.id);
    if (!bulkOfficers.length) return toast.error("Select at least one officer");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/collection/bulk-assign`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          loanIds: ids,
          officerIds: bulkOfficers,
          mode: bulkMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setBulkModal(false);
        setBulkOfficers([]);
        fetchLoans();
        fetchOfficers();
      } else toast.error(data.message || "Bulk assign failed");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedistribute = async () => {
    if (!fromOfficer) return toast.error("Select the officer to relieve");
    if (!toOfficers.length) return toast.error("Select target officers");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/collection/redistribute`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          fromOfficerId: fromOfficer,
          toOfficerIds: toOfficers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setRedistributeModal(false);
        setFromOfficer("");
        setToOfficers([]);
        fetchLoans();
        fetchOfficers();
      } else toast.error(data.message || "Redistribute failed");
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 leading-none">
            Collection Cases
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage overdue loan recovery — {total} total cases
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              fetchLoans();
              fetchOfficers();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
          <button
            onClick={() => setRedistributeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-50 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-100 transition"
          >
            <FiRotateCcw size={14} /> Redistribute Cases
          </button>
          <button
            onClick={() => setBulkModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
          >
            <FiUsers size={14} /> Bulk Assign
            {selectedIds.length > 0 && (
              <span className="ml-1 bg-white text-blue-700 rounded-full px-1.5 text-xs font-bold">
                {selectedIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs — officers only see their own work queues; leads see full queue */}
      <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {TABS
          .filter((tab) =>
            isCollectionOfficer
              ? ["assigned", "processed", "hung-up", "completed"].includes(tab.key)
              : true
          )
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === tab.key ? `${tab.color} border` : "text-gray-500 hover:bg-gray-50"}`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <FiSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={14}
        />
        <input
          type="text"
          placeholder="Search name, phone, loan ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <span className="font-semibold">{selectedIds.length} selected</span>
          <button
            onClick={() => setSelectedIds([])}
            className="ml-auto text-xs text-blue-500 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: 720 }}
        >
          <thead>
            <tr className="bg-gray-50 text-left border-b border-gray-100">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-blue-600"
                />
              </th>
              {[
                "Customer",
                "Loan ID",
                "Outstanding",
                "Days Overdue",
                "Officer",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading cases…</p>
                  </div>
                </td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <p className="text-sm text-gray-400 mb-1">
                    No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} cases found.
                  </p>
                  {isCollectionOfficer && activeTab === "assigned" && (
                    <p className="text-xs text-gray-300">
                      Your collection lead will assign overdue cases to you. Check back soon.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              loans.map((loan) => {
                const od = daysOverdue(loan.extendedDueDate || loan.dueDate);
                const officer = loan.CollectionOfficer;
                return (
                  <tr
                    key={loan.id}
                    className={`hover:bg-gray-50/60 transition-colors ${selectedIds.includes(loan.id) ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(loan.id)}
                        onChange={() => toggleOne(loan.id)}
                        className="accent-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">
                        {loan.User?.firstName} {loan.User?.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {loan.User?.phoneNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {loan.loanId?.slice(-10) || loan.id?.slice(-8)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {fmt(loan.remainingBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <OverdueBadge days={od} />
                    </td>
                    <td className="px-4 py-3">
                      {officer ? (
                        <span className="text-sm text-gray-700">
                          {officer.firstName} {officer.lastName}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {activeTab === "pending-assignment" && isLeadRole && (
                          <button
                            onClick={() => {
                              setAssignModal({ loanId: loan.id });
                              setAssignOfficer("");
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Assign
                          </button>
                        )}
                        {(activeTab === "assigned" ||
                          activeTab === "processed") && isLeadRole && (
                          <>
                            <button
                              onClick={() => {
                                setAssignModal({ loanId: loan.id });
                                setAssignOfficer(officer?.id || "");
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                            >
                              Reassign
                            </button>
                            <button
                              onClick={() => handleUnassign(loan.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                            >
                              Unassign
                            </button>
                            <button
                              onClick={() => handleReserve(loan.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                            >
                              Reserve
                            </button>
                          </>
                        )}
                        {activeTab === "hung-up" && (
                          <button
                            onClick={() => handleUnassign(loan.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                          >
                            Release Hold
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} · {total} total
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loans.length < 20}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Single Assign Modal ── */}
      {assignModal && (
        <Modal
          title="Assign Collection Officer"
          onClose={() => setAssignModal(null)}
        >
          <p className="text-sm text-gray-500 mb-4">
            Select an officer to handle this collection case.
          </p>
          <OfficerSelect
            officers={officers}
            value={assignOfficer}
            onChange={setAssignOfficer}
          />
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleAssign}
              disabled={submitting || !assignOfficer}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
            >
              {submitting ? "Assigning…" : "Confirm Assignment"}
            </button>
            <button
              onClick={() => setAssignModal(null)}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* ── Bulk Assign Modal ── */}
      {bulkModal && (
        <Modal
          title="Bulk Assign Cases"
          onClose={() => setBulkModal(false)}
          wide
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
              <strong>
                {selectedIds.length > 0 ? selectedIds.length : loans.length}
              </strong>{" "}
              cases will be distributed.
              {selectedIds.length === 0 &&
                " (No selection — all visible cases will be assigned.)"}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Distribution Mode
              </label>
              <div className="flex gap-2">
                {[
                  { v: "equal", label: "Equal Split", desc: "Round-robin" },
                  {
                    v: "weighted",
                    label: "Load Weighted",
                    desc: "Officers with fewer cases get more",
                  },
                ].map(({ v, label, desc }) => (
                  <button
                    key={v}
                    onClick={() => setBulkMode(v)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold border transition ${bulkMode === v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"}`}
                  >
                    {label}
                    <p
                      className={`font-normal mt-0.5 ${bulkMode === v ? "text-blue-100" : "text-gray-400"}`}
                    >
                      {desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Select Officers ({bulkOfficers.length} selected)
              </label>
              <OfficerMultiSelect
                officers={officers}
                selected={bulkOfficers}
                onChange={setBulkOfficers}
              />
            </div>
            {bulkOfficers.length > 0 && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                Each officer receives ~
                {Math.ceil(
                  (selectedIds.length || loans.length) / bulkOfficers.length,
                )}{" "}
                case(s)
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleBulkAssign}
                disabled={submitting || !bulkOfficers.length}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {submitting ? "Distributing…" : "Distribute Cases"}
              </button>
              <button
                onClick={() => setBulkModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Redistribute Modal ── */}
      {redistributeModal && (
        <Modal
          title="Redistribute Officer's Cases"
          onClose={() => setRedistributeModal(false)}
          wide
        >
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
              Relieve an incapacitated officer — all their active cases will be
              distributed equally to selected officers.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Officer to relieve (take cases FROM)
              </label>
              <OfficerSelect
                officers={officers}
                value={fromOfficer}
                onChange={(id) => {
                  setFromOfficer(id);
                  setToOfficers([]);
                }}
                placeholder="Select officer to relieve…"
              />
            </div>
            {fromOfficer && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                <strong>
                  {officers.find((o) => o.id === fromOfficer)?.firstName}{" "}
                  {officers.find((o) => o.id === fromOfficer)?.lastName}
                </strong>{" "}
                has{" "}
                <strong>
                  {officers.find((o) => o.id === fromOfficer)?.activeCases ?? 0}
                </strong>{" "}
                active cases to redistribute.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Distribute cases TO ({toOfficers.length} selected)
              </label>
              <OfficerMultiSelect
                officers={officers.filter((o) => o.id !== fromOfficer)}
                selected={toOfficers}
                onChange={setToOfficers}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRedistribute}
                disabled={submitting || !fromOfficer || !toOfficers.length}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {submitting ? "Redistributing…" : "Redistribute Now"}
              </button>
              <button
                onClick={() => setRedistributeModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CollectionList;
