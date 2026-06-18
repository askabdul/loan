import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const VerifyOTP = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const phone = localStorage.getItem("registrationPhone") || "";

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, otp: otpValue }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          data.message || "Invalid verification code. Please try again.",
        );
        return;
      }

      showToast("Phone number verified successfully!", "success");
      navigate("/register/personal-info");
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setError("");
    setDevOtp("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("New code sent!", "success");
        if (data.devOtp) setDevOtp(data.devOtp);
        const timer = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) {
              setCanResend(true);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(data.message || "Failed to resend code");
        setCanResend(true);
      }
    } catch {
      setError("Network error.");
      setCanResend(true);
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
                  <h1 className="cedi-title mb-2">Verify Phone</h1>
                  <p className="text-muted mb-1">
                    We've sent a 6-digit code to
                  </p>
                  <p className="fw-semibold">{phone}</p>
                </div>

                <form onSubmit={handleVerify}>
                  <div className="mb-4">
                    <label className="text-center d-block mb-3 fw-medium">
                      Enter Verification Code
                    </label>
                    <div className="d-flex justify-content-center gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          maxLength={1}
                          className="form-control text-center fw-bold"
                          style={{
                            width: "46px",
                            height: "52px",
                            fontSize: "1.4rem",
                            borderRadius: "0.5rem",
                          }}
                        />
                      ))}
                    </div>
                  </div>

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
                    disabled={loading || otp.join("").length !== 6}
                    className="btn btn-primary w-100 py-2 fw-semibold mb-3"
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
                      onClick={() => navigate("/register")}
                      className="btn btn-link p-0 small"
                    >
                      ← Change number
                    </button>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResend}
                        className="btn btn-link p-0 small"
                      >
                        Resend code
                      </button>
                    ) : (
                      <span className="small text-muted">
                        Resend in {resendTimer}s
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
