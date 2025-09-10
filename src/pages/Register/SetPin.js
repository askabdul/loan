import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SetPin = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const navigate = useNavigate();

  const handleSetPin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!pin || !confirmPin) {
      setError('Please enter and confirm your PIN');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    // Check for weak PINs
    const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];
    if (weakPins.includes(pin)) {
      setError('Please choose a stronger PIN');
      return;
    }

    setLoading(true);
    
    try {
      // Get phone number from localStorage
      const phoneNumber = localStorage.getItem('registrationPhone');
      
      if (!phoneNumber) {
        setError('Phone number not found. Please start registration again.');
        setLoading(false);
        return;
      }
      
      // Save PIN to localStorage
      localStorage.setItem('userPin', pin);
      
      // Navigate to personal info form
      navigate('/personal-info');
    } catch (error) {

      setError('Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value, isConfirm = false) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    if (isConfirm) {
      setConfirmPin(numericValue);
    } else {
      setPin(numericValue);
    }
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
                  <h1 className="cedi-title mb-2">Set Your PIN</h1>
                  <p className="text-muted">
                    Create a 4-digit PIN to secure your account
                  </p>
                </div>

                <form onSubmit={handleSetPin}>
                  <div className="mb-3">
                    <label htmlFor="pin" className="form-label fw-medium text-dark">
                      Create PIN
                    </label>
                    <input
                      type={showPin ? 'text' : 'password'}
                      id="pin"
                      value={pin}
                      onChange={(e) => handlePinChange(e.target.value)}
                      className="form-control cedi-pin-input text-center fw-bold"
                      placeholder="••••"
                      maxLength="4"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', padding: '0.75rem',borderRadius:"1rem", width:"100%" }}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmPin" className="form-label fw-medium text-dark">
                      Confirm PIN
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
                      style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', padding: '0.75rem',borderRadius:"1rem", width:"100%" }}
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

                  {error && (
                    <div className="alert alert-danger text-center py-2 mb-3">
                      {error}
                    </div>
                  )}

                  <div className="cedi-info-box mb-4">
                    <h6 className="fw-medium text-dark mb-2">PIN Security Tips:</h6>
                    <ul className="small text-muted mb-0" style={{ paddingLeft: '1rem' }}>
                      <li>Don't use obvious combinations like 1234 or 0000</li>
                      <li>Don't use your birth year or phone digits</li>
                      <li>Keep your PIN private and secure</li>
                    </ul>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
                    className="btn cedi-btn-primary w-100 py-3 fw-semibold btn-lg"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Setting PIN...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/verify-otp')}
                    className="btn btn-link cedi-secondary-link p-0 btn-sm"
                  >
                    Back to Verification
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

export default SetPin;