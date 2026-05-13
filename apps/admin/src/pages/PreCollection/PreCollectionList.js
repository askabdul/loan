/**
 * PreCollection > List — Blueprint Section 8
 * Active loan cases approaching due date — assign/manage precollection officers
 * Uses GET /api/precollection/cases (status: pending-assignment | assigned | hung-up)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiUsers,
  FiX,
  FiChevronDown,
} from "react-icons/fi";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
});

const TABS = [
  {
    key: "pending-assignment",
    label: "Pending Assignment",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    key: "assigned",
    label: "Assigned",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    key: "hung-up",
    label: "Hung Up",
    color: "text-red-600 bg-red-50 border-red-200",
  },
];

const fmt = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    n || 0,
  );

const daysToDue = (dueDate) => {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - Date.now()) / 86400000);
};

function DueBadge({ dueDate }) {
  const days = daysToDue(dueDate);
  if (days === null) return <span className="text-gray-400 text-xs">—</span>;
  const cls =
    days < 0
      ? "bg-red-100 text-red-700"
      : days === 0
        ? "bg-orange-100 text-orange-700"
        : days <= 3
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700";
  const label =
    days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? "Due today"
        : `${days}d left`;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function OfficerSelect({ officers, value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = officers.find((o) => o.id === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={sel ? "text-gray-800" : "text-gray-400"}>
          {sel ? `${sel.firstName} ${sel.lastName}` : "Select officer"}
        </span>
        <FiChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 left-[250px] z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
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

const PreCollectionList = () => {
  const [activeTab, setActiveTab] = useState("pending-assignment");
  const [loans, setLoans] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assignModal, setAssignModal] = useState(null);
  const [assignOfficer, setAssignOfficer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page,
        limit: 20,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`${API_BASE}/precollection/cases?${params}`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setLoans(data.loans || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load cases");
      }
    } catch {
      toast.error("Network error loading cases");
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  const fetchOfficers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role: "precollection-officer,precollection-lead",
        status: "active",
      });
      const res = await fetch(
        `${API_BASE}/admin-management/officers?${params}`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) setOfficers(data.data || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);
  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleAssign = async () => {
    if (!assignOfficer) return toast.error("Select an officer");
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/precollection/cases/${assignModal.loanId}/assign`,
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
      } else {
        toast.error(data.message || "Assignment failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (loanId) => {
    try {
      const res = await fetch(
        `${API_BASE}/precollection/cases/${loanId}/unassign`,
        {
          method: "PATCH",
          headers: authHeader(),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Case unassigned");
        fetchLoans();
      } else toast.error(data.message || "Failed");
    } catch {
      toast.error("Network error");
    }
  };

  const handleReserve = async (loanId) => {
    try {
      const res = await fetch(
        `${API_BASE}/precollection/cases/${loanId}/reserve`,
        {
          method: "PATCH",
          headers: authHeader(),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Case reserved — set to hung-up");
        fetchLoans();
      } else toast.error(data.message || "Failed");
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 leading-none">
            Pre-Collection Cases
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage active loans approaching due date — {total} cases
          </p>
        </div>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === tab.key ? `${tab.color} border` : "text-gray-500 hover:bg-gray-50"}`}
          >
            {tab.label}
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: 680 }}
        >
          <thead>
            <tr className="bg-gray-50 text-left border-b border-gray-100">
              {[
                "Customer",
                "Loan ID",
                "Balance",
                "Due Date",
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
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading cases…</p>
                  </div>
                </td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-16 text-center text-sm text-gray-400"
                >
                  No{" "}
                  {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}{" "}
                  cases found.
                </td>
              </tr>
            ) : (
              loans.map((loan) => {
                const officer = loan.PrecollectionOfficer;
                return (
                  <tr
                    key={loan.id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
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
                      <DueBadge dueDate={loan.dueDate} />
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
                        {activeTab === "pending-assignment" && (
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
                        {activeTab === "assigned" && (
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
                            Release
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

      {/* Assign Modal */}
      {assignModal && (
        <Modal title="Assign Officer" onClose={() => setAssignModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Select Officer
              </label>
              <OfficerSelect
                officers={officers}
                value={assignOfficer}
                onChange={setAssignOfficer}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={submitting || !assignOfficer}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition font-semibold disabled:opacity-50"
              >
                {submitting ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PreCollectionList;
