import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  ThemeProvider,
  createTheme,
  StyledEngineProvider,
} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./contexts/AuthContext";
import { TabProvider } from "./contexts/TabContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SimpleDashboard from "./pages/SimpleDashboard";
import UserList from "./pages/UserList";
import FindUser from "./pages/FindUser";
import ManualRegistration from "./pages/ManualRegistration";
import UserManagement from "./pages/UserManagement";
import UserLevelAssignment from "./components/UserLevelAssignment";
import CreditReviewList from "./pages/CreditReviewList";
import PreCollectionList from "./pages/PreCollection/PreCollectionList";
import PreCollectionAllList from "./pages/PreCollection/PreCollectionAllList";
import PreCollectionRank1 from "./pages/PreCollection/Rank1";
import PreCollectionRank2 from "./pages/PreCollection/Rank2";
import PreCollectionPaymentRecord from "./pages/PreCollection/PaymentRecord";
import CollectionList from "./pages/Collection/CollectionList";
import CollectionRank1 from "./pages/Collection/Rank1";
import CollectionRank2 from "./pages/Collection/Rank2";
import CollectionPaymentRecord from "./pages/Collection/PaymentRecord";
import OfficerManagement from "./pages/Collection/OfficerManagement";
import Configuration from "./pages/Configuration";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import ContentManagement from "./pages/ContentManagement";
import AdminManagement from "./pages/AdminManagement";
import PaymentManagement from "./pages/PaymentManagement";
import NotificationManagement from "./pages/NotificationManagement";
import RoleManagement from "./pages/RoleManagement";
import AppConfiguration from "./pages/AppConfiguration";
import LoanConfiguration from "./pages/LoanConfiguration";
import LoanSettings from "./pages/LoanSettings";
import LoanRateCalculation from "./pages/LoanRateCalculation";
import AppBranding from "./pages/AppBranding";
import ContactInfo from "./pages/ContactInfo";
import FAQ from "./pages/FAQ";
import TermsConditions from "./pages/TermsConditions";
import LoanExtension from "./pages/LoanExtension";
import LoanDetails from "./pages/LoanDetails";
import OrderRepayment from "./pages/OrderRepayment";
import OrderRepaymentReview from "./pages/OrderRepaymentReview";
import OrderLending from "./pages/OrderLending";
import OrderList from "./pages/OrderList";
import CreditReviewAssign from "./pages/CreditReviewAssign";
import CreditReviewCount from "./pages/CreditReviewCount";

import "./App.css";
import "react-toastify/dist/ReactToastify.css";

// Listens for 401 events from api.js interceptor and navigates without a hard reload
function UnauthorizedHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = () => navigate("/login", { replace: true });
    window.addEventListener("admin:unauthorized", handler);
    return () => window.removeEventListener("admin:unauthorized", handler);
  }, [navigate]);
  return null;
}

