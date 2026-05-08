import React, { useState } from "react";
import {
  FiSearch,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
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
    name:
      `${user.personalInfo?.firstName || ""} ${user.personalInfo?.lastName || ""}`.trim() ||
      user.fullName ||
      "N/A",
    status: user.isActive ? "active" : "suspended",
    email: user.email || "N/A",
    phone: user.phoneNumber || "N/A",
    dateOfBirth: formatDate(user.personalInfo?.dateOfBirth),
    gender: user.personalInfo?.gender || "N/A",
    address: buildAddress(user.personalInfo?.address),
    occupation:
      user.workInfo?.jobTitle || user.workInfo?.employmentStatus || "N/A",
    employer: user.workInfo?.employer || "N/A",
    monthlyIncome: user.workInfo?.monthlyIncome || 0,
    employmentStatus: user.workInfo?.employmentStatus || "N/A",
    educationLevel: user.educationInfo?.highestLevel || "N/A",
    institution: user.educationInfo?.institution || "N/A",
    fieldOfStudy: user.educationInfo?.fieldOfStudy || "N/A",
    graduationYear: user.educationInfo?.graduationYear || "N/A",
    idType: user.idVerification?.idType || "N/A",
    idNumber: user.idVerification?.idNumber || "N/A",
    kycStatus: user.idVerification?.isVerified ? "verified" : "pending",
    authMethod: user.authMethod || "N/A",
    level: `Level ${user.currentLoanLevel || 1}`,
    registrationComplete: user.registrationComplete ? "Complete" : "Incomplete",
    id: user.userId || user._id,
    mongoId: user._id || "N/A",
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
      const firstName = user.personalInfo?.firstName?.toLowerCase() || "";
      const lastName = user.personalInfo?.lastName?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const email = user.email?.toLowerCase() || "";
      const phoneNumber = user.phoneNumber?.toLowerCase() || "";
      const userId = user.userId?.toLowerCase() || "";
      const mongoId = user._id?.toLowerCase() || "";

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
          return userId === query || mongoId === query;
        default:
          return (
            email.includes(query) ||
            phoneNumber.includes(query) ||
            fullName.includes(query) ||
            userId.includes(query) ||
            mongoId === query
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
      if (!foundUser?._id) {
        setError("User not found");
        return;
      }

      const detailResponse = await apiService.getUserById(foundUser._id);
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
    <div className="p-6 bg-gray-50 min-h-screen w-full">
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
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
              {hasActionPermission("editUsers") && (
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
                  Edit User
                </button>
              )}
              {hasActionPermission("viewLoans") && (
                <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
                  View Loan History
                </button>
              )}
              {hasActionPermission("manageNotifications") && (
                <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
                  Send Message
                </button>
              )}
              {hasActionPermission("editUsers") && (
                <button className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition">
                  Suspend User
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindUser;
