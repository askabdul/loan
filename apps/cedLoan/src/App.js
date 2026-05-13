import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";

// Import pages - Login and Registration
import Login from "./pages/Login";
import Register from "./pages/Register/Register";
import VerifyOTP from "./pages/Register/VerifyOTP";
import PersonalInfo from "./pages/Register/PersonalInfo";
import SetPin from "./pages/Register/SetPin";
import ForgotPin from "./pages/ForgotPin";
import KycGate from "./pages/LoanApplication/KycGate";

// Import main app pages
import Home from "./pages/Home/Home";
import History from "./pages/History/History";
import Profile from "./pages/Profile/Profile";
import LoanRateCalculation from "./pages/LoanRateCalculation/LoanRateCalculation";
import LoanExtension from "./pages/LoanExtension/LoanExtension";
import Notifications from "./pages/Notifications/Notifications";

// Import components
import BottomNavigation from "./components/BottomNavigation";
import ProtectedRoute from "./components/ProtectedRoute";
import ToastContainer from "./components/Toast/ToastContainer";

// Import contexts
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ConfigProvider } from "./contexts/ConfigContext";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <ConfigProvider>
            <Router>
              <div className="app-container">
                <Routes>
                  {/* Public Routes - Registration (4 steps, no KYC) */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/register/verify-otp" element={<VerifyOTP />} />
                  <Route
                    path="/register/personal-info"
                    element={<PersonalInfo />}
                  />
                  <Route path="/register/set-pin" element={<SetPin />} />
                  <Route path="/forgot-pin" element={<ForgotPin />} />

                  {/* Default "/" redirect */}
                  <Route path="/" element={<Navigate to="/home" replace />} />

                  {/* Protected Routes */}
                  <Route
                    path="/home"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <Home />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  {/* Loan Application with KYC Gate */}
                  <Route
                    path="/loan-application"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <KycGate />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />
                  {/* Legacy /apply route still works */}
                  <Route
                    path="/apply"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <KycGate />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <History />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <Profile />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/loan-rate-calculation"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <LoanRateCalculation />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/loan-extension/:loanId"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <LoanExtension />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <div className="page-container">
                          <Notifications />
                          <BottomNavigation />
                        </div>
                      </ProtectedRoute>
                    }
                  />

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
