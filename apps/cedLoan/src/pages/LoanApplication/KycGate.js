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
const STEP_LABELS = [
  "Work Info",
  "Education",
  "Emergency Contacts",
  "ID Verification",
];

const KycGate = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [kycDone, setKycDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed
  const [kycData, setKycData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.kycComplete) {
      setKycDone(true);
    }

    // Load saved KYC progress from localStorage
    try {
      const saved = localStorage.getItem(`kycData_${user?.id}`);
      if (saved) setKycData(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [user]);

  const saveStepData = (stepData) => {
    const updated = { ...kycData, ...stepData };
    setKycData(updated);
    try {
      localStorage.setItem(`kycData_${user?.id}`, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  };

  const goToNextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const goToPrevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

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
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // If KYC is already done, show loan form directly
  if (kycDone || user?.kycComplete) {
    return <LoanApplication />;
  }

  return (
    <div className="cedi-page-background">
      <div className="py-4">
        {/* Progress Header */}
        <div className="card cedi-card mb-4">
          <div className="card-body p-4">
            <div className="text-center mb-3">
              <h5 className="fw-bold text-cedi-dark mb-1">
                Complete Your Profile
              </h5>
              <p className="text-muted small mb-0">
                Required before your first loan application — Step{" "}
                {currentStep + 1} of {STEPS.length}
              </p>
            </div>
            {/* Progress bar */}
            <div className="progress mb-3" style={{ height: "6px" }}>
              <div
                className="progress-bar bg-primary"
                style={{
                  width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            {/* Step labels */}
            <div className="d-flex justify-content-between">
              {STEP_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={`small ${i === currentStep ? "fw-semibold text-primary" : i < currentStep ? "text-success" : "text-muted"}`}
                  style={{ fontSize: "0.72rem" }}
                >
                  {i < currentStep ? "✓ " : ""}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 0 && (
          <KycWorkInfo
            initialData={kycData}
            onNext={(data) => {
              saveStepData(data);
              goToNextStep();
            }}
          />
        )}
        {currentStep === 1 && (
          <KycEducationInfo
            initialData={kycData}
            onNext={(data) => {
              saveStepData(data);
              goToNextStep();
            }}
            onBack={goToPrevStep}
          />
        )}
        {currentStep === 2 && (
          <KycEmergencyContacts
            initialData={kycData}
            onNext={(data) => {
              saveStepData(data);
              goToNextStep();
            }}
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