// Create a default theme
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <TabProvider>
              <UnauthorizedHandler />
              <div className="App">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Routes>
                            <Route path="/" element={<SimpleDashboard />} />
                            <Route
                              path="/dashboard"
                              element={
                                <Navigate
                                  to="/data-statistics/dashboard"
                                  replace
                                />
                              }
                            />
                            {/* User Management Routes */}
                            <Route
                              path="/user"
                              element={<Navigate to="/user/list" replace />}
                            />
                            <Route path="/user/list" element={<UserList />} />
                            <Route path="/user/find" element={<FindUser />} />
                            <Route
                              path="/user/manual-registration"
                              element={<ManualRegistration />}
                            />
                            <Route
                              path="/user/management"
                              element={<UserManagement />}
                            />
                            <Route
                              path="/user/level-assignment"
                              element={<UserLevelAssignment />}
                            />

                            {/* Order Management Routes */}
                            <Route
                              path="/order"
                              element={
                                <div className="page-placeholder">
                                  Order Management - Coming Soon
                                </div>
                              }
                            />
                            <Route path="/order/list" element={<OrderList />} />
                            <Route
                              path="/order/lending"
                              element={<OrderLending />}
                            />
                            <Route
                              path="/order/payment-failed"
                              element={
                                <div className="page-placeholder">
                                  Payment Failed Orders - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/loan-details"
                              element={<LoanDetails />}
                            />
                            <Route
                              path="/order/repayment-plan"
                              element={
                                <div className="page-placeholder">
                                  Repayment Plan - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/repayment-details"
                              element={
                                <div className="page-placeholder">
                                  Repayment Details - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/repay-pending"
                              element={
                                <div className="page-placeholder">
                                  Pending Repayments - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/repayment"
                              element={<OrderRepayment />}
                            />
                            <Route
                              path="/order/ussd"
                              element={
                                <div className="page-placeholder">
                                  USSD Orders - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/extension"
                              element={<LoanExtension />}
                            />
                            <Route
                              path="/order/review-repayment"
                              element={<OrderRepaymentReview />}
                            />
                            <Route
                              path="/order/callback-order"
                              element={
                                <div className="page-placeholder">
                                  Callback Orders - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/order/cant-settled"
                              element={
                                <div className="page-placeholder">
                                  Unsettled Orders - Coming Soon
                                </div>
                              }
                            />

                            {/* Fund Management Routes */}
                            <Route
                              path="/fund-management"
                              element={
                                <div className="page-placeholder">
                                  Fund Management - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/payment-order"
                              element={
                                <div className="page-placeholder">
                                  Payment Orders - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/payment-review"
                              element={
                                <div className="page-placeholder">
                                  Payment Review - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/payments"
                              element={<PaymentManagement />}
                            />
                            <Route
                              path="/fund-management/bill-verification"
                              element={
                                <div className="page-placeholder">
                                  Bill Verification - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/airtime"
                              element={
                                <div className="page-placeholder">
                                  Airtime Management - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/airtime-review"
                              element={
                                <div className="page-placeholder">
                                  Airtime Review - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/batch-payment-apply"
                              element={
                                <div className="page-placeholder">
                                  Batch Payments - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/fund-management/airtime-stat"
                              element={
                                <div className="page-placeholder">
                                  Airtime Statistics - Coming Soon
                                </div>
                              }
                            />

                            {/* Notification Management Routes */}
                            <Route
                              path="/notifications"
                              element={<NotificationManagement />}
                            />
                            <Route path="/roles" element={<RoleManagement />} />

                            {/* Credit Review Routes */}
                            <Route
                              path="/credit-review"
                              element={
                                <Navigate to="/credit-review/list" replace />
                              }
                            />
                            <Route
                              path="/credit-review/shift-list"
                              element={
                                <div className="page-placeholder">
                                  Credit Review Shifts - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/credit-review/assign"
                              element={<CreditReviewAssign />}
                            />
                            <Route
                              path="/credit-review/list"
                              element={<CreditReviewList />}
                            />
                            <Route
                              path="/credit-review/count"
                              element={<CreditReviewCount />}
                            />

                            {/* Pre-collection Routes */}
                            <Route
                              path="/pre-collection"
                              element={
                                <div className="page-placeholder">
                                  Pre-collection Management - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/shift-list"
                              element={
                                <div className="page-placeholder">
                                  Pre-collection Shifts - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/prc-assign"
                              element={
                                <div className="page-placeholder">
                                  Pre-collection Assignment - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/all-list"
                              element={<PreCollectionAllList />}
                            />
                            <Route
                              path="/pre-collection/list"
                              element={<PreCollectionList />}
                            />
                            <Route
                              path="/pre-collection/prc-repayment"
                              element={
                                <div className="page-placeholder">
                                  Pre-collection Repayment - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/monitor-center"
                              element={
                                <div className="page-placeholder">
                                  Pre-collection Monitor - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/rank1"
                              element={<PreCollectionRank1 />}
                            />
                            <Route
                              path="/pre-collection/rank2"
                              element={<PreCollectionRank2 />}
                            />
                            <Route
                              path="/pre-collection/prc-colrate"
                              element={
                                <div className="page-placeholder">
                                  Collection Rate Analytics - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/app-usage"
                              element={
                                <div className="page-placeholder">
                                  App Usage Analytics - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/monitor-center-2"
                              element={
                                <div className="page-placeholder">
                                  Advanced Monitor - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/hand-cases"
                              element={
                                <div className="page-placeholder">
                                  Manual Cases - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/pre-collection/payment-record"
                              element={<PreCollectionPaymentRecord />}
                            />

                            {/* Collection Routes */}
                            <Route
                              path="/collection"
                              element={
                                <div className="page-placeholder">
                                  Collection Management - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/shift-list"
                              element={
                                <div className="page-placeholder">
                                  Collection Shifts - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/col-assign"
                              element={
                                <div className="page-placeholder">
                                  Collection Assignment - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/list"
                              element={<CollectionList />}
                            />
                            <Route
                              path="/collection/col-repayment"
                              element={
                                <div className="page-placeholder">
                                  Collection Repayment - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/monitor-center"
                              element={
                                <div className="page-placeholder">
                                  Collection Monitor - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/rank1"
                              element={<CollectionRank1 />}
                            />
                            <Route
                              path="/collection/rank2"
                              element={<CollectionRank2 />}
                            />
                            <Route
                              path="/collection/app-usage"
                              element={
                                <div className="page-placeholder">
                                  Collection App Usage - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/monitor-center-2"
                              element={
                                <div className="page-placeholder">
                                  Advanced Collection Monitor - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/hand-cases"
                              element={
                                <div className="page-placeholder">
                                  Manual Collection Cases - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/collection/payment-record"
                              element={<CollectionPaymentRecord />}
                            />
                            <Route
                              path="/collection/officers"
                              element={<OfficerManagement />}
                            />

                            {/* Other Routes */}
                            <Route
                              path="/marketing"
                              element={
                                <div className="page-placeholder">
                                  Marketing Management - Coming Soon
                                </div>
                              }
                            />
                            <Route
                              path="/overtime-message"
                              element={
                                <div className="page-placeholder">
                                  Overtime Messages - Coming Soon
                                </div>
                              }
                            />
                            <Route path="/config" element={<Configuration />} />
                            <Route
                              path="/app-config"
                              element={<AppConfiguration />}
                            />
                            <Route
                              path="/loan-settings"
                              element={<LoanSettings />}
                            />
                            <Route
                              path="/loan-configuration"
                              element={<LoanConfiguration />}
                            />
                            <Route
                              path="/loan-rate-calculation"
                              element={<LoanRateCalculation />}
                            />
                            <Route
                              path="/app-branding"
                              element={<AppBranding />}
                            />
                            <Route
                              path="/contact-info"
                              element={<ContactInfo />}
                            />
                            <Route path="/faq" element={<FAQ />} />
                            <Route
                              path="/terms-conditions"
                              element={<TermsConditions />}
                            />

                            <Route
                              path="/content"
                              element={<ContentManagement />}
                            />
                            <Route
                              path="/admin-management"
                              element={<AdminManagement />}
                            />

                            {/* Data Statistics Routes */}
                            <Route
                              path="/data-statistics"
                              element={
                                <Navigate
                                  to="/data-statistics/dashboard"
                                  replace
                                />
                              }
                            />
                            <Route
                              path="/data-statistics/dashboard"
                              element={<Dashboard />}
                            />

                            <Route
                              path="/system"
                              element={
                                <div className="page-placeholder">
                                  System Management - Coming Soon
                                </div>
                              }
                            />
                          </Routes>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            </TabProvider>
          </Router>
        </AuthProvider>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          style={{
            fontSize: "14px",
            maxWidth: "300px",
          }}
          toastStyle={{
            minHeight: "50px",
            padding: "8px 12px",
          }}
        />
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export default App;
