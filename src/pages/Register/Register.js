import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import phoneAuthService from '../../services/phoneAuth';

const Register = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      phoneAuthService.cleanup();
    };
  }, []);

  // Resend timer countdown
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(timer => timer - 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!phone) {
      setError('Please enter your phone number');
      setLoading(false);
      return;
    }

    if (phone.length < 10) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    try {
      // Format phone number to international format
      const formattedPhone = phoneAuthService.formatPhoneNumber(phone);
      
      // Check if phone number already exists in database
      const phoneExists = await checkPhoneExists(formattedPhone);
      if (phoneExists) {
        setError('An account with this phone number already exists. Please login instead.');
        showToast('An account with this phone number already exists. Please login instead.', 'error');
        setLoading(false);
        return;
      }
      
      // Send verification code using Firebase
      await phoneAuthService.sendVerificationCode(formattedPhone, 'recaptcha-container');
      
      showToast('Verification code sent successfully!', 'success');
      localStorage.setItem('registrationPhone', formattedPhone);
      setStep('otp');
      setResendTimer(60); // 60 seconds countdown
    } catch (error) {

      setError(error.message || 'Failed to send verification code');
      showToast(error.message || 'Failed to send verification code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      setLoading(false);
      return;
    }

    try {
      // Verify OTP using Firebase
      const result = await phoneAuthService.verifyCode(otp);
      
      if (result.success) {
        // Check if phone number already exists in database
        const formattedPhone = localStorage.getItem('registrationPhone') || phoneAuthService.formatPhoneNumber(phone);
        const phoneExists = await checkPhoneExists(formattedPhone);
        
        if (phoneExists) {
          setError('This phone number is already registered. Please login instead.');
          showToast('Phone number already registered. Please login.', 'error');
          setLoading(false);
          return;
        }
        
        showToast('Phone number verified successfully!', 'success');
        // Store user info and navigate to next step
        localStorage.setItem('firebaseUser', JSON.stringify(result.user));
        localStorage.setItem('registrationData', JSON.stringify({ phone, verified: true }));
        navigate('/set-pin');
      }
    } catch (error) {

      setError(error.message || 'Invalid verification code');
      showToast(error.message || 'Invalid verification code', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Function to check if phone number exists in database
  const checkPhoneExists = async (phoneNumber) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/check-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      
      const data = await response.json();
      return data.exists;
    } catch (error) {

      return false;
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    setError('');
    setLoading(true);
    
    try {
      const formattedPhone = phoneAuthService.formatPhoneNumber(phone);
      await phoneAuthService.resendVerificationCode(formattedPhone, 'recaptcha-container');
      
      showToast('Verification code resent successfully!', 'success');
      setResendTimer(60);
    } catch (error) {

      setError(error.message || 'Failed to resend verification code');
      showToast(error.message || 'Failed to resend verification code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtp('');
    setError('');
    phoneAuthService.cleanup();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cedi-blue to-cedi-dark flex items-center justify-center px-4"style={{ padding:"13rem"}}>
      <div className="bg-white rounded-3xl shadow-cedi p-8 w-full max-w-md border border-cedi-light" style={{ borderRadius:"1rem"}}>
        <div className="text-center mb-8">
          {/* <div className="w-16 h-16 bg-gradient-to-r from-cedi-blue to-cedi-gold rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{backgroundColor:"none"}} >
            <span className="text-white font-bold text-xl">CEDI</span>
           
          </div> */}
          
          <h1 className="text-3xl font-bold text-cedi-dark mb-2">Create Account</h1>
          {/* <p className="text-gray-600">Join CEDI and start your loan journey</p> */}
        </div>

        <form onSubmit={step === 'phone' ? handleSendCode : handleVerifyOTP} className="space-y-10" style={{ alignItems:"center", justifyContent:"center", textAlign:"center"}}>
          {step === 'phone' ? (
            <div>
              <div> <label className="block text-sm font-medium text-gray-700 mb-2" style={{fontWeight:"bold",al:""}}>
                Phone Number
              </label></div>
              <div>  
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-100% px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cedi-blue focus:border-cedi-blue transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Enter your phone number"
                required 
               style={{borderRadius:"1rem", width:"85%",}}
              /></div>
           
              <p className="text-xs text-gray-500 mt-1">
                We'll send you a verification code
              </p>
            </div>
          ) : (
            <div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" style={{fontWeight:"bold"}}>
                  Verification Code
                </label>
              </div>
              <div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-100% px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cedi-blue focus:border-cedi-blue transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter 6-digit code"
                  maxLength="6"
                  required
                  style={{borderRadius:"1rem", width:"85%"}}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Code sent to {phone}
              </p>
              <div className="flex justify-between items-center mt-4">
                <button
                  type="button"
                  onClick={handleBackToPhone}
                  className="text-cedi-blue hover:text-cedi-dark font-semibold transition-colors duration-200 bg-transparent border-none p-0 cursor-pointer"
                >
                  ← Back
                </button>
                {resendTimer > 0 ? (
                  <span className="text-gray-500 text-sm">
                    Resend in {resendTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-cedi-blue hover:text-cedi-dark font-semibold transition-colors duration-200 bg-transparent border-none p-0 cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}
         
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cedi-blue to-cedi-dark text-white py-3 rounded-xl font-semibold hover:from-cedi-dark hover:to-cedi-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
          style={{borderRadius:"1rem", width:"85%", margin:"auto", border:"none"}}>
            {loading ? (step === 'phone' ? 'Sending Code...' : 'Verifying...') : (step === 'phone' ? 'Continue' : 'Verify Code')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            
          </p>
          <button
              onClick={() => navigate('/login')}
              className="text-cedi-blue hover:text-cedi-dark font-semibold transition-colors duration-200"
           style={{borderRadius:"0.5rem", width:"60%", margin:"auto", border:"none", fontWeight:"bold"}} >
              Sign In
            </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center" style={{fontWeight:"bold", padding:"1rem"}}>
          By continuing, you agree to our{' '}
          <button type="button" className="text-cedi-blue hover:underline transition-colors duration-200 bg-transparent border-none p-0 cursor-pointer"style={{fontWeight:"bold", padding:"1rem", border:"none"}}>
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="text-cedi-blue hover:underline transition-colors duration-200 bg-transparent border-none p-0 cursor-pointer" style={{fontWeight:"bold", padding:"1rem", border:"none"}}>
            Privacy Policy
          </button>
        </div>
      </div>

      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );
};

export default Register;