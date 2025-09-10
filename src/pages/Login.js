import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Format phone number to include +233 prefix
  const formatPhoneNumber = (phoneNumber) => {
    // Remove any existing country code and non-numeric characters
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    // Remove +233 if it exists
    if (cleanPhone.startsWith('233')) {
      cleanPhone = cleanPhone.substring(3);
    }
    
    // Remove leading 0 if it exists
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    
    // Add +233 prefix
    return `+233${cleanPhone}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!phone || !pin) {
      setError('Please enter both phone number and PIN');
      toast.error('Please enter both phone number and PIN');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    
    try {
      // Format phone number with +233 prefix
      const formattedPhone = formatPhoneNumber(phone);
      
      const result = await login({
        phone: formattedPhone,
        pin: pin
      });
      
      if (result.success) {
        toast.success('Login successful! Welcome back.');
        navigate('/home');
      } else {
        setError(result.error || 'Invalid credentials');
        toast.error(result.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Login failed. Please check your connection and try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(numericValue);
  };

  return (
    <div className="cedi-gradient min-vh-100">
      <div className="container-fluid d-flex align-items-center justify-content-center min-vh-100 p-3">
        <div className="row w-100 justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-12 col-xl-12">
            <div className="card cedi-shadow border-0 rounded-4">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <div 
                    className="cedi-gradient-gold d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '16px' 
                    }}
                  >
                    <span className="text-white fw-bold fs-4">CEDI</span>
                  </div>
                  <h1 className="cedi-text-dark fw-bold mb-2" style={{ fontSize: '2rem' }}>Welcome Back</h1>
                  <p className="text-muted">Sign in to your CEDI account</p>
                </div>

                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label htmlFor="phone" className="form-label fw-medium text-dark">
                      Phone Number
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-telephone"></i>
                      </span>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your phone number"
                        required
                        className="form-control cedi-border border-start-0"
                        style={{ 
                          padding: '12px 16px',
                          borderRadius: '0 12px 12px 0',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="pin" className="form-label fw-medium text-dark">
                      PIN
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        type={showPin ? 'text' : 'password'}
                        id="pin"
                        value={pin}
                        onChange={(e) => handlePinChange(e.target.value)}
                        placeholder="Enter your 4-digit PIN"
                        maxLength="4"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        className="form-control cedi-border border-start-0"
                        style={{ 
                          padding: '12px 16px',
                          borderRadius: '0 12px 12px 0',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          fontSize: '1.2rem',
                          letterSpacing: showPin ? 'normal' : '0.3rem'
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary border-start-0"
                        onClick={() => setShowPin(!showPin)}
                        style={{ borderRadius: '0 12px 12px 0' }}
                      >
                        <i className={`bi ${showPin ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger text-center py-2">
                      <i className="bi bi-exclamation-circle me-2"></i>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn w-100 cedi-btn fw-semibold"
                    style={{ 
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '1rem'
                    }}
                  >
                    {loading ? (
                      <>
                        <i className="bi bi-arrow-clockwise spin me-2"></i>
                        Signing In...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Sign In
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center mt-4">
                  <p className="text-muted mb-2">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      className="btn btn-link cedi-text-blue fw-semibold p-0 text-decoration-none"
                    >
                      Sign Up
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-pin')}
                    className="btn btn-link text-muted p-0 text-decoration-none"
                    style={{ fontSize: '0.875rem' }}
                  >
                    Forgot PIN?
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

export default Login;