import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import CustomCaptcha from '../components/CustomCaptcha';
import { 
  FiUser, 
  FiLock, 
  FiEye, 
  FiEyeOff, 
  FiShield, 
  FiBarChart, 
  FiUsers, 
  FiCreditCard 
} from 'react-icons/fi';
import './Login.css';

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [captchaValue, setCaptchaValue] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const captchaRef = useRef(null);
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCaptchaError('');

    // Validate CAPTCHA using ref method
    if (captchaRef.current && !captchaRef.current.validate()) {
      setLoading(false);
      return;
    }

    // Only proceed with login if CAPTCHA is valid
    try {
      const result = await login(emailOrUsername, password);
      
      if (!result.success) {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      // Handle any unexpected errors
      setError('Login failed. Please check your credentials and try again.');
    }
    
    setLoading(false);
  };

  const handleCaptchaChange = (isValid, value) => {
    setCaptchaValid(isValid);
    setCaptchaValue(value);
    // Clear CAPTCHA error when user types
    if (captchaError) {
      setCaptchaError('');
    }
  };

  const handleCaptchaRefresh = () => {
    setCaptchaValid(false);
    setCaptchaValue('');
    setCaptchaError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <FiShield className="logo-icon" />
            <span className="logo-text">CediLoan</span>
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to access your admin dashboard</p>
        </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="emailOrUsername">Email or Username</label>
              <div className="input-wrapper">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  id="emailOrUsername"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="Enter your email or username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <FiLock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="form-group captcha-group">
              <label htmlFor="captcha">Verification Code</label>
              <CustomCaptcha
                ref={captchaRef}
                onCaptchaChange={handleCaptchaChange}
                onRefresh={handleCaptchaRefresh}
                error={captchaError}
                showError={!!captchaError}
              />
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={loading || !emailOrUsername || !password || !captchaValid}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : (
                <>
                  <FiShield />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
    </div>
  );
};

export default Login;