/**
 * KycGate.js
 * Multi-step KYC wrapper that intercepts /loan-application (and /apply).
 * If user.kycComplete === true → show the Loan Application form directly.
 * If user.kycComplete === false → walk user through 4 KYC steps, then show the form.
 *
 * KYC steps:
 *   1. Work Information
 *   2. Education Information
 *   3. Emergency Contacts
 *   4. ID Verification
 *
 * Each step auto-saves to localStorage. On completion, calls PATCH /users/me/kyc,
 * sets kycComplete = true, then shows the Loan Application form.
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { usersAPI } from "../../services/api";
import LoanApplication from "./LoanApplication";
import KycWorkInfo from "./kyc/WorkInfo";
import KycEducationInfo from "./kyc/EducationInfo";
import KycEmergencyContacts from "./kyc/EmergencyContacts";
import KycIdVerification from "./kyc/IdVerification";

const STEPS = ["work", "education", "emergency-contacts", "id-verification"];
const STEP_LABELS = ["Work Info", "Education", "Emergency", "ID Verify"];

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 7l3.5 3.5L12 3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const KycGate = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [kycDone, setKycDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [kycData, setKycData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.kycComplete) setKycDone(true);
    try {
      const saved = localStorage.getItem(`kycData_${user?.id}`);
      if (saved) setKycData(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [user]);

  const saveStepData = (stepData) => {
    const updated = { ...kycData, ...stepData };
    setKycData(updated);
    try {
      localStorage.setItem(`kycData_${user?.id}`, JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  const goToNextStep = () => setCurrentStep((prev) => prev + 1);
  const goToPrevStep = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const handleFinalSubmit = async (idData) => {
    const finalData = { ...kycData, ...idData };
    setSubmitting(true);
    try {
      const res = await usersAPI.submitKyc(finalData);
      if (res.success) {
        localStorage.removeItem(`kycData_${user?.id}`);
        if (refreshUser) await refreshUser();
        showToast("Profile information saved successfully!", "success");
        setKycDone(true);
      } else {
        showToast(res.message || "Failed to save KYC information.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (kycDone || user?.kycComplete) return <LoanApplication />;

  return (
    <div className="cedi-page-background">
      <div className="py-4">
        {/* Progress Header */}
        <div className="card cedi-card mb-4">
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <h5 className="fw-bold text-cedi-dark mb-1">Complete Your Profile</h5>
              <p className="text-muted small mb-0">
                Required before your first loan application
              </p>
            </div>

            {/* Step indicator with circles + connecting lines */}
            <div className="d-flex align-items-center justify-content-center">
              {STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <div className="d-flex flex-column align-items-center" style={{ minWidth: 60 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: i <= currentStep ? "#2563eb" : "#e2e8f0",
                        color: i <= currentStep ? "#fff" : "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 600,
                        boxShadow: i === currentStep ? "0 0 0 4px #eff6ff" : "none",
                        transition: "all 0.3s",
                      }}
                    >
                      {i < currentStep ? <CheckIcon /> : i + 1}
                    </div>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: i === currentStep ? 700 : 400,
                        color: i === currentStep ? "#2563eb" : i < currentStep ? "#64748b" : "#94a3b8",
                        marginTop: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {STEP_LABELS[i]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        background: i < currentStep ? "#2563eb" : "#e2e8f0",
                        marginBottom: 20,
                        transition: "background 0.3s",
                        maxWidth: 40,
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 0 && (
          <KycWorkInfo
            initialData={kycData}
            onNext={(data) => { saveStepData(data); goToNextStep(); }}
            onBack={goToPrevStep}
          />
        )}
        {currentStep === 1 && (
          <KycEducationInfo
            initialData={kycData}
            onNext={(data) => { saveStepData(data); goToNextStep(); }}
            onBack={goToPrevStep}
          />
        )}
        {currentStep === 2 && (
          <KycEmergencyContacts
            initialData={kycData}
            onNext={(data) => { saveStepData(data); goToNextStep(); }}
            onBack={goToPrevStep}
          />
        )}
        {currentStep === 3 && (
          <KycIdVerification
            initialData={kycData}
            onSubmit={handleFinalSubmit}
            onBack={goToPrevStep}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
};

export default KycGate;
