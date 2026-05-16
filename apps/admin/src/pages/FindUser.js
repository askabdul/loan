import React, { useState } from "react";
import {
  FiSearch,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiX,
  FiSend,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";

const formatDate = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
};

const formatCurrency = (value) => `GHS ${Number(value || 0).toLocaleString()}`;

const buildAddress = (address = {}) => {
  return (
    [address.street, address.city, address.region, address.country]
      .filter(Boolean)
      .join(", ") || "N/A"
  );
};

const buildUserViewModel = (payload = {}) => {
  const user = payload.user || {};
  const summary = payload.summary || {};
  const outstandingAmount = Math.max(
    (summary.totalBorrowed || 0) - (summary.totalRepaid || 0),
    0,
  );

  return {
    raw: user,
    loans: payload.loans || [],
    payments: payload.payments || [],
    // PostgreSQL User has flat top-level fields, not nested in personalInfo/workInfo etc.
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
    status: user.isActive ? "active" : "suspended",
    email: user.email || "N/A",
    phone: user.phoneNumber || "N/A",
    dateOfBirth: formatDate(user.dateOfBirth),
    gender: user.gender || "N/A",
    address: buildAddress(user.address || {}),
    occupation: user.jobTitle || user.employmentStatus || "N/A",
    employer: user.employer || "N/A",
    monthlyIncome: user.monthlyIncome || 0,
    employmentStatus: user.employmentStatus || "N/A",
    educationLevel: user.educationLevel || "N/A",
    institution: user.educationInstitution || "N/A",
    fieldOfStudy: user.fieldOfStudy || "N/A",
    graduationYear: user.graduationYear || "N/A",
    idType: user.idType || "N/A",
    idNumber: user.idNumber || "N/A",
    kycStatus: user.idVerified ? "verified" : "pending",
    authMethod: user.authMethod || "N/A",
    level: `Level ${user.currentLoanLevel || 1}`,
    registrationComplete: user.registrationComplete ? "Complete" : "Incomplete",
    id: user.userId || user.id, // 6-digit display ID, falls back to UUID
    mongoId: user.id || "N/A", // UUID primary key (labelled as ID in UI)
    registrationDate: formatDate(user.createdAt),
    lastLogin: formatDate(user.lastLogin),
    totalLoans: summary.totalLoans || 0,
    activeLoans: summary.activeLoans || 0,
    completedLoans: summary.completedLoans || 0,
    totalBorrowed: summary.totalBorrowed || 0,
    totalRepaid: summary.totalRepaid || 0,
    outstandingAmount,
    emergencyContacts: user.emergencyContacts || [],
  };
};

const getBestMatch = (users, searchQuery, searchType) => {
  const query = searchQuery.trim().toLowerCase();
  return (
    users.find((user) => {
      // PostgreSQL User has flat fields (not nested in personalInfo)
      const firstName = user.firstName?.toLowerCase() || "";
      const lastName = user.lastName?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const email = user.email?.toLowerCase() || "";
      const phoneNumber = user.phoneNumber?.toLowerCase() || "";
      const userId = user.userId?.toLowerCase() || ""; // 6-digit display ID
      const pgId = user.id?.toLowerCase() || ""; // UUID primary key

      switch (searchType) {
        case "email":
          return email === query || email.includes(query);
        case "phone":
          return phoneNumber === query || phoneNumber.includes(query);
        case "name":
          return (
            fullName.includes(query) ||
            firstName.includes(query) ||
            lastName.includes(query)
          );
        case "id":
          return userId === query || pgId === query;
        default:
          return (
            email.includes(query) ||
            phoneNumber.includes(query) ||
            fullName.includes(query) ||
            userId.includes(query) ||
            pgId === query
          );
      }
    }) || users[0]
  );
};

