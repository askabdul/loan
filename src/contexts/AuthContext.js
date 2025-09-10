import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showError, showSuccess, showInfo } = useToast();

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await authAPI.getUser();
          if (response.success) {
            setUser(response.user);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await authAPI.login(credentials);
      
      if (response.success) {
        localStorage.setItem('token', response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        showSuccess('Login successful!');
        return { success: true, user: response.user };
      }
    } catch (error) {
      console.error('Login error:', error);
      showError(error.message || 'Login failed');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await authAPI.register(userData);
      
      if (response.success) {
        localStorage.setItem('token', response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        showSuccess('Registration successful!');
        return { success: true, user: response.user };
      }
    } catch (error) {
      console.error('Registration error:', error);
      showError(error.message || 'Registration failed');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      showInfo('Logged out successfully');
    }
  };

  const setPin = async (pin) => {
    try {
      const response = await authAPI.setPin(pin);
      
      if (response.success) {
        // Update user state to reflect PIN is set
        setUser(prev => ({ ...prev, hasPinSet: true }));
        showSuccess('PIN set successfully!');
        return { success: true };
      }
    } catch (error) {
      console.error('Set PIN error:', error);
      showError(error.message || 'Failed to set PIN');
      return { success: false, error: error.message };
    }
  };

  const verifyPin = async (pin) => {
    try {
      const response = await authAPI.verifyPin(pin);
      
      if (response.success) {
        showSuccess('PIN verified successfully!');
        return { success: true };
      }
    } catch (error) {
      console.error('Verify PIN error:', error);
      showError(error.message || 'Invalid PIN');
      return { success: false, error: error.message };
    }
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getUser();
      if (response.success) {
        setUser(response.user);
        return response.user;
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // If token is invalid, logout user
      if (error.message.includes('token') || error.message.includes('authorized')) {
        logout();
      }
    }
  };

  const sendOTP = async (phoneNumber) => {
    try {
      const response = await authAPI.sendOTP(phoneNumber);
      if (response.success) {
        showSuccess('OTP sent successfully!');
        return { success: true };
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      showError(error.message || 'Failed to send OTP');
      return { success: false, error: error.message };
    }
  };

  const verifyOTP = async (phoneNumber, otp) => {
    try {
      const response = await authAPI.verifyOTP(phoneNumber, otp);
      if (response.success) {
        showSuccess('OTP verified successfully!');
        return { success: true };
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      showError(error.message || 'Invalid OTP');
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    setPin,
    verifyPin,
    updateUser,
    refreshUser,
    sendOTP,
    verifyOTP,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;