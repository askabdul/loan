import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const VerifyOTP = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const { verifyOTP, sendOTP } = useAuth();
  const { showToast } = useToast();

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

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    
    try {
      const phone = localStorage.getItem('registrationPhone');
      const result = await verifyOTP(phone, otpValue);
      
      if (result.success) {
        localStorage.setItem('phoneVerified', 'true');
        navigate('/set-pin');
      } else {
        setError(result.error || 'Invalid OTP');
      }
    } catch (error) {
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    
    setCanResend(false);
    setResendTimer(60);
    setError('');
    
    try {
      const phone = localStorage.getItem('registrationPhone');
      const result = await sendOTP(phone);
      
      if (result.success) {
        showToast('New OTP sent successfully!', 'success');
    
        if (result.otp) {
          // OTP logged for development
        }
      } else {
        setError(result.error || 'Failed to resend OTP');
        setCanResend(true);
        setResendTimer(0);
        return;
      }
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
      setCanResend(true);
      setResendTimer(0);
      return;
    }
    
    // Restart timer
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
  };

  const phone = localStorage.getItem('registrationPhone') || 'your phone';

  return (
    <div className="cedi-bg-gradient d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', padding: '1rem' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-12 col-xl-12">
            <div className="card cedi-card shadow-lg border-0">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="cedi-logo-container mx-auto mb-3">
                    <span className="cedi-logo-text">QUICKMULA</span>
                  </div>
                  <h1 className="cedi-title mb-2">Verify Phone</h1>
                  <p className="text-muted mb-2">
                    We've sent a 6-digit code to
                  </p>
                  <p className="cedi-phone-display">{phone}</p>
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
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="form-control cedi-otp-input text-center fw-bold"
                          maxLength="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          style={{ width: '3rem', height: '3rem', fontSize: '1.25rem' }}
                        />
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger text-center py-2 mb-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn cedi-btn-primary w-100 py-3 fw-semibold btn-lg"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-muted mb-2">
                    Didn't receive the code?
                  </p>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="btn btn-link cedi-link-btn p-0 fw-semibold"
                    >
                      Resend Code
                    </button>
                  ) : (
                    <p className="text-muted">
                      Resend in {resendTimer}s
                    </p>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="btn btn-link cedi-secondary-link p-0 btn-sm"
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;