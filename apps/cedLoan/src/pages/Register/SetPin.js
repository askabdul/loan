import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";

const WEAK_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "1230",
  "0123",
  "9876",
  "6789",
]);

// Individual PIN digit box
const PinBox = ({ filled, active, done }) => (
  <div
    style={{
      width: "60px",
      height: "60px",
      borderRadius: "16px",
      border: `2.5px solid ${active ? "#2563eb" : done ? "#10b981" : filled ? "#6366f1" : "#e5e7eb"}`,
      background: active ? "#eff6ff" : filled ? "#f5f3ff" : "#f9fafb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.15s",
      boxShadow: active ? "0 0 0 4px rgba(37,99,235,0.12)" : "none",
    }}
  >
    {filled && (
      <div
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: done ? "#10b981" : "#6366f1",
          transition: "background 0.2s",
        }}
      />
    )}
  </div>
);

// Shared PIN entry row
const PinRow = ({ value, onChange, label, isConfirm, done }) => {
  const inputRef = useRef(null);

  // Auto focus
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#6b7280",
          textAlign: "center",
          marginBottom: "16px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>
      <div
        style={{
          display: "flex",
          gap: "12px",
          justifyContent: "center",
          cursor: "text",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {[0, 1, 2, 3].map((i) => (
          <PinBox
            key={i}
            filled={!!value[i]}
            active={value.length === i}
            done={done}
          />
        ))}
      </div>
      {/* Invisible capture input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 4))
        }
        style={{
          position: "absolute",
          opacity: 0,
          width: "1px",
          height: "1px",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

const SetPin = () => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState("create"); // "create" | "confirm"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Auto-advance to confirm when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && step === "create") {
      if (WEAK_PINS.has(pin)) {
        setError("Please choose a stronger PIN (avoid 1234, 0000, etc.)");
        setPin("");
        return;
      }
      setError("");
      setTimeout(() => setStep("confirm"), 200);
    }
  }, [pin, step]);

  // Auto-submit when confirm has 4 digits
  useEffect(() => {
    if (confirmPin.length === 4 && step === "confirm") {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin]);

  const handleSubmit = async () => {
    if (confirmPin !== pin) {
      setError("PINs don't match — let's try again");
      setConfirmPin("");
      setPin("");
      setStep("create");
      return;
    }

    const phoneNumber = localStorage.getItem("registrationPhone");
    if (!phoneNumber) {
      setError("Phone number missing. Please restart registration.");
      navigate("/register");
      return;
    }

    const personalInfo = JSON.parse(
      localStorage.getItem("registrationPersonalInfo") || "{}",
    );
    if (!personalInfo.firstName) {
      setError("Personal info missing. Please go back and fill it in.");
      navigate("/register/personal-info");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          pin,
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          dateOfBirth: personalInfo.dateOfBirth,
          gender: personalInfo.gender,
          address: {
            street: personalInfo.address || "",
            city: personalInfo.city || "",
            region: personalInfo.region || "",
            country: "Ghana",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Registration failed. Please try again.");
        setConfirmPin("");
        setPin("");
        setStep("create");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.removeItem("registrationPhone");
      localStorage.removeItem("registrationPersonalInfo");

      showToast("Account created! Welcome to CEDI Loan 🎉", "success");
      navigate("/home");
    } catch (err) {
      setError("Network error. Please check your connection.");
      setConfirmPin("");
      setPin("");
      setStep("create");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPin("");
    setConfirmPin("");
    setStep("create");
    setError("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: "380px",
          padding: "40px 32px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "20px" }}>
              C
            </span>
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "#9ca3af",
              marginBottom: "6px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Step 3 of 3 · Secure Your Account
          </p>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 6px",
            }}
          >
            {step === "create" ? "Create Your PIN" : "Confirm Your PIN"}
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
            {step === "create"
              ? "You'll use this 4-digit PIN every time you log in"
              : "Re-enter your PIN to confirm it"}
          </p>
        </div>

        {/* PIN boxes */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: "18px",
            padding: "32px 20px",
            marginBottom: "20px",
          }}
        >
          {step === "create" ? (
            <PinRow
              label="Enter PIN"
              value={pin}
              onChange={setPin}
              done={false}
            />
          ) : (
            <PinRow
              label="Confirm PIN"
              value={confirmPin}
              onChange={setConfirmPin}
              isConfirm
              done={confirmPin.length === 4}
            />
          )}
        </div>

        {/* Step dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginBottom: "18px",
          }}
        >
          {["create", "confirm"].map((s) => (
            <div
              key={s}
              style={{
                width: step === s ? "22px" : "8px",
                height: "8px",
                borderRadius: "4px",
                background: step === s ? "#2563eb" : "#d1d5db",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#dc2626",
              fontSize: "13px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                border: "3px solid #e5e7eb",
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto",
              }}
            />
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
              Creating your account…
            </p>
          </div>
        )}

        {/* Security tips */}
        <div
          style={{
            background: "#eff6ff",
            borderRadius: "12px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#1e40af",
              margin: "0 0 6px",
            }}
          >
            🔒 PIN Security Tips
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "11px",
              color: "#3b82f6",
              lineHeight: 1.7,
            }}
          >
            <li>Avoid simple patterns like 1234 or 0000</li>
            <li>Don't use your date of birth</li>
            <li>Never share your PIN with anyone</li>
          </ul>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            onClick={
              step === "confirm" ? handleReset : () => navigate("/register")
            }
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: "13px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {step === "confirm" ? "← Start over" : "← Back to verification"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SetPin;
