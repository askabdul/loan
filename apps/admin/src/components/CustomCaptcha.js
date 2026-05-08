import React, { useState, useEffect, useRef } from 'react';
import './CustomCaptcha.css';

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-icon">{type === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

const CustomCaptcha = React.forwardRef(({ onCaptchaChange, onRefresh, error, showError, validateOnSubmit }, ref) => {
  const [captchaText, setCaptchaText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [captchaExpired, setCaptchaExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  // Generate random captcha text
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Draw captcha on canvas
  const drawCaptcha = (text) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.3)`;
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }
    
    // Add noise dots
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.4)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw text
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textWidth = canvas.width / text.length;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = textWidth * i + textWidth / 2;
      const y = canvas.height / 2 + (Math.random() - 0.5) * 10;
      
      // Random color for each character
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)})`;
      
      // Random rotation
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.5);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  };

  // Initialize captcha
  const initializeCaptcha = () => {
    const newCaptcha = generateCaptcha();
    setCaptchaText(newCaptcha);
    setUserInput('');
    setCaptchaExpired(false);
    setTimeRemaining(60);
    setValidationError('');
    
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Start 60-second countdown
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setCaptchaExpired(true);
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setTimeout(() => drawCaptcha(newCaptcha), 100);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserInput(value);
    setValidationError(''); // Clear validation error when user types
    
    // Check if captcha is correct (but don't show error immediately)
    const isValid = value.toLowerCase() === captchaText.toLowerCase() && !captchaExpired;
    onCaptchaChange(isValid, value);
  };

  // Validate captcha (called from parent on form submission)
  const validateCaptcha = () => {
    if (captchaExpired) {
      setValidationError('Verification code has expired. Please refresh for a new code.');
      return false;
    }
    
    if (userInput.toLowerCase() !== captchaText.toLowerCase()) {
      setValidationError('Incorrect verification code. Please try again.');
      setShowToast(true);
      // Auto refresh after showing error
      setTimeout(() => {
        initializeCaptcha();
        setValidationError('');
      }, 2000);
      return false;
    }
    
    return true;
  };

  // Handle refresh
  const handleRefresh = () => {
    initializeCaptcha();
    setValidationError('');
    if (onRefresh) onRefresh();
  };

  // Expose validate function to parent
  React.useImperativeHandle(ref, () => ({
    validate: validateCaptcha
  }));

  useEffect(() => {
    initializeCaptcha();
    
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="custom-captcha">
        <div className="captcha-container">
          <canvas 
            ref={canvasRef} 
            width={200} 
            height={60} 
            className="captcha-canvas"
          />
          <button 
            type="button" 
            className="captcha-refresh" 
            onClick={handleRefresh}
            title="Refresh Captcha"
          >
            🔄
          </button>
        </div>
        <div className="captcha-input-wrapper">
          <input
            type="text"
            value={userInput}
            onChange={handleInputChange}
            placeholder="Enter verification code"
            className={`captcha-input ${captchaExpired ? 'expired' : ''}`}
            maxLength={6}
            autoComplete="off"
            disabled={captchaExpired}
          />
          <div className="captcha-timer">
            {!captchaExpired ? `${timeRemaining}s` : 'Expired'}
          </div>
        </div>
      </div>
      
      {showToast && (
        <Toast
          message={validationError || error}
          type="error"
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
});

export default CustomCaptcha;