const FindUser = () => {
  const { hasActionPermission, hasDataAccess } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal state
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [loanHistoryModal, setLoanHistoryModal] = useState(false);

  const [messageModal, setMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({
    title: "",
    message: "",
    type: "info",
  });
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  const reloadUser = async (userId) => {
    try {
      const detailResponse = await apiService.getUserById(userId);
      const detailPayload = detailResponse?.data;
      if (detailPayload?.user) setUser(buildUserViewModel(detailPayload));
    } catch (_) {}
  };

  // ── Edit User ────────────────────────────────────────────────────────────────
  const openEditModal = () => {
    setEditForm({
      firstName: user.raw.firstName || "",
      lastName: user.raw.lastName || "",
      email: user.raw.email || "",
      phoneNumber: user.raw.phoneNumber || "",
      gender: user.raw.gender || "",
      jobTitle: user.raw.jobTitle || "",
      employer: user.raw.employer || "",
      monthlyIncome: user.raw.monthlyIncome || "",
      employmentStatus: user.raw.employmentStatus || "",
    });
    setEditError("");
    setEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      const res = await apiService.put(
        `/admin/users/${user.mongoId}`,
        editForm,
      );
      if (res.data?.success) {
        setEditModal(false);
        setActionSuccess("User updated successfully.");
        await reloadUser(user.mongoId);
        setTimeout(() => setActionSuccess(""), 4000);
      } else {
        setEditError(res.data?.message || "Failed to update user.");
      }
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to update user.");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Send Message ──────────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageForm.title.trim() || !messageForm.message.trim()) {
      setMessageError("Title and message are required.");
      return;
    }
    setMessageLoading(true);
    setMessageError("");
    try {
      const res = await apiService.post("/admin/notifications", {
        title: messageForm.title,
        message: messageForm.message,
        type: messageForm.type,
        priority: "medium",
        recipient: { userId: user.mongoId },
      });
      if (res.data?.success) {
        setMessageModal(false);
        setMessageForm({ title: "", message: "", type: "info" });
        setActionSuccess("Message sent to user.");
        setTimeout(() => setActionSuccess(""), 4000);
      } else {
        setMessageError(res.data?.message || "Failed to send message.");
      }
    } catch (err) {
      setMessageError(err.response?.data?.message || "Failed to send message.");
    } finally {
      setMessageLoading(false);
    }
  };

  // ── Suspend / Activate User ───────────────────────────────────────────────────
  const handleSuspendToggle = async () => {
    setSuspendLoading(true);
    try {
      const newStatus = !user.raw.isActive;
      await apiService.updateUserStatus(user.mongoId, newStatus);
      setSuspendModal(false);
      setActionSuccess(
        `User ${newStatus ? "activated" : "suspended"} successfully.`,
      );
      await reloadUser(user.mongoId);
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setActionSuccess("");
      setError(err.response?.data?.message || "Failed to update user status.");
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError("");
    setUser(null);

    try {
      const listResponse = await apiService.getUsers({
        page: 1,
        limit: 20,
        search: searchQuery.trim(),
        searchType,
      });

      const users = listResponse?.data?.users || [];
      if (users.length === 0) {
        setError("User not found");
        return;
      }

      const foundUser = getBestMatch(users, searchQuery, searchType);
      if (!foundUser?.id) {
        setError("User not found");
        return;
      }

      const detailResponse = await apiService.getUserById(foundUser.id);
      const detailPayload = detailResponse?.data;

      if (!detailPayload?.user) {
        setError("User details could not be loaded");
        return;
      }

      setUser(buildUserViewModel(detailPayload));
    } catch (searchError) {
      console.error("Error searching user:", searchError);
      setError("Failed to search user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const BADGE = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suspended: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    verified: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="relative p-6 bg-gray-50 min-h-screen w-full isolate overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiSearch size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Find User
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Search by email, phone, name, user ID or Mongo ID
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Search by:
            </label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Fields</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="name">Name</option>
              <option value="id">User ID / Mongo ID</option>
            </select>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder={`Enter ${searchType === "all" ? "email, phone, name, or ID" : searchType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Result */}
      {user && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* User profile header */}
          <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FiUser size={26} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 m-0">
                {user.name}
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${BADGE[user.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}
              >
                {user.status}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Personal Info */}
            <section>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Personal Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { icon: FiMail, label: "Email", value: user.email },
                  { icon: FiPhone, label: "Phone", value: user.phone },
                  {
                    icon: FiCalendar,
                    label: "Date of Birth",
                    value: user.dateOfBirth,
                  },
                  { icon: FiUser, label: "Gender", value: user.gender },
                  {
                    icon: null,
                    label: "Address",
                    value: user.address,
                    wide: true,
                  },
                ].map(({ icon: Icon, label, value, wide }) => (
                  <div
                    key={label}
                    className={`flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}
                  >
                    {Icon && (
                      <Icon
                        size={14}
                        className="text-gray-400 mt-0.5 flex-shrink-0"
                      />
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {label}
                      </p>
                      <p className="text-sm text-gray-700 m-0">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Account Info */}
            <section>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Account Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "User ID", value: user.id },
                  { label: "Mongo ID", value: user.mongoId },
                  { label: "Registration Date", value: user.registrationDate },
                  { label: "Last Login", value: user.lastLogin },
                  {
                    label: "KYC Status",
                    value: user.kycStatus,
                    badge:
                      BADGE[user.kycStatus] ||
                      "bg-gray-100 text-gray-500 border-gray-200",
                  },
                  { label: "Loan Level", value: user.level },
                  { label: "Authentication", value: user.authMethod },
                  { label: "Registration", value: user.registrationComplete },
                ].map(({ label, value, badge }) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      {label}
                    </p>
                    {badge ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge}`}
                      >
                        {value}
                      </span>
                    ) : (
                      <p className="text-sm text-gray-700 m-0 font-mono">
                        {value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Work & Education */}
            {hasDataAccess("users", "workInfo") && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Work &amp; Education
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Occupation", value: user.occupation },
                    { label: "Employer", value: user.employer },
                    {
                      label: "Monthly Income",
                      value: formatCurrency(user.monthlyIncome),
                      icon: FiDollarSign,
                    },
                    {
                      label: "Employment Status",
                      value: user.employmentStatus,
                    },
                    { label: "Education Level", value: user.educationLevel },
                    { label: "Institution", value: user.institution },
                    { label: "Field of Study", value: user.fieldOfStudy },
                    { label: "Graduation Year", value: user.graduationYear },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {label}
                      </p>
                      <p className="text-sm text-gray-700 m-0">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Loan Information */}
            {hasDataAccess("users", "loanHistory") && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Loan Information
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {[
                    {
                      icon: FiCreditCard,
                      label: "Total Loans",
                      value: user.totalLoans,
                    },
                    {
                      icon: null,
                      label: "Active Loans",
                      value: user.activeLoans,
                    },
                    {
                      icon: null,
                      label: "Completed Loans",
                      value: user.completedLoans,
                    },
                    { icon: null, label: "KYC / ID Type", value: user.idType },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3"
                    >
                      {Icon && (
                        <Icon
                          size={14}
                          className="text-gray-400 mt-0.5 flex-shrink-0"
                        />
                      )}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                          {label}
                        </p>
                        <p className="text-sm font-bold text-gray-800 m-0">
                          {value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Total Borrowed",
                      value: formatCurrency(user.totalBorrowed),
                      color: "text-blue-700",
                    },
                    {
                      label: "Total Repaid",
                      value: formatCurrency(user.totalRepaid),
                      color: "text-emerald-700",
                    },
                    {
                      label: "Outstanding Amount",
                      value: formatCurrency(user.outstandingAmount),
                      color: "text-red-700",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        {label}
                      </p>
                      <p className={`text-base font-bold m-0 ${color}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Verification & Contacts */}
            <section>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Verification &amp; Contacts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    ID Type
                  </p>
                  <p className="text-sm text-gray-700 m-0">{user.idType}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    ID Number
                  </p>
                  <p className="text-sm text-gray-700 m-0 font-mono">
                    {user.idNumber}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 sm:col-span-2 lg:col-span-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    Emergency Contacts
                  </p>
                  <p className="text-sm text-gray-700 m-0">
                    {user.emergencyContacts.length > 0
                      ? user.emergencyContacts
                          .map(
                            (c) =>
                              `${c.name} (${c.relationship}) – ${c.phoneNumber}`,
                          )
                          .join(" | ")
                      : "N/A"}
                  </p>
                </div>
              </div>
            </section>

            {/* Actions */}
            {actionSuccess && (
              <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                {actionSuccess}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
              {hasActionPermission("editUsers") && (
                <button
                  onClick={openEditModal}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
                >
                  Edit User
                </button>
              )}
              {hasActionPermission("viewLoans") && (
                <button
                  onClick={() => setLoanHistoryModal(true)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  View Loan History
                </button>
              )}
              {hasActionPermission("manageNotifications") && (
                <button
                  onClick={() => {
                    setMessageForm({ title: "", message: "", type: "info" });
                    setMessageError("");
                    setMessageModal(true);
                  }}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  Send Message
                </button>
              )}
              {hasActionPermission("editUsers") && (
                <button
                  onClick={() => setSuspendModal(true)}
                  className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition"
                >
                  {user.raw.isActive ? "Suspend User" : "Activate User"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editModal && user && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                Edit User — {user.name}
              </h3>
              <button
                onClick={() => setEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={18} />
              </button>
            </div>
            <form
              onSubmit={handleEditSubmit}
              className="p-6 space-y-3 max-h-[70vh] overflow-y-auto"
            >
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}
              {[
                { label: "First Name", key: "firstName" },
                { label: "Last Name", key: "lastName" },
                { label: "Email", key: "email", type: "email" },
                { label: "Phone Number", key: "phoneNumber" },
                { label: "Job Title", key: "jobTitle" },
                { label: "Employer", key: "employer" },
                {
                  label: "Monthly Income",
                  key: "monthlyIncome",
                  type: "number",
                },
              ].map(({ label, key, type = "text" }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={editForm[key] || ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Gender
                </label>
                <select
                  value={editForm.gender || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, gender: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Employment Status
                </label>
                <select
                  value={editForm.employmentStatus || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      employmentStatus: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="employed">Employed</option>
                  <option value="self-employed">Self-Employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Loan History Modal ── */}
      {loanHistoryModal && user && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[72vw] lg:w-[62vw] max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                Loan History — {user.name}
              </h3>
              <button
                onClick={() => setLoanHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
              {user.loans.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">
                  No loans found for this user.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      {[
                        "Loan ID",
                        "Amount",
                        "Status",
                        "Applied",
                        "Due / Completed",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {user.loans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {loan.id?.slice(-10)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-600">
                          {loan.status}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatDate(loan.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatDate(loan.completionDate || loan.approvalDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setLoanHistoryModal(false)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Message Modal ── */}
      {messageModal && user && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[60vw] lg:w-[50vw] max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                Send Message to {user.name}
              </h3>
              <button
                onClick={() => setMessageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              {messageError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {messageError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={messageForm.title}
                  onChange={(e) =>
                    setMessageForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Notification title"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Message
                </label>
                <textarea
                  value={messageForm.message}
                  onChange={(e) =>
                    setMessageForm((f) => ({ ...f, message: e.target.value }))
                  }
                  placeholder="Enter message content…"
                  rows={4}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Type
                </label>
                <select
                  value={messageForm.type}
                  onChange={(e) =>
                    setMessageForm((f) => ({ ...f, type: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Alert</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={messageLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                >
                  <FiSend size={13} />{" "}
                  {messageLoading ? "Sending…" : "Send Message"}
                </button>
                <button
                  type="button"
                  onClick={() => setMessageModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Suspend / Activate Confirm ── */}
      {suspendModal && user && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[92vw] md:w-[50vw] lg:w-[42vw] max-w-md p-6">
            <h3 className="font-bold text-gray-800 mb-2">
              {user.raw.isActive ? "Suspend User?" : "Activate User?"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {user.raw.isActive
                ? `This will prevent ${user.name} from accessing their account.`
                : `This will restore ${user.name}'s access to their account.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSuspendToggle}
                disabled={suspendLoading}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 transition text-white ${user.raw.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {suspendLoading
                  ? "Processing…"
                  : user.raw.isActive
                    ? "Yes, Suspend"
                    : "Yes, Activate"}
              </button>
              <button
                onClick={() => setSuspendModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindUser;
