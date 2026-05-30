/**
 * Collection > Officer Management
 * Blueprint Section 9 — Manage collection and pre-collection officers
 * Officers are admin accounts with roles: collection-officer, collection-lead,
 * precollection-officer, precollection-lead.
 * Uses:
 *   GET  /api/admin-management/officers?role=...   — list officers
 *   GET  /api/admin-management/roles               — fetch roles for form
 *   POST /api/admin-management/admins              — create officer
 *   PUT  /api/admin-management/admins/:id/status   — toggle active
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  FiUsers,
  FiPlus,
  FiX,
  FiRefreshCw,
  FiUser,
  FiToggleLeft,
  FiToggleRight,
  FiEye,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const authHeader = (json = true) => ({
  Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

const OFFICER_ROLES = [
  "collection-officer",
  "collection-lead",
  "precollection-officer",
  "precollection-lead",
];

const ROLE_LABELS = {
  "collection-officer": "Collection Officer",
  "collection-lead": "Collection Lead",
  "precollection-officer": "Pre-Collection Officer",
  "precollection-lead": "Pre-Collection Lead",
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  role: "",
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 left-0 md:left-64 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-2xl flex flex-col max-h-[90vh]">
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

const ROLE_BADGE = {
  "collection-officer": "bg-blue-50 text-blue-700 border-blue-200",
  "collection-lead": "bg-purple-50 text-purple-700 border-purple-200",
  "precollection-officer": "bg-amber-50 text-amber-700 border-amber-200",
  "precollection-lead": "bg-orange-50 text-orange-700 border-orange-200",
};

const OfficerManagement = () => {
  const { hasActionPermission } = useAuth();

  const [officers, setOfficers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [casesModal, setCasesModal] = useState(null);
  const [casesData, setCasesData] = useState(null);
  const [casesLoading, setCasesLoading] = useState(false);

  const fetchOfficerCases = async (officer) => {
    if (!officer?.id) return;
    setCasesModal(officer);
    setCasesLoading(true);
    setCasesData(null);
    try {
      const res = await fetch(
        `${API_BASE}/admin-management/officers/${officer.id}/cases?limit=50`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        setCasesData(data.data);
      } else {
        toast.error(data.message || "Failed to load officer cases");
      }
    } catch {
      toast.error("Network error loading officer cases");
    } finally {
      setCasesLoading(false);
    }
  };

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: OFFICER_ROLES.join(","),
        status: "all",
      });
      const res = await fetch(
        `${API_BASE}/admin-management/officers?${params}`,
        { headers: authHeader() },
      );
      const data = await res.json();
      if (data.success) {
        setOfficers(data.data || []);
      } else {
        toast.error(data.message || "Failed to load officers");
      }
    } catch {
      toast.error("Network error loading officers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin-management/roles`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) {
        // Filter to only officer/lead roles
        const filtered = (data.data || []).filter((r) =>
          OFFICER_ROLES.includes(r.name),
        );
        setRoles(filtered);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchOfficers();
    fetchRoles();
  }, [fetchOfficers, fetchRoles]);

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Invalid email";
    if (!form.phoneNumber.trim()) errs.phoneNumber = "Required";
    if (!form.password || form.password.length < 8)
      errs.password = "Min 8 characters";
    if (!form.role) errs.role = "Select a role";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin-management/admins`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phoneNumber: form.phoneNumber.trim(),
          password: form.password,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Officer created successfully");
        setShowCreate(false);
        setForm(EMPTY_FORM);
        setFormErrors({});
        fetchOfficers();
      } else {
        const firstValidationError =
          Array.isArray(data?.errors) && data.errors.length > 0
            ? data.errors[0]?.msg
            : null;
        toast.error(
          firstValidationError || data.message || "Failed to create officer",
        );
      }
    } catch {
      toast.error("Network error creating officer");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (officer) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin-management/admins/${officer.id}`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify({ isActive: !officer.isActive }),
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          `${officer.name} ${!officer.isActive ? "activated" : "deactivated"}`,
        );
        fetchOfficers();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const filtered =
    roleFilter === "all"
      ? officers
      : officers.filter((o) => o.role?.name === roleFilter);

  const inp =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiUsers size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Officer Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Collection & Pre-Collection officers · {officers.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOfficers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          {(hasActionPermission("createAdmin") || true) && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
            >
              <FiPlus size={15} /> Add Officer
            </button>
          )}
        </div>
      </div>

      {/* Role filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { key: "all", label: "All" },
          ...OFFICER_ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] })),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRoleFilter(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              roleFilter === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Officers grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <FiUsers size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No officers found</p>
          <p className="text-gray-300 text-xs mt-1">
            Click "Add Officer" to create one
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FiUser size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">
                      {o.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{o.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleStatus(o)}
                  title={o.isActive ? "Deactivate" : "Activate"}
                  className="flex-shrink-0 mt-0.5"
                >
                  {o.isActive ? (
                    <FiToggleRight size={22} className="text-green-500" />
                  ) : (
                    <FiToggleLeft size={22} className="text-gray-300" />
                  )}
                </button>
              </div>

              <div className="space-y-1.5">
                {o.role && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      ROLE_BADGE[o.role.name] ||
                      "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {o.role.displayName ||
                      ROLE_LABELS[o.role.name] ||
                      o.role.name}
                  </span>
                )}
                <p className="text-xs text-gray-500">{o.phoneNumber || "—"}</p>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    o.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {o.isActive ? "Active" : "Inactive"}
                </span>
                <div className="pt-2">
                  <button
                    onClick={() => fetchOfficerCases(o)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                  >
                    <FiEye size={12} /> View Assigned Cases
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {casesModal && (
        <Modal
          title={`Assigned Cases · ${casesModal.name}`}
          onClose={() => {
            setCasesModal(null);
            setCasesData(null);
          }}
        >
          {casesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
              <FiRefreshCw size={15} className="animate-spin mr-2" /> Loading assigned cases…
            </div>
          ) : !casesData ? (
            <div className="text-sm text-gray-400">No data available.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                  <p className="text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">{casesData.summary?.totalAssigned || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs">
                  <p className="text-blue-500">Review</p>
                  <p className="font-semibold text-blue-700">{casesData.summary?.reviewAssigned || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                  <p className="text-amber-500">Pre-Collection</p>
                  <p className="font-semibold text-amber-700">{casesData.summary?.precollectionAssigned || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs">
                  <p className="text-emerald-500">Collection</p>
                  <p className="font-semibold text-emerald-700">{casesData.summary?.collectionAssigned || 0}</p>
                </div>
              </div>

              {["review", "precollection", "collection"].map((groupKey) => {
                const items = casesData?.cases?.[groupKey] || [];
                const title =
                  groupKey === "precollection"
                    ? "Pre-Collection"
                    : groupKey === "collection"
                      ? "Collection"
                      : "Credit Review";

                return (
                  <div key={groupKey} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
                      {title} · {items.length}
                    </div>
                    {items.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-gray-400">No assigned cases.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="px-3 py-2">Loan</th>
                              <th className="px-3 py-2">Customer</th>
                              <th className="px-3 py-2">Phone</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((loan) => (
                              <tr key={`${groupKey}-${loan.id}`} className="border-b border-gray-50">
                                <td className="px-3 py-2 font-mono text-gray-600">{loan.loanId || loan.id?.slice(-8)}</td>
                                <td className="px-3 py-2 text-gray-700">{loan.User?.firstName} {loan.User?.lastName}</td>
                                <td className="px-3 py-2 text-gray-500">{loan.User?.phoneNumber || "—"}</td>
                                <td className="px-3 py-2 text-gray-600">
                                  {loan.precollectionStatus || loan.collectionStatus || loan.assignmentStatus || loan.status}
                                </td>
                                <td className="px-3 py-2 text-gray-700">{Number(loan.remainingBalance || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* Create Officer Modal */}
      {showCreate && (
        <Modal
          title="Add Officer"
          onClose={() => {
            setShowCreate(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
          }}
        >
          <div className="space-y-4">
            {[
              ["firstName", "First Name", "text"],
              ["lastName", "Last Name", "text"],
              ["email", "Email", "email"],
              ["phoneNumber", "Phone Number", "tel"],
              ["password", "Password", "password"],
            ].map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  minLength={field === "password" ? 8 : undefined}
                  className={`${inp} ${formErrors[field] ? "border-red-300 ring-1 ring-red-300" : ""}`}
                  placeholder={
                    field === "password" ? "Min 8 characters" : label
                  }
                />
                {formErrors[field] && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors[field]}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
                className={`${inp} ${formErrors.role ? "border-red-300 ring-1 ring-red-300" : ""}`}
              >
                <option value="">Select role…</option>
                {roles.length > 0
                  ? roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayName || ROLE_LABELS[r.name] || r.name}
                      </option>
                    ))
                  : OFFICER_ROLES.map((name) => (
                      <option key={name} value={name}>
                        {ROLE_LABELS[name]}
                      </option>
                    ))}
              </select>
              {formErrors.role && (
                <p className="text-xs text-red-600 mt-1">{formErrors.role}</p>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Officer"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setForm(EMPTY_FORM);
                  setFormErrors({});
                }}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
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

export default OfficerManagement;
