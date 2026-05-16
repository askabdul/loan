import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { FiX, FiUser, FiCheck, FiAlertCircle, FiUsers } from "react-icons/fi";
import apiService from "../../services/api";

/**
 * OfficerAssignmentModal
 * props:
 *   isOpen          — boolean
 *   onClose         — () => void
 *   selectedLoans   — string[]  (loan IDs)
 *   onAssignmentComplete — () => void
 *   roleFilter      — string | string[] — role name(s) to filter officers by
 *                     defaults to credit-review roles
 *   title           — optional modal heading override
 */
const OfficerAssignmentModal = ({
  isOpen,
  onClose,
  selectedLoans = [],
  onAssignmentComplete,
  roleFilter = "review-officer,review-lead",
  title = "Assign Loans to Review Officers",
}) => {
  const [officers, setOfficers] = useState([]);
  const [selectedOfficers, setSelectedOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState("even");
  const [manualAssignments, setManualAssignments] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchOfficers();
      setSelectedOfficers([]);
      setManualAssignments({});
      setAssignmentMode("even");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      setError(null);
      const roles = Array.isArray(roleFilter)
        ? roleFilter.join(",")
        : roleFilter;
      const res = await apiService.getOfficersByRole(roles);
      setOfficers(res.data || []);
    } catch (err) {
      setError("Failed to load officers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleOfficer = (id) => {
    setSelectedOfficers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    setSelectedOfficers(
      selectedOfficers.length === officers.length
        ? []
        : officers.map((o) => o.id),
    );
  };

  const distributeEvenly = () => {
    if (selectedOfficers.length === 0) return {};
    const result = {};
    selectedLoans.forEach((loanId, i) => {
      const officerId = selectedOfficers[i % selectedOfficers.length];
      if (!result[officerId]) result[officerId] = [];
      result[officerId].push(loanId);
    });
    return result;
  };

  const getPreview = () => {
    if (assignmentMode === "even") return distributeEvenly();
    const result = {};
    Object.entries(manualAssignments).forEach(([loanId, officerId]) => {
      if (!officerId) return;
      if (!result[officerId]) result[officerId] = [];
      result[officerId].push(loanId);
    });
    return result;
  };

  const handleAssign = async () => {
    if (assignmentMode === "even" && selectedOfficers.length === 0) {
      setError("Select at least one officer.");
      return;
    }
    if (assignmentMode === "manual") {
      const unassigned = selectedLoans.filter((id) => !manualAssignments[id]);
      if (unassigned.length > 0) {
        setError(
          `${unassigned.length} loan(s) not yet assigned to an officer.`,
        );
        return;
      }
    }
    try {
      setAssigning(true);
      setError(null);
      const officerIds =
        assignmentMode === "even"
          ? selectedOfficers
          : [...new Set(Object.values(manualAssignments).filter(Boolean))];
      await apiService.assignLoansToOfficers(
        selectedLoans,
        officerIds,
        assignmentMode,
      );
      onAssignmentComplete?.();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to assign loans. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  const preview = getPreview();

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FiUsers size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-gray-800 m-0">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <FiAlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">
              {selectedLoans.length}
            </span>{" "}
            loan{selectedLoans.length !== 1 ? "s" : ""} selected
          </div>

          {/* Assignment mode */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Distribution Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "even",
                  label: "Even Distribution",
                  desc: "Spread evenly across selected officers",
                },
                {
                  value: "manual",
                  label: "Manual",
                  desc: "Assign each loan individually",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAssignmentMode(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    assignmentMode === opt.value
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Officers list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Officers
              </p>
              {assignmentMode === "even" && officers.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedOfficers.length === officers.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
            </div>
            {loading ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                Loading officers…
              </div>
            ) : officers.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                No active officers found for this role.
              </div>
            ) : (
              <div className="space-y-2">
                {officers.map((officer) => {
                  const isSelected = selectedOfficers.includes(officer.id);
                  return (
                    <div
                      key={officer.id}
                      onClick={() =>
                        assignmentMode === "even" && toggleOfficer(officer.id)
                      }
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        assignmentMode === "even" ? "cursor-pointer" : ""
                      } ${
                        isSelected
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FiUser size={15} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {officer.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {officer.email}
                        </p>
                        <p className="text-xs text-gray-400">
                          {officer.role?.displayName || officer.role?.name}
                        </p>
                      </div>
                      {assignmentMode === "even" && isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <FiCheck size={11} className="text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual assignment */}
          {assignmentMode === "manual" && officers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Loan Assignments
              </p>
              <div className="space-y-2">
                {selectedLoans.map((loanId) => (
                  <div key={loanId} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 w-28 flex-shrink-0 truncate">
                      #{loanId.slice(-8)}
                    </span>
                    <select
                      value={manualAssignments[loanId] || ""}
                      onChange={(e) =>
                        setManualAssignments((prev) => ({
                          ...prev,
                          [loanId]: e.target.value,
                        }))
                      }
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    >
                      <option value="">Select officer…</option>
                      {officers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {Object.keys(preview).length > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Preview
              </p>
              <div className="space-y-1">
                {Object.entries(preview).map(([officerId, loanIds]) => {
                  const officer = officers.find((o) => o.id === officerId);
                  return (
                    <div
                      key={officerId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {officer?.name || "Unknown"}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        {loanIds.length} loan{loanIds.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={assigning}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || Object.keys(preview).length === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {assigning
              ? "Assigning…"
              : `Assign ${selectedLoans.length} loan${selectedLoans.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OfficerAssignmentModal;
