import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  FiPhone,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiSearch,
  FiX,
  FiClock,
  FiRefreshCw,
  FiLayers,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import RemarkDialog from "../../components/RemarkDialog";

const PreCollectionList = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignOfficer, setAssignOfficer] = useState("");
  const [officers, setOfficers] = useState([]);

  // Remark dialog states
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedLoanForRemark, setSelectedLoanForRemark] = useState(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState({ min: "", max: "" });
  const [showExtendedCases, setShowExtendedCases] = useState(false);

  // Tab state - 0: Pending Assignment, 1: Assigned, 2: Processed, 3: Hung Up, 4: Completed
  const [activeTab, setActiveTab] = useState(0);

  const tabLabels = [
    "Pending Assignment",
    "Assigned",
    "Processed",
    "Hung Up",
    "Completed",
  ];

  useEffect(() => {
    fetchPreCollectionLoans();
    fetchOfficers();
  }, [activeTab]);

  // Filter loans based on search criteria
  useEffect(() => {
    let filtered = [...loans];

    // Search by name, email, or loan ID
    if (searchTerm) {
      filtered = filtered.filter((loan) => {
        const fullName =
          `${loan.userId?.firstName || ""} ${loan.userId?.lastName || ""}`.toLowerCase();
        const email = loan.userId?.email?.toLowerCase() || "";
        const loanId = loan.loanId?.toLowerCase() || "";
        const searchLower = searchTerm.toLowerCase();

        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          loanId.includes(searchLower)
        );
      });
    }

    // Filter by amount range
    if (amountFilter.min || amountFilter.max) {
      filtered = filtered.filter((loan) => {
        const amount = loan.loanAmount || 0;
        const min = parseFloat(amountFilter.min) || 0;
        const max = parseFloat(amountFilter.max) || Infinity;
        return amount >= min && amount <= max;
      });
    }

    // Apply day-based filtering for Pending Assignment tab
    if (activeTab === 0) {
      filtered = filtered.filter((loan) => {
        const daysToDue = calculateDaysToDue(loan.dueDate);

        // Show cases that are -2, -1, or 0 days to due date
        // Super admin can also see -3+ days if showExtendedCases is enabled
        if (daysToDue >= -2) {
          return true;
        }

        return isSuperAdmin() && showExtendedCases;
      });
    }

    setFilteredLoans(filtered);
  }, [loans, searchTerm, amountFilter, showExtendedCases, activeTab]);

  const calculateDaysToDue = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysToDueChip = (dueDate) => {
    const days = calculateDaysToDue(dueDate);
    const cls =
      days < 0
        ? "bg-red-50 text-red-700 border-red-200"
        : days === 0
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : days <= 2
            ? "bg-amber-50 text-amber-600 border-amber-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200";
    const label =
      days < 0
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? "Due today"
          : `${days}d`;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}
      >
        {label}
      </span>
    );
  };

  const fetchOfficers = async () => {
    try {
      const response = await fetch("/api/admin-management/officers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOfficers(data.officers || []);
      }
    } catch (err) {
      console.error("Failed to fetch officers:", err);
    }
  };

  const fetchPreCollectionLoans = async () => {
    try {
      setLoading(true);

      // Map tab index to precollection status
      const statusMap = {
        0: "pending_assignment", // Pending Assignment
        1: "assigned", // Assigned
        2: "processed", // Processed (has remarks)
        3: "hung_up", // Hung Up
        4: "completed", // Completed
      };

      const precollectionStatus = statusMap[activeTab] || "pending_assignment";
      const response = await fetch(
        `/api/admin/loans?status=${precollectionStatus}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch loans");
      }

      const data = await response.json();
      setLoans(data.loans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleAction = (loan, action) => {
    if (action === "processed") {
      // Open remark dialog for processed action
      setSelectedLoanForRemark(loan);
      setRemarkDialogOpen(true);
    } else {
      // Handle other actions with existing dialog
      setSelectedLoan(loan);
      setActionType(action);
      setDialogOpen(true);
      setRemarks("");
      setCallOutcome("");
      setNextFollowUp("");
      setAssignOfficer("");
    }
  };

  const handleSubmitAction = async () => {
    if (!selectedLoan || !actionType) return;

    try {
      setSubmitting(true);

      if (actionType === "assign") {
        // Assign officer to case
        const response = await fetch(
          `/api/loans/${selectedLoan._id}/assign-officer`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
            },
            body: JSON.stringify({
              type: "precollection",
              officerId: assignOfficer,
              assignedBy: user._id,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to assign officer");
        }
      } else {
        // Add remark (for processed, hung_up actions)
        const remarkResponse = await fetch(
          `/api/loans/${selectedLoan._id}/remarks`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
            },
            body: JSON.stringify({
              type: "precollection",
              content: remarks,
              callOutcome,
              nextFollowUp: nextFollowUp || null,
              addedBy: user._id,
            }),
          },
        );

        if (!remarkResponse.ok) {
          throw new Error("Failed to add remark");
        }

        // Update precollection status
        const statusResponse = await fetch(
          `/api/loans/${selectedLoan._id}/precollection-status`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
            },
            body: JSON.stringify({
              status: actionType,
              updatedBy: user._id,
            }),
          },
        );

        if (!statusResponse.ok) {
          throw new Error("Failed to update status");
        }
      }

      setDialogOpen(false);
      fetchPreCollectionLoans();
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
      const remarkResponse = await fetch(
        `/api/loans/${selectedLoanForRemark._id}/remarks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify({
            type: "precollection",
            content: remarkData.remark,
            paymentStatus: remarkData.paymentStatus,
            paymentAmount: remarkData.paymentAmount,
            addedBy: user._id,
          }),
        },
      );

      if (!remarkResponse.ok) {
        throw new Error("Failed to add remark");
      }

      // Update precollection status to processed
      const statusResponse = await fetch(
        `/api/loans/${selectedLoanForRemark._id}/precollection-status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify({
            status: "processed",
            updatedBy: user._id,
          }),
        },
      );

      if (!statusResponse.ok) {
        throw new Error("Failed to update status");
      }

      setRemarkDialogOpen(false);
      setSelectedLoanForRemark(null);
      fetchPreCollectionLoans();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending_assignment: {
        label: "Pending Assignment",
        cls: "bg-gray-100 text-gray-700 border-gray-200",
      },
      assigned: {
        label: "Assigned",
        cls: "bg-blue-50 text-blue-700 border-blue-200",
      },
      processed: {
        label: "Processed",
        cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
      },
      hung_up: {
        label: "Hung Up",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      },
      completed: {
        label: "Completed",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
    };

    const config = statusConfig[status] || statusConfig.pending_assignment;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.cls}`}
      >
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  const STATUS_BADGE = {
    pending_assignment: "bg-amber-50 text-amber-700 border-amber-200",
    assigned: "bg-blue-50 text-blue-700 border-blue-200",
    processed: "bg-purple-50 text-purple-700 border-purple-200",
    hung_up: "bg-red-50 text-red-700 border-red-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading
          pre-collection loans...
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
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Pre-Assignment Management
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage case assignments for loans approaching due dates
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabLabels.map((tab, i) => (
          <button
            key={i}
            onClick={() => handleTabChange(null, i)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${activeTab === i ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by name, email, or loan ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <input
            type="number"
            placeholder="Min Amount"
            value={amountFilter.min}
            onChange={(e) =>
              setAmountFilter((p) => ({ ...p, min: e.target.value }))
            }
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
          />
          <input
            type="number"
            placeholder="Max Amount"
            value={amountFilter.max}
            onChange={(e) =>
              setAmountFilter((p) => ({ ...p, max: e.target.value }))
            }
            className="px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
          />
          {activeTab === 0 && isSuperAdmin() && (
            <label className="flex items-center gap-2 text-sm text-gray-600 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={showExtendedCases}
                onChange={(e) => setShowExtendedCases(e.target.checked)}
                className="accent-blue-600"
              />
              Show -3+ days cases
            </label>
          )}
          <button
            onClick={() => {
              setSearchTerm("");
              setAmountFilter({ min: "", max: "" });
              setShowExtendedCases(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition"
          >
            <FiX size={12} /> Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
        <table style={{ minWidth: "780px" }} className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Loan ID",
                "Client Name",
                "Due Date",
                "Days to Due",
                "Amount",
                "Status",
                ...(activeTab === 1 ? ["Assigned Officer"] : []),
                ...(activeTab === 2 || activeTab === 3 ? ["Last Remark"] : []),
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLoans.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No loans found for this category
                </td>
              </tr>
            ) : (
              filteredLoans.map((loan) => (
                <tr key={loan._id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">
                    {loan.loanId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                      <FiUser size={11} />
                      {`${loan.userId?.firstName || ""} ${loan.userId?.lastName || ""}`.trim()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FiCalendar size={11} />
                      {formatDate(loan.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {getDaysToDueChip(loan.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                    <span className="flex items-center gap-1">
                      <FiDollarSign size={11} />
                      {formatCurrency(loan.loanAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[loan.precollectionStatus] || STATUS_BADGE.pending_assignment}`}
                    >
                      {(loan.precollectionStatus || "pending").replace(
                        /_/g,
                        " ",
                      )}
                    </span>
                  </td>
                  {activeTab === 1 && (
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {loan.precollectionOfficer ? (
                        `${loan.precollectionOfficer.firstName} ${loan.precollectionOfficer.lastName}`
                      ) : (
                        <span className="text-gray-300 italic">
                          Not assigned
                        </span>
                      )}
                    </td>
                  )}
                  {(activeTab === 2 || activeTab === 3) && (
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                      {loan.precollectionRemarks?.length > 0 ? (
                        loan.precollectionRemarks[
                          loan.precollectionRemarks.length - 1
                        ].content.substring(0, 50) + "..."
                      ) : (
                        <span className="text-gray-300 italic">No remarks</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {activeTab === 0 && (
                        <button
                          onClick={() => handleAction(loan, "assign")}
                          className="px-2.5 py-1 text-[10px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                        >
                          Assign
                        </button>
                      )}
                      {activeTab === 1 && (
                        <>
                          <button
                            onClick={() => handleAction(loan, "processed")}
                            className="px-2.5 py-1 text-[10px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                          >
                            Add Remark
                          </button>
                          <button
                            onClick={() => handleAction(loan, "hung_up")}
                            className="px-2.5 py-1 text-[10px] font-semibold text-amber-600 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition"
                          >
                            Hung Up
                          </button>
                        </>
                      )}
                      {(activeTab === 2 || activeTab === 3) && (
                        <button
                          onClick={() => handleAction(loan, "add_remark")}
                          className="px-2.5 py-1 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                        >
                          Add Remark
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

      {/* Action Modal */}
      {dialogOpen &&
        selectedLoan &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                maxWidth: "480px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                margin: "0 16px",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800 text-base m-0">
                  {actionType === "assign" ? "Assign Officer" : "Add Remark"}
                </p>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                >
                  <FiX size={14} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {actionType === "assign" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Select Officer
                    </label>
                    <select
                      value={assignOfficer}
                      onChange={(e) => setAssignOfficer(e.target.value)}
                      className={inp}
                    >
                      <option value="">Select an officer...</option>
                      {officers.map((o) => (
                        <option key={o._id} value={o._id}>
                          {o.firstName} {o.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Remarks *
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={4}
                        className={`${inp} resize-none`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Call Outcome
                      </label>
                      <select
                        value={callOutcome}
                        onChange={(e) => setCallOutcome(e.target.value)}
                        className={inp}
                      >
                        <option value="">Select outcome...</option>
                        {[
                          "answered",
                          "no_answer",
                          "busy",
                          "unreachable",
                          "promise_to_pay",
                          "partial_payment",
                          "full_payment",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {v.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Next Follow-up
                      </label>
                      <input
                        type="datetime-local"
                        value={nextFollowUp}
                        onChange={(e) => setNextFollowUp(e.target.value)}
                        className={inp}
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSubmitAction}
                    disabled={
                      submitting ||
                      (actionType === "assign" && !assignOfficer) ||
                      (actionType !== "assign" && !remarks)
                    }
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {submitting ? (
                      <>
                        <FiRefreshCw size={13} className="animate-spin" />{" "}
                        Processing...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </button>
                  <button
                    onClick={() => setDialogOpen(false)}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <RemarkDialog
        open={remarkDialogOpen}
        onClose={() => {
          setRemarkDialogOpen(false);
          setSelectedLoanForRemark(null);
        }}
        onSubmit={handleRemarkSubmit}
        loan={selectedLoanForRemark}
      />
    </div>
  );
};

export default PreCollectionList;
