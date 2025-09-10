import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const ForgotPin = () => {
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'newPin'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  // Removed demo OTP storage - should rely on backend verification
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/reset-pin-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStep('otp');
        toast.success('OTP sent to your phone number');
      } else {
        setError(data.message || 'Failed to send OTP');
        toast.error(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setError('Failed to send OTP. Please try again.');
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!otp) {
      setError('Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, otp }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStep('newPin');
        toast.success('OTP verified successfully');
      } else {
        setError(data.message || 'Invalid OTP');
        toast.error(data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setError('Failed to verify OTP. Please try again.');
      toast.error('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!newPin || !confirmPin) {
      setError('Please enter and confirm your new PIN');
      return;
    }

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Check for weak PINs
    const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];
    if (weakPins.includes(newPin)) {
      setError('Please choose a stronger PIN');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/reset-pin-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, otp, newPin }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('PIN reset successfully!');
        navigate('/login');
      } else {
        setError(data.message || 'Failed to reset PIN');
        toast.error(data.message || 'Failed to reset PIN');
      }
    } catch (error) {
      console.error('Reset PIN error:', error);
      setError('Failed to reset PIN. Please try again.');
      toast.error('Failed to reset PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value, isConfirm = false) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    if (isConfirm) {
      setConfirmPin(numericValue);
    } else {
      setNewPin(numericValue);
    }
  };

  const handleOtpChange = (value) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(numericValue);
  };

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
                  <h1 className="cedi-title mb-2">
                    {step === 'phone' && 'Reset PIN'}
                    {step === 'otp' && 'Verify OTP'}
                    {step === 'newPin' && 'Set New PIN'}
                  </h1>
                  <p className="text-muted">
                    {step === 'phone' && 'Enter your phone number to reset your PIN'}
                    {step === 'otp' && `Enter the OTP sent to ${phone}`}
                    {step === 'newPin' && 'Create a new 4-digit PIN'}
                  </p>
                </div>

                {error && (
                  <div className="alert alert-danger text-center py-2 mb-3">
                    {error}
                  </div>
                )}

                {/* Removed demo OTP display - production app should not show OTP */}

                {step === 'phone' && (
                  <form onSubmit={handleSendOtp}>
                    <div className="mb-3">
                      <label htmlFor="phone" className="form-label fw-medium text-dark">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="form-control cedi-form-input"
                        placeholder="Enter your phone number"
                        required
                        style={{ borderRadius: '1rem', padding: '0.75rem' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn cedi-btn-primary w-100 py-3 fw-semibold btn-lg"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Sending OTP...
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </button>
                  </form>
                )}

                {step === 'otp' && (
                  <form onSubmit={handleVerifyOtp}>
                    <div className="mb-3">
                      <label htmlFor="otp" className="form-label fw-medium text-dark">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        id="otp"
                        value={otp}
                        onChange={(e) => handleOtpChange(e.target.value)}
                        className="form-control cedi-form-input text-center fw-bold"
                        placeholder="Enter 6-digit OTP"
                        maxLength="6"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', padding: '0.75rem', borderRadius: '1rem' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="btn cedi-btn-primary w-100 py-3 fw-semibold btn-lg"
                    >
                      Verify OTP
                    </button>
                  </form>
                )}

                {step === 'newPin' && (
                  <form onSubmit={handleResetPin}>
                    <div className="mb-3">
                      <label htmlFor="newPin" className="form-label fw-medium text-dark">
                        New PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        id="newPin"
                        value={newPin}
                        onChange={(e) => handlePinChange(e.target.value)}
                        className="form-control cedi-pin-input text-center fw-bold"
                        placeholder="••••"
                        maxLength="4"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', padding: '0.75rem', borderRadius: '1rem' }}
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="confirmPin" className="form-label fw-medium text-dark">
                        Confirm New PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        id="confirmPin"
                        value={confirmPin}
                        onChange={(e) => handlePinChange(e.target.value, true)}
                        className="form-control cedi-pin-input text-center fw-bold"
                        placeholder="••••"
                        maxLength="4"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', padding: '0.75rem', borderRadius: '1rem' }}
                      />
                    </div>

                    <div className="mb-3 form-check">
                      <input
                        type="checkbox"
                        className="form-check-input cedi-checkbox"
                        id="showPin"
                        checked={showPin}
                        onChange={(e) => setShowPin(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="showPin">
                        Show PIN
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
                      className="btn cedi-btn-primary w-100 py-3 fw-semibold btn-lg"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Resetting PIN...
                        </>
                      ) : (
                        'Reset PIN'
                      )}
                    </button>
                  </form>
                )}

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 'otp') {
                        setStep('phone');
                      } else if (step === 'newPin') {
                        setStep('otp');
                      } else {
                        navigate('/login');
                      }
                    }}
                    className="btn btn-link cedi-secondary-link p-0 btn-sm me-3"
                  >
                    {step === 'phone' ? 'Back to Login' : 'Back'}
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

export default ForgotPin;