import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";

const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10)
    return "+233" + digits.slice(1);
  if (digits.startsWith("233") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("233") && digits.length === 15) return "+" + digits;
  return raw;
};

const Register = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!phone || phone.length < 9) {
      setError("Please enter a valid phone number");
      return;
    }

    const formattedPhone = formatPhone(phone);
    setLoading(true);
    try {
      // Check if phone already registered
      const checkRes = await fetch(`${API_BASE_URL}/auth/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        setError(
          "An account with this phone number already exists. Please login instead.",
        );
        return;
      }

      // Send OTP via backend
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Failed to send verification code");
        return;
      }

      localStorage.setItem("registrationPhone", formattedPhone);
      setStep("otp");
      setResendTimer(60);
      showToast("Verification code sent!", "success");

      // In dev mode the backend returns the OTP so we can display it
      if (data.devOtp) setDevOtp(data.devOtp);
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    const formattedPhone = localStorage.getItem("registrationPhone");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone, otp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Invalid verification code");
        return;
      }

      showToast("Phone number verified!", "success");
      navigate("/register/personal-info");
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError("");
    setDevOtp("");
    const formattedPhone = localStorage.getItem("registrationPhone");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("New code sent!", "success");
        setResendTimer(60);
        if (data.devOtp) setDevOtp(data.devOtp);
      } else {
        setError(data.message || "Failed to resend code");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="cedi-bg-gradient d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", padding: "1rem" }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6">
            <div className="card cedi-card shadow-lg border-0">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="cedi-logo-container mx-auto mb-3">
                    <span className="cedi-logo-text">CEDI</span>
                  </div>
                  <h1 className="cedi-title mb-1">Create Account</h1>
                  <p className="text-muted small">
                    Step {step === "phone" ? "1" : "2"} of 2 — Phone
                    Verification
                  </p>
                </div>

                {step === "phone" ? (
                  <form onSubmit={handleSendCode}>
                    <div className="mb-3">
                      <label className="form-label fw-medium text-dark">
                        Phone Number
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <i className="bi bi-telephone"></i>
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="form-control cedi-form-input border-start-0"
                          placeholder="e.g. 0244123456"
                          required
                          style={{
                            padding: "12px 16px",
                            borderRadius: "0 12px 12px 0",
                            backgroundColor: "#f8f9fa",
                          }}
                        />
                      </div>
                      <p className="small text-muted mt-1">
                        We'll send you a 6-digit verification code
                      </p>
                    </div>

                    {error && (
                      <div className="alert alert-danger py-2">{error}</div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn cedi-btn-primary w-100 py-3 fw-semibold"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Sending...
                        </>
                      ) : (
                        "Send Code"
                      )}
                    </button>

                    <div className="text-center mt-3">
                      <span className="text-muted small">
                        Already have an account?{" "}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="btn btn-link p-0 small fw-semibold"
                        style={{ color: "var(--cedi-blue)" }}
                      >
                        Sign In
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP}>
                    <div className="mb-4">
                      <label className="form-label fw-medium text-dark text-center d-block mb-3">
                        Enter Verification Code
                      </label>
                      <div className="d-flex justify-content-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <input
                            key={i}
                            id={`reg-otp-${i}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={otp[i] || ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              const arr = (otp + "      ")
                                .split("")
                                .slice(0, 6);
                              arr[i] = val;
                              setOtp(arr.join("").trimEnd());
                              if (val && i < 5)
                                document
                                  .getElementById(`reg-otp-${i + 1}`)
                                  ?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !otp[i] && i > 0) {
                                document
                                  .getElementById(`reg-otp-${i - 1}`)
                                  ?.focus();
                              }
                            }}
                            className="form-control text-center fw-bold"
                            style={{
                              width: "46px",
                              height: "52px",
                              fontSize: "1.4rem",
                              borderRadius: "0.5rem",
                              border: "2px solid #e9ecef",
                              backgroundColor: "#f8f9fa",
                            }}
                          />
                        ))}
                      </div>
                      <p className="small text-muted mt-2 text-center">
                        Code sent to{" "}
                        <span className="fw-semibold">
                          {localStorage.getItem("registrationPhone")}
                        </span>
                      </p>
                    </div>

                    {/* Dev helper — shows OTP in non-production */}
                    {devOtp && (
                      <div className="alert alert-info py-2 small text-center">
                        <strong>Dev mode OTP:</strong> {devOtp}
                      </div>
                    )}

                    {error && (
                      <div className="alert alert-danger py-2 text-center">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || otp.replace(/\s/g, "").length !== 6}
                      className="btn cedi-btn-primary w-100 py-3 fw-semibold mb-3"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Verifying...
                        </>
                      ) : (
                        "Verify Code"
                      )}
                    </button>

                    <div className="d-flex justify-content-between">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("phone");
                          setOtp("");
                          setError("");
                          setDevOtp("");
                        }}
                        className="btn btn-link p-0 small"
                        style={{ color: "var(--cedi-blue)" }}
                      >
                        ← Change number
                      </button>
                      {resendTimer > 0 ? (
                        <span className="small text-muted">
                          Resend in {resendTimer}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          className="btn btn-link p-0 small"
                          style={{ color: "var(--cedi-blue)" }}
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
