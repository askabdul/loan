import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import pages - Login and Registration
import Login from './pages/Login';
import Register from './pages/Register/Register';
import SetPin from './pages/Register/SetPin';
import VerifyOTP from './pages/Register/VerifyOTP';
import PersonalInfo from './pages/Register/PersonalInfo';
import WorkInfo from './pages/Register/WorkInfo';
import EducationInfo from './pages/Register/EducationInfo';
import EmergencyContacts from './pages/Register/EmergencyContacts';
import IdVerification from './pages/Register/IdVerification';
import ForgotPin from './pages/ForgotPin';

// Import main app pages
import Home from './pages/Home/Home';
import LoanApplication from './pages/LoanApplication/LoanApplication';
import History from './pages/History/History';
import Profile from './pages/Profile/Profile';
import LoanRateCalculation from './pages/LoanRateCalculation/LoanRateCalculation';
import LoanExtension from './pages/LoanExtension/LoanExtension';


// Import components
import BottomNavigation from './components/BottomNavigation';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/Toast/ToastContainer';

// Import contexts
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfigProvider } from './contexts/ConfigContext';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <ConfigProvider>
            <Router>
          <div className="app-container">
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/set-pin" element={<SetPin />} />
            <Route path="/personal-info" element={<PersonalInfo />} />
            <Route path="/work-info" element={<WorkInfo />} />
            <Route path="/education-info" element={<EducationInfo />} />
            <Route path="/emergency-contacts" element={<EmergencyContacts />} />
            <Route path="/id-verification" element={<IdVerification />} />
            <Route path="/forgot-pin" element={<ForgotPin />} />

            {/* Protected Routes */}
            <Route path="/home" element={
              <ProtectedRoute>
                <div className="page-container">
                  <Home />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            <Route path="/apply" element={
              <ProtectedRoute>
                <div className="page-container">
                  <LoanApplication />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            <Route path="/history" element={
              <ProtectedRoute>
                <div className="page-container">
                  <History />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <div className="page-container">
                  <Profile />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            <Route path="/loan-rate-calculation" element={
              <ProtectedRoute>
                <div className="page-container">
                  <LoanRateCalculation />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            <Route path="/loan-extension/:loanId" element={
              <ProtectedRoute>
                <div className="page-container">
                  <LoanExtension />
                  <BottomNavigation />
                </div>
              </ProtectedRoute>
            } />

            {/* Default redirect to login */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
          <ToastContainer />
            </div>
            </Router>
          </ConfigProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;