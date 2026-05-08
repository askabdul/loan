import React, { useState } from "react";
import {
  FiX,
  FiUser,
  FiPhone,
  FiBriefcase,
  FiBook,
  FiShield,
  FiDollarSign,
  FiLock,
  FiUnlock,
  FiRefreshCw,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";
import "./UserDetailModal.css";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (val) =>
  parseFloat(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const Row = ({ label, value }) => (
  <div className="udm-row">
    <span className="udm-label">{label}</span>
    <span className="udm-value">{value ?? "—"}</span>
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <div className="udm-section">
    <h3 className="udm-section-title">
      {Icon && <Icon size={14} className="udm-section-icon" />}
      {title}
    </h3>
    {children}
  </div>
);

const StatusBadge = ({ active, trueLabel = "Active", falseLabel = "Inactive" }) => (
  <span
    className={`udm-badge ${active ? "udm-badge-green" : "udm-badge-gray"}`}
  >
    {active ? trueLabel : falseLabel}
  </span>
);

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = ({ user }) => (
  <div className="udm-content">
    <Section title="Personal Information" icon={FiUser}>
      <div className="udm-grid">
        <Row label="Full Name" value={`${user.firstName || ""} ${user.lastName || ""}`.trim()} />
        <Row label="User ID" value={<code className="udm-code">{user.userId || "—"}</code>} />
        <Row label="Phone" value={user.phoneNumber} />
        <Row label="Email" value={user.email || "—"} />
        <Row label="Date of Birth" value={fmtDate(user.dateOfBirth)} />
        <Row label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : "—"} />
      </div>
    </Section>

    {user.address && (
      <Section title="Address" icon={FiShield}>
        <div className="udm-grid">
          <Row label="Street" value={user.address.street || "—"} />
          <Row label="City" value={user.address.city || "—"} />
          <Row label="Region" value={user.address.region || "—"} />
          <Row label="Country" value={user.address.country || "Ghana"} />
        </div>
      </Section>
    )}

    <Section title="Account Status" icon={FiShield}>
      <div className="udm-grid">
        <Row
          label="Account"
          value={<StatusBadge active={user.isActive} />}
        />
        <Row
          label="Registration"
          value={
            <StatusBadge
              active={user.registrationComplete}
              trueLabel="Complete"
              falseLabel="Incomplete"
            />
          }
        />
        <Row
          label="KYC"
          value={
            <StatusBadge
              active={user.kycComplete}
              trueLabel="✓ Complete"
              falseLabel="Pending"
            />
          }
        />
        <Row
          label="Phone Verified"
          value={
            <StatusBadge
              active={user.isPhoneVerified}
              trueLabel="Verified"
              falseLabel="Not Verified"
            />
          }
        />
        <Row
          label="ID Verified"
          value={
            <StatusBadge
              active={user.idVerified}
              trueLabel="Verified"
              falseLabel="Pending"
            />
          }
        />
        <Row label="Loan Level" value={
          <span className="udm-badge udm-badge-blue">Level {user.currentLoanLevel || 1}</span>
        } />
        <Row label="Registered On" value={fmtDate(user.createdAt)} />
        <Row label="Last Login" value={fmtDate(user.lastLogin)} />
      </div>
    </Section>
  </div>
);

// ── KYC Tab ───────────────────────────────────────────────────────────────────
const KycTab = ({ user }) => (
  <div className="udm-content">
    <Section title="Employment Information" icon={FiBriefcase}>
      <div className="udm-grid">
        <Row label="Employment Status" value={user.employmentStatus ? user.employmentStatus.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"} />
        <Row label="Employer" value={user.employer || "—"} />
        <Row label="Job Title" value={user.jobTitle || "—"} />
        <Row label="Monthly Income" value={user.monthlyIncome ? `GHS ${fmt(user.monthlyIncome)}` : "—"} />
        <Row label="Work Address" value={user.workAddress || "—"} />
        <Row label="Years of Employment" value={user.yearsOfEmployment ?? "—"} />
      </div>
    </Section>

    <Section title="Education" icon={FiBook}>
      <div className="udm-grid">
        <Row label="Level" value={user.educationLevel ? user.educationLevel.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"} />
        <Row label="Institution" value={user.educationInstitution || "—"} />
        <Row label="Field of Study" value={user.fieldOfStudy || "—"} />
        <Row label="Graduation Year" value={user.graduationYear || "—"} />
      </div>
    </Section>

    {user.emergencyContacts && user.emergencyContacts.length > 0 && (
      <Section title="Emergency Contacts" icon={FiPhone}>
        {user.emergencyContacts.map((c, i) => (
          <div key={i} className="udm-contact-card">
            <div className="udm-contact-name">
              {c.name} <span className="udm-contact-rel">({c.relationship})</span>
            </div>
            <div className="udm-grid">
              <Row label="Phone" value={c.phoneNumber || c.phone} />
              <Row label="Email" value={c.email || "—"} />
            </div>
          </div>
        ))}
      </Section>
    )}

    <Section title="ID Verification" icon={FiShield}>
      <div className="udm-grid">
        <Row label="ID Type" value={user.idType ? user.idType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"} />
        <Row label="ID Number" value={user.idNumber || "—"} />
        <Row
          label="Verified"
          value={
            <StatusBadge
              active={user.idVerified}
              trueLabel="✓ Verified"
              falseLabel="Awaiting Verification"
            />
          }
        />
        {user.idVerificationDate && (
          <Row label="Verified On" value={fmtDate(user.idVerificationDate)} />
        )}
      </div>
      {user.idDocuments && user.idDocuments.length > 0 && (
        <div className="udm-id-docs">
          {user.idDocuments.map((doc, i) => (
            <a
              key={i}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="udm-doc-link"
            >
              📄 Document {i + 1}
            </a>
          ))}
        </div>
      )}
    </Section>
  </div>
);

// ── Loans Tab ─────────────────────────────────────────────────────────────────
const LoansTab = ({ loans, summary }) => {
  const STATUS_CLS = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    "under-review": "bg-blue-50 text-blue-700 border-blue-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    disbursed: "bg-indigo-50 text-indigo-700 border-indigo-200",
    active: "bg-teal-50 text-teal-700 border-teal-200",
    overdue: "bg-orange-50 text-orange-700 border-orange-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
    defaulted: "bg-red-100 text-red-800 border-red-300",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="udm-content">
      {/* Summary strip */}
      {summary && (
        <div className="udm-summary-strip">
          {[
            { label: "Total Loans", value: summary.totalLoans || 0, cls: "text-blue-600" },
            { label: "Active Now", value: summary.activeLoans || 0, cls: "text-teal-600" },
            { label: "Completed", value: summary.completedLoans || 0, cls: "text-emerald-600" },
            { label: "Total Borrowed", value: summary.totalBorrowed ? `GHS ${fmt(summary.totalBorrowed)}` : "GHS 0.00", cls: "text-gray-700" },
            { label: "Total Repaid", value: summary.totalRepaid ? `GHS ${fmt(summary.totalRepaid)}` : "GHS 0.00", cls: "text-gray-700" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="udm-summary-card">
              <span className={`udm-summary-val ${cls}`}>{value}</span>
              <span className="udm-summary-lbl">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loan history table */}
      {loans && loans.length > 0 ? (
        <div className="udm-loan-table-wrap">
          <table className="udm-loan-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="font-mono text-blue-600">{loan.loanId || loan.id?.slice(0, 8) + "…"}</td>
                  <td className="font-semibold">GHS {fmt(loan.amount)}</td>
                  <td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CLS[loan.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {loan.status}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">{fmtDate(loan.createdAt)}</td>
                  <td className="text-gray-500 text-xs">{fmtDate(loan.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="udm-empty">No loan history found.</div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const UserDetailModal = ({ isOpen, onClose, data, onStatusChange }) => {
  const { hasActionPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [blocking, setBlocking] = useState(false);

  if (!isOpen || !data) return null;

  // data = { user, loans, payments, summary } from GET /api/admin/users/:id
  const user = data.user || data;
  const loans = data.loans || [];
  const summary = data.summary || null;

  const tabs = [
    { id: "profile", label: "Profile", icon: FiUser },
    { id: "kyc", label: "KYC & Employment", icon: FiBriefcase },
    { id: "loans", label: `Loans (${loans.length})`, icon: FiDollarSign },
  ];

  const handleToggleStatus = async () => {
    try {
      setBlocking(true);
      const response = await apiService.updateUserStatus(user.id, !user.isActive);
      if (response.success && onStatusChange) {
        onStatusChange();
      }
    } catch (err) {
      console.error("Failed to update user status:", err);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="udm-overlay" onClick={onClose}>
      <div className="udm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="udm-header">
          <div className="udm-header-left">
            <div className="udm-avatar">
              {user.firstName?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="udm-title">
                {`${user.firstName || ""} ${user.lastName || ""}`.trim() || "User Details"}
              </h2>
              <div className="udm-subtitle-row">
                {user.userId && (
                  <code className="udm-header-id">#{user.userId}</code>
                )}
                <StatusBadge active={user.isActive} />
                {user.kycComplete && (
                  <span className="udm-badge udm-badge-green">KYC ✓</span>
                )}
                <span className="udm-badge udm-badge-blue">
                  Level {user.currentLoanLevel || 1}
                </span>
              </div>
            </div>
          </div>
          <div className="udm-header-right">
            {hasActionPermission("editUsers") && (
              <button
                onClick={handleToggleStatus}
                disabled={blocking}
                title={user.isActive ? "Deactivate account" : "Activate account"}
                className={`udm-action-btn ${user.isActive ? "udm-btn-block" : "udm-btn-unblock"}`}
              >
                {blocking ? (
                  <FiRefreshCw size={13} className="animate-spin" />
                ) : user.isActive ? (
                  <><FiLock size={13} /> Block</>
                ) : (
                  <><FiUnlock size={13} /> Unblock</>
                )}
              </button>
            )}
            <button className="udm-close" onClick={onClose}>
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="udm-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`udm-tab ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="udm-body">
          {activeTab === "profile" && <ProfileTab user={user} />}
          {activeTab === "kyc" && <KycTab user={user} />}
          {activeTab === "loans" && <LoansTab loans={loans} summary={summary} />}
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
