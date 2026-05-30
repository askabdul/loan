import React, { useState } from "react";
import {
  FiX,
  FiUser,
  FiDollarSign,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import "./DetailModal.css";

const fmt = (val) =>
  parseFloat(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const StatusPill = ({ status }) => {
  const map = {
    pending: "pill-pending",
    "under-review": "pill-review",
    approved: "pill-approved",
    rejected: "pill-rejected",
    "hanged-up": "pill-hanged",
    disbursed: "pill-disbursed",
    active: "pill-active",
    overdue: "pill-overdue",
    completed: "pill-completed",
    cancelled: "pill-cancelled",
  };
  return (
    <span className={`dm-pill ${map[status] || "pill-default"}`}>{status}</span>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="dm-row">
    <span className="dm-label">{label}</span>
    <span className="dm-value">{value ?? "—"}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div className="dm-section">
    <h3 className="dm-section-title">{title}</h3>
    {children}
  </div>
);

const LoanInfoTab = ({ data }) => (
  <div className="dm-content">
    <Section title="Application Overview">
      <div className="dm-grid">
        <InfoRow
          label="Case ID"
          value={<code className="dm-code">{data.loanId || "—"}</code>}
        />
        <InfoRow label="Status" value={<StatusPill status={data.status} />} />
        <InfoRow label="Purpose" value={data.purpose} />
        <InfoRow label="Loan Level" value={`Level ${data.loanLevel}`} />
        <InfoRow
          label="Applied On"
          value={
            data.createdAt ? new Date(data.createdAt).toLocaleString() : "—"
          }
        />
        <InfoRow
          label="Auto Approved"
          value={data.isAutoApproved ? "✅ Yes" : "No"}
        />
      </div>
    </Section>

    <Section title="Loan Amounts">
      <div className="dm-grid">
        <InfoRow
          label="Requested Amount"
          value={<strong>GHS {fmt(data.amount)}</strong>}
        />
        <InfoRow
          label="Total Repayment"
          value={<strong>GHS {fmt(data.totalAmount || data.amount)}</strong>}
        />
        <InfoRow
          label="Remaining Balance"
          value={
            <strong className={data.isOverdue ? "dm-danger" : ""}>
              GHS{" "}
              {fmt(data.remainingBalance ?? data.totalAmount ?? data.amount)}
            </strong>
          }
        />
      </div>
    </Section>

    <Section title="Term & Key Dates">
      <div className="dm-grid">
        <InfoRow
          label="Term"
          value={`${data.termInDays} days${data.duration ? ` (${data.duration} month${data.duration !== 1 ? "s" : ""})` : ""}`}
        />
        <InfoRow
          label="Approval Date"
          value={
            data.approvalDate
              ? new Date(data.approvalDate).toLocaleString()
              : "—"
          }
        />
        <InfoRow
          label="Disbursement Date"
          value={
            data.disbursementDate
              ? new Date(data.disbursementDate).toLocaleString()
              : "—"
          }
        />
        <InfoRow
          label="Due Date"
          value={
            data.dueDate ? new Date(data.dueDate).toLocaleDateString() : "—"
          }
        />
        {data.completionDate && (
          <InfoRow
            label="Completion Date"
            value={new Date(data.completionDate).toLocaleDateString()}
          />
        )}
      </div>
    </Section>

    <Section title="Applicant">
      <div className="dm-grid">
        <InfoRow
          label="Full Name"
          value={
            data.User ? `${data.User.firstName} ${data.User.lastName}` : "—"
          }
        />
        <InfoRow label="Phone" value={data.User?.phoneNumber} />
        <InfoRow label="Email" value={data.User?.email} />
        <InfoRow
          label="Loan Level"
          value={`Level ${data.User?.currentLoanLevel || 1}`}
        />
        <InfoRow
          label="User ID"
          value={<code className="dm-code dm-code-sm">{data.userId}</code>}
        />
      </div>
    </Section>

    {data.AssignedOfficer && (
      <Section title="Assigned Officer">
        <div className="dm-grid">
          <InfoRow
            label="Name"
            value={`${data.AssignedOfficer.firstName} ${data.AssignedOfficer.lastName}`}
          />
          <InfoRow label="Email" value={data.AssignedOfficer.email} />
          <InfoRow
            label="Assigned On"
            value={
              data.assignmentDate
                ? new Date(data.assignmentDate).toLocaleString()
                : "—"
            }
          />
        </div>
      </Section>
    )}

    {(data.ReviewedBy ||
      data.rejectionReason ||
      data.reviewRemarks ||
      data.reviewDate) && (
      <Section title="Review Information">
        <div className="dm-grid">
          {data.ReviewedBy && (
            <InfoRow
              label="Reviewed By"
              value={`${data.ReviewedBy.firstName} ${data.ReviewedBy.lastName}`}
            />
          )}
          {data.reviewDate && (
            <InfoRow
              label="Review Date"
              value={new Date(data.reviewDate).toLocaleString()}
            />
          )}
          {data.rejectionReason && (
            <InfoRow
              label="Rejection Reason"
              value={<span className="dm-danger">{data.rejectionReason}</span>}
            />
          )}
          {data.reviewRemarks && (
            <InfoRow label="Remarks" value={data.reviewRemarks} />
          )}
        </div>
      </Section>
    )}

    {data.adminNotes && data.adminNotes.length > 0 && (
      <Section title="Admin Notes">
        <div className="dm-notes">
          {data.adminNotes.map((note, i) => (
            <div key={i} className="dm-note">
              <p className="dm-note-text">{note.note}</p>
              {note.addedAt && (
                <small className="dm-note-meta">
                  {new Date(note.addedAt).toLocaleString()}
                </small>
              )}
            </div>
          ))}
        </div>
      </Section>
    )}
  </div>
);

const FinancialTab = ({ data }) => (
  <div className="dm-content">
    <Section title="Fee Breakdown">
      <div className="dm-fee-table">
        <div className="dm-fee-row">
          <span className="dm-fee-label">Principal Amount</span>
          <span className="dm-fee-value">GHS {fmt(data.amount)}</span>
        </div>
        <div className="dm-fee-row">
          <span className="dm-fee-label">Interest Rate</span>
          <span className="dm-fee-value">
            {parseFloat(data.interestRate || 0)}% / month
          </span>
        </div>
        <div className="dm-fee-row">
          <span className="dm-fee-label">Total Interest</span>
          <span className="dm-fee-value">GHS {fmt(data.totalInterest)}</span>
        </div>
        <div className="dm-fee-row">
          <span className="dm-fee-label">
            Service Fee ({parseFloat(data.serviceFeePct || 0)}%)
          </span>
          <span className="dm-fee-value">GHS {fmt(data.serviceFee)}</span>
        </div>
        <div className="dm-fee-row">
          <span className="dm-fee-label">
            Administration Fee ({parseFloat(data.administrationFeePct || 0)}%)
          </span>
          <span className="dm-fee-value">
            GHS {fmt(data.administrationFee)}
          </span>
        </div>
        <div className="dm-fee-row">
          <span className="dm-fee-label">
            Commitment Fee ({parseFloat(data.commitmentFeePct || 0)}%)
          </span>
          <span className="dm-fee-value">GHS {fmt(data.commitmentFee)}</span>
        </div>
        <div className="dm-fee-row dm-fee-total">
          <span className="dm-fee-label">Total Repayment</span>
          <span className="dm-fee-value dm-fee-total-val">
            GHS {fmt(data.totalAmount || data.amount)}
          </span>
        </div>
      </div>
    </Section>

    {data.monthlyPayment > 0 && (
      <Section title="Repayment Schedule">
        <div className="dm-grid">
          <InfoRow
            label="Monthly Payment"
            value={<strong>GHS {fmt(data.monthlyPayment)}</strong>}
          />
          <InfoRow
            label="Duration"
            value={`${data.duration} month${data.duration !== 1 ? "s" : ""}`}
          />
        </div>
      </Section>
    )}

    {["active", "overdue", "completed"].includes(data.status) && (
      <Section title="Repayment Progress">
        <div className="dm-grid">
          <InfoRow
            label="Remaining Balance"
            value={
              <span className={data.isOverdue ? "dm-danger" : ""}>
                GHS {fmt(data.remainingBalance)}
              </span>
            }
          />
          <InfoRow
            label="Total Paid"
            value={`GHS ${fmt(parseFloat(data.totalAmount || 0) - parseFloat(data.remainingBalance || 0))}`}
          />
          <InfoRow
            label="Is Overdue"
            value={
              data.isOverdue ? (
                <span className="dm-danger">⚠ Yes</span>
              ) : (
                <span className="dm-success">No</span>
              )
            }
          />
          {data.overdueFeePct > 0 && (
            <InfoRow
              label={`Overdue Fee (${parseFloat(data.overdueFeePct)}%)`}
              value={`GHS ${fmt(data.totalOverdueFee)}`}
            />
          )}
        </div>
        {data.totalAmount > 0 && (
          <div className="dm-progress-bar">
            <div
              className="dm-progress-fill"
              style={{
                width: `${Math.min(100, ((parseFloat(data.totalAmount) - parseFloat(data.remainingBalance || 0)) / parseFloat(data.totalAmount)) * 100)}%`,
              }}
            />
          </div>
        )}
      </Section>
    )}

    {data.extensionCount > 0 && (
      <Section title="Loan Extensions">
        <div className="dm-grid">
          <InfoRow label="Extensions Taken" value={data.extensionCount} />
          <InfoRow
            label="Extension Days Added"
            value={`${data.extensionDays} days`}
          />
          <InfoRow
            label="Extension Fee"
            value={`GHS ${fmt(data.extensionFee)}`}
          />
          {data.extendedDueDate && (
            <InfoRow
              label="Extended Due Date"
              value={new Date(data.extendedDueDate).toLocaleDateString()}
            />
          )}
        </div>
      </Section>
    )}

    <Section title="Terms & Acceptance">
      <div className="dm-grid">
        <InfoRow
          label="Terms Accepted"
          value={
            data.termsAccepted ? (
              <span className="dm-success">✅ Yes</span>
            ) : (
              <span className="dm-danger">❌ No</span>
            )
          }
        />
        {data.termsAcceptedAt && (
          <InfoRow
            label="Accepted At"
            value={new Date(data.termsAcceptedAt).toLocaleString()}
          />
        )}
      </div>
    </Section>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const DetailModal = ({
  isOpen,
  onClose,
  data,
  type = "loan",
  readOnly = false,
  onApprove,
  onReject,
  onHangUp,
  onDisburse,
  onActivate,
}) => {
  const { hasActionPermission, user } = useAuth();
  const canUpdateLoanStatus = hasActionPermission("updateLoanStatus");
  const [activeTab, setActiveTab] = useState("info");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !data) return null;

  // Review actions (approve/reject/hang-up) available for pending/under-review/assigned
  const roleName = user?.role?.name || user?.Role?.name;
  const canReviewOfficerDecide = roleName === "review-officer";

  const canReview =
    canReviewOfficerDecide &&
    !readOnly &&
    ["pending", "under-review", "assigned"].includes(data.status) &&
    (onApprove || onReject || onHangUp);

  // Disbursement action available for approved loans
  const canDisburse = !readOnly && data.status === "approved" && onDisburse;

  // Activate action available for disbursed loans
  const canActivate = !readOnly && data.status === "disbursed" && onActivate;

  const canAction = canReview || canDisburse || canActivate;

  // Derived flags from adminNotes for contextual UI hints
  const customerRequestedDisbursement = (data.adminNotes || []).some(
    (n) => n.type === "disbursement_request",
  );
  const customerConfirmedReceipt = (data.adminNotes || []).some(
    (n) => n.type === "receipt_confirmed",
  );

  const handleAction = (action) => {
    setReviewAction(action);
    setShowReviewForm(true);
    setRemarks("");
  };
  const handleCancel = () => {
    setShowReviewForm(false);
    setReviewAction("");
    setRemarks("");
  };

  const handleSubmit = async () => {
    const currentMeta = ACTION_META[reviewAction] || {};
    if (currentMeta.needsRemarks !== false && !remarks.trim()) {
      alert("Please provide remarks for your decision.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (reviewAction === "approve") await onApprove(remarks);
      else if (reviewAction === "reject") await onReject(remarks);
      else if (reviewAction === "hangup") await onHangUp(remarks);
      else if (reviewAction === "disburse") await onDisburse(remarks);
      else if (reviewAction === "activate") await onActivate(remarks);
      handleCancel();
      onClose();
    } catch {
      alert("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ACTION_META = {
    approve: { label: "Approve", cls: "dm-btn-approve", needsRemarks: true },
    reject: { label: "Reject", cls: "dm-btn-reject", needsRemarks: true },
    hangup: { label: "Hang Up", cls: "dm-btn-hangup", needsRemarks: true },
    disburse: { label: "Disburse", cls: "dm-btn-disburse", needsRemarks: true },
    activate: {
      label: "Activate Loan",
      cls: "dm-btn-activate",
      needsRemarks: false,
      description:
        "Confirm that the customer has received the disbursed funds. This starts the official repayment clock and sets the due date.",
    },
  };
  const meta = ACTION_META[reviewAction] || {};

  return (
    <div className="dm-overlay" onClick={onClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dm-header">
          <div className="dm-header-left">
            <FiFileText className="dm-header-icon" />
            <div>
              <h2 className="dm-title">Loan Application</h2>
              {data.loanId && (
                <span className="dm-subtitle">Case #{data.loanId}</span>
              )}
            </div>
          </div>
          <div className="dm-header-right">
            <StatusPill status={data.status} />
            {readOnly && <span className="dm-readonly-badge">View Only</span>}
            <button className="dm-close" onClick={onClose}>
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="dm-tabs">
          <button
            className={`dm-tab ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            <FiUser size={13} /> Application Details
          </button>
          <button
            className={`dm-tab ${activeTab === "financial" ? "active" : ""}`}
            onClick={() => setActiveTab("financial")}
          >
            <FiDollarSign size={13} /> Financial & Fees
          </button>
        </div>

        {/* Body */}
        <div className="dm-body">
          {activeTab === "info" && <LoanInfoTab data={data} />}
          {activeTab === "financial" && <FinancialTab data={data} />}
        </div>

        {/* Footer */}
        {canAction && (
          <div className="dm-footer">
            {!showReviewForm ? (
              <div className="dm-actions">
                <span className="dm-actions-label">
                  <FiClock size={13} />
                  {canDisburse
                    ? customerRequestedDisbursement
                      ? " Customer requested disbursement"
                      : " Approved — awaiting disbursement"
                    : canActivate
                      ? customerConfirmedReceipt
                        ? " Customer confirmed receipt — ready to activate"
                        : " Disbursed — awaiting customer confirmation"
                      : " Awaiting decision"}
                </span>
                <div className="dm-action-btns">
                  {/* Review actions */}
                  {canReview &&
                    canUpdateLoanStatus &&
                    onApprove && (
                      <button
                        className="dm-btn dm-btn-approve"
                        onClick={() => handleAction("approve")}
                      >
                        <FiCheckCircle size={14} /> Approve
                      </button>
                    )}
                  {canReview &&
                    canUpdateLoanStatus &&
                    onReject && (
                      <button
                        className="dm-btn dm-btn-reject"
                        onClick={() => handleAction("reject")}
                      >
                        <FiX size={14} /> Reject
                      </button>
                    )}
                  {canReview &&
                    canUpdateLoanStatus &&
                    onHangUp && (
                      <button
                        className="dm-btn dm-btn-hangup"
                        onClick={() => handleAction("hangup")}
                      >
                        <FiAlertCircle size={14} /> Hang Up
                      </button>
                    )}
                  {/* Disbursement action */}
                  {canDisburse && canUpdateLoanStatus && (
                    <button
                      className="dm-btn dm-btn-disburse"
                      onClick={() => handleAction("disburse")}
                    >
                      <FiDollarSign size={14} /> Disburse Loan
                    </button>
                  )}
                  {/* Activate action */}
                  {canActivate && canUpdateLoanStatus && (
                    <button
                      className="dm-btn dm-btn-activate"
                      title="Confirm the customer has received the funds and start the repayment clock"
                      onClick={() => handleAction("activate")}
                    >
                      <FiCheckCircle size={14} /> Activate Loan
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="dm-review-form">
                <p className="dm-review-title">{meta.label} this loan?</p>
                {meta.description && (
                  <p className="dm-review-description">{meta.description}</p>
                )}
                {meta.needsRemarks !== false && (
                  <textarea
                    className="dm-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={`Provide remarks for ${(meta.label || "").toLowerCase()}ing this loan…`}
                    rows={3}
                  />
                )}
                <div className="dm-form-actions">
                  <button
                    className="dm-btn dm-btn-cancel"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className={`dm-btn ${meta.cls || "dm-btn-approve"}`}
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      (meta.needsRemarks !== false && !remarks.trim())
                    }
                  >
                    {isSubmitting ? "Submitting…" : `Confirm ${meta.label}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailModal;
