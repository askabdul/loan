import React, { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiUsers,
  FiUser,
  FiCheck,
  FiAlertCircle,
  FiClock,
} from "react-icons/fi";
import { toast } from "react-toastify";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  });

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Dedicated page for bulk-assigning unassigned loans to review officers.
const CreditReviewAssign = () => {
  const { hasActionPermission, isSuperAdmin } = useAuth();

  const [loans, setLoans] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loadingOfficers, setLoadingOfficers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoans, setSelectedLoans] = useState([]);
  const [selectedOfficers, setSelectedOfficers] = useState([]);
  const [assignmentMode, setAssignmentMode] = useState("even");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    current: 1,
  });

  const canAssign = hasActionPermission("assignLoan") || isSuperAdmin;

  const fetchLoans = useCallback(async (page = 1, search = "") => {
    try {
      setLoadingLoans(true);
      const res = await apiService.getLoans({
        page,
        limit: 20,
        status: "pending",
        search: search || undefined,
      });
      const data = res?.data || res;
      setLoans(data?.loans || []);
      setPagination({
        total: data?.pagination?.total || 0,
        pages: data?.pagination?.pages || 1,
        current: page,
      });
    } catch {
      setError("Failed to load unassigned loans.");
    } finally {
      setLoadingLoans(false);
    }
  }, []);

  const fetchOfficers = useCallback(async () => {
    try {
      setLoadingOfficers(true);
      const res = await apiService.getOfficersByRole(
        "review-officer,review-lead",
      );
      setOfficers(res?.data || []);
    } catch {
      // non-critical
    } finally {
      setLoadingOfficers(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
    fetchOfficers();
  }, [fetchLoans, fetchOfficers]);

  useEffect(() => {
    const t = setTimeout(() => fetchLoans(1, searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm, fetchLoans]);

  const toggleLoan = (id) =>
    setSelectedLoans((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAllLoans = () =>
    setSelectedLoans(
      selectedLoans.length === loans.length ? [] : loans.map((l) => l.id),
    );

  const toggleOfficer = (id) =>
    setSelectedOfficers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAllOfficers = () =>
    setSelectedOfficers(
      selectedOfficers.length === officers.length
        ? []
        : officers.map((o) => o.id),
    );

  const getPreviewCounts = () => {
    if (
      assignmentMode !== "even" ||
      selectedOfficers.length === 0 ||
      selectedLoans.length === 0
    )
      return {};
    const counts = {};
    selectedLoans.forEach((_, i) => {
      const oid = selectedOfficers[i % selectedOfficers.length];
      counts[oid] = (counts[oid] || 0) + 1;
    });
    return counts;
  };

  const handleAssign = async () => {
    if (selectedLoans.length === 0) {
      setError("Select at least one loan.");
      return;
    }
    if (selectedOfficers.length === 0) {
      setError("Select at least one officer.");
      return;
    }
    try {
      setAssigning(true);
      setError(null);
      await apiService.assignLoansToOfficers(
        selectedLoans,
        selectedOfficers,
        assignmentMode,
      );
      toast.success(`${selectedLoans.length} loan(s) assigned successfully.`);
      setSelectedLoans([]);
      setSelectedOfficers([]);
      fetchLoans(pagination.current, searchTerm);
    } catch (err) {
      setError(err?.message || "Assignment failed. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  const previewCounts = getPreviewCounts();

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <FiUsers size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Credit Review — Assign
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Assign unreviewed loan applications to review officers
            </p>
          </div>
          <button
            onClick={() => {
              fetchLoans(1, searchTerm);
              fetchOfficers();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-purple-500 hover:bg-purple-50 hover:border-purple-300 transition"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
          <FiAlertCircle size={15} className="flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — Loans */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FiClock size={15} className="text-amber-500" />
              <span className="font-semibold text-gray-700 text-sm">
                Unassigned Loans
                {pagination.total > 0 && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                    {pagination.total}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedLoans.length > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                  {selectedLoans.length} selected
                </span>
              )}
              <div className="relative">
                <FiSearch
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search…"
                  className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-40"
                />
              </div>
            </div>
          </div>

          {loadingLoans ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading loans…
            </div>
          ) : loans.length === 0 ? (
            <div className="py-12 text-center">
              <FiCheck size={32} className="text-green-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No unassigned loans</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedLoans.length === loans.length &&
                            loans.length > 0
                          }
                          onChange={toggleAllLoans}
                          className="accent-purple-600 w-4 h-4"
                        />
                      </th>
                      {["Loan ID", "Customer", "Amount", "Applied"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loans.map((loan) => (
                      <tr
                        key={loan.id}
                        onClick={() => toggleLoan(loan.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedLoans.includes(loan.id)
                            ? "bg-purple-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedLoans.includes(loan.id)}
                            onChange={() => toggleLoan(loan.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-purple-600 w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600">
                          #{loan.loanId || loan.id?.slice(-8)}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-800 text-sm">
                            {loan.User
                              ? `${loan.User.firstName} ${loan.User.lastName}`
                              : "—"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {loan.User?.phoneNumber}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-700">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">
                          {formatDate(loan.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
                  <span>{pagination.total} total</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        fetchLoans(pagination.current - 1, searchTerm)
                      }
                      disabled={pagination.current === 1}
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>
                      {pagination.current}/{pagination.pages}
                    </span>
                    <button
                      onClick={() =>
                        fetchLoans(pagination.current + 1, searchTerm)
                      }
                      disabled={pagination.current === pagination.pages}
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT — Officers + Controls */}
        <div className="flex flex-col gap-4">
          {/* Officers panel */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiUser size={15} className="text-blue-500" />
                <span className="font-semibold text-gray-700 text-sm">
                  Review Officers
                </span>
              </div>
              {officers.length > 0 && (
                <button
                  onClick={toggleAllOfficers}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedOfficers.length === officers.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}
            </div>
            <div className="p-3 space-y-2">
              {loadingOfficers ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Loading officers…
                </p>
              ) : officers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No active review officers found.
                  <br />
                  <span className="text-xs">
                    Add officers via Admin Management.
                  </span>
                </p>
              ) : (
                officers.map((officer) => {
                  const isSelected = selectedOfficers.includes(officer.id);
                  const count = previewCounts[officer.id] || 0;
                  return (
                    <div
                      key={officer.id}
                      onClick={() => toggleOfficer(officer.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FiUser size={13} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {officer.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {officer.role?.displayName}
                        </p>
                      </div>
                      {isSelected && count > 0 && (
                        <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                          +{count}
                        </span>
                      )}
                      {isSelected && count === 0 && (
                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <FiCheck size={9} className="text-white" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Assign controls */}
          {canAssign && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Distribution
              </p>
              <div className="space-y-2">
                {[
                  { value: "even", label: "Even Distribution" },
                  { value: "manual", label: "First Officer Only" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      checked={assignmentMode === opt.value}
                      onChange={() => setAssignmentMode(opt.value)}
                      className="accent-purple-600"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              {selectedLoans.length > 0 && selectedOfficers.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  <strong className="text-gray-700">
                    {selectedLoans.length}
                  </strong>{" "}
                  loan(s) →{" "}
                  <strong className="text-gray-700">
                    {selectedOfficers.length}
                  </strong>{" "}
                  officer(s)
                  {assignmentMode === "even" && selectedOfficers.length > 0 && (
                    <span className="text-gray-400">
                      {" "}
                      (≈
                      {Math.ceil(
                        selectedLoans.length / selectedOfficers.length,
                      )}{" "}
                      each)
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleAssign}
                disabled={
                  assigning ||
                  selectedLoans.length === 0 ||
                  selectedOfficers.length === 0
                }
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {assigning
                  ? "Assigning…"
                  : selectedLoans.length === 0
                    ? "Select loans first"
                    : selectedOfficers.length === 0
                      ? "Select officers first"
                      : `Assign ${selectedLoans.length} loan${selectedLoans.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {!canAssign && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
              You don't have permission to assign loans. Contact your
              administrator.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditReviewAssign;
