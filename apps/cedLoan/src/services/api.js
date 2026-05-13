import configAPI from "./configAPI";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Helper function to create headers
const createHeaders = (includeAuth = true) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    // Backend wraps errors as { error: { message } } or { message } — handle both
    const message =
      data.message ||
      data.error?.message ||
      `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
};

// Auth API
export const authAPI = {
  sendOTP: async (phoneNumber) => {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify({ phoneNumber }),
    });
    return handleResponse(response);
  },

  verifyOTP: async (phoneNumber, otp) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify({ phoneNumber, otp }),
    });
    return handleResponse(response);
  },

  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify(credentials),
    });
    return handleResponse(response);
  },

  setPin: async (pin) => {
    const response = await fetch(`${API_BASE_URL}/auth/set-pin`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify({ pin }),
    });
    return handleResponse(response);
  },

  verifyPin: async (pin) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify({ pin }),
    });
    return handleResponse(response);
  },

  getUser: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  registerComplete: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register/complete`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  checkPhone: async (phone) => {
    const response = await fetch(`${API_BASE_URL}/auth/check-phone`, {
      method: "POST",
      headers: createHeaders(false),
      body: JSON.stringify({ phone }),
    });
    return handleResponse(response);
  },

  logout: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },
};

// Users API
export const usersAPI = {
  updatePersonalInfo: async (personalInfo) => {
    const response = await fetch(`${API_BASE_URL}/users/personal-info`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(personalInfo),
    });
    return handleResponse(response);
  },

  updateWorkInfo: async (workInfo) => {
    const response = await fetch(`${API_BASE_URL}/users/work-info`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(workInfo),
    });
    return handleResponse(response);
  },

  updateEducationInfo: async (educationInfo) => {
    const response = await fetch(`${API_BASE_URL}/users/education-info`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(educationInfo),
    });
    return handleResponse(response);
  },

  updateEmergencyContacts: async (emergencyContacts) => {
    const response = await fetch(`${API_BASE_URL}/users/emergency-contacts`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify({ emergencyContacts }),
    });
    return handleResponse(response);
  },

  updateIdVerification: async (idInfo) => {
    const response = await fetch(`${API_BASE_URL}/users/id-verification`, {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(idInfo),
    });
    return handleResponse(response);
  },

  completeRegistration: async () => {
    const response = await fetch(
      `${API_BASE_URL}/users/complete-registration`,
      {
        method: "POST",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  submitKyc: async (kycData) => {
    const response = await fetch(`${API_BASE_URL}/users/me/kyc`, {
      method: "PATCH",
      headers: createHeaders(),
      body: JSON.stringify(kycData),
    });
    return handleResponse(response);
  },

  updateProfile: async (profileData) => {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "PATCH",
      headers: createHeaders(),
      body: JSON.stringify(profileData),
    });
    return handleResponse(response);
  },

  getProfile: async () => {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },
};

// Loans API
export const loansAPI = {
  activeCheck: async () => {
    const response = await fetch(`${API_BASE_URL}/loans/active-check`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  applyForLoan: async (loanData) => {
    const response = await fetch(`${API_BASE_URL}/loans/apply`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify(loanData),
    });
    return handleResponse(response);
  },

  getLoans: async (page = 1, limit = 10, status = "") => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/loans?${params}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  getLoanById: async (loanId) => {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  cancelLoan: async (loanId) => {
    const response = await fetch(`${API_BASE_URL}/loans/${loanId}/cancel`, {
      method: "PUT",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  requestDisbursement: async (loanId) => {
    const response = await fetch(
      `${API_BASE_URL}/loans/${loanId}/request-disbursement`,
      {
        method: "POST",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  confirmReceipt: async (loanId) => {
    const response = await fetch(
      `${API_BASE_URL}/loans/${loanId}/confirm-receipt`,
      {
        method: "POST",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  calculateLoan: async (amount, duration) => {
    const response = await fetch(
      `${API_BASE_URL}/loans/calculate/${amount}/${duration}`,
      {
        method: "GET",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  getLoanStats: async () => {
    const response = await fetch(`${API_BASE_URL}/loans/stats/summary`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  getUserLoans: async (page = 1, limit = 10, status = "") => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/loans/my-loans?${params}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  // Loan Extension APIs
  submitExtensionRequest: async (extensionData) => {
    const formData = new FormData();
    formData.append("loanId", extensionData.loanId);
    formData.append("extensionDays", extensionData.extensionDays);
    if (extensionData.popFile) {
      formData.append("popFile", extensionData.popFile);
    }

    const response = await fetch(`${API_BASE_URL}/loan-extension/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: formData,
    });
    return handleResponse(response);
  },

  calculateExtensionFee: async (loanId, extensionDays) => {
    const response = await fetch(
      `${API_BASE_URL}/loan-extension/calculate-fee`,
      {
        method: "POST",
        headers: createHeaders(),
        body: JSON.stringify({ loanId, extensionDays }),
      },
    );
    return handleResponse(response);
  },

  getExtensionStatus: async (loanId) => {
    const response = await fetch(
      `${API_BASE_URL}/loan-extension/status/${loanId}`,
      {
        method: "GET",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  getExtensionHistory: async (loanId) => {
    const response = await fetch(
      `${API_BASE_URL}/loan-extension/history/${loanId}`,
      {
        method: "GET",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },
};

// Payments API
export const paymentsAPI = {
  initiatePayment: async (paymentData) => {
    const response = await fetch(`${API_BASE_URL}/payments/initiate`, {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify(paymentData),
    });
    return handleResponse(response);
  },

  getPaymentStatus: async (paymentId) => {
    const response = await fetch(
      `${API_BASE_URL}/payments/status/${paymentId}`,
      {
        method: "GET",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  getPaymentHistory: async (page = 1, limit = 10, status = "") => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/payments/history?${params}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  retryPayment: async (paymentId) => {
    const response = await fetch(
      `${API_BASE_URL}/payments/${paymentId}/retry`,
      {
        method: "POST",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  getPaymentStats: async () => {
    const response = await fetch(`${API_BASE_URL}/payments/stats`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  getUserPayments: async (page = 1, limit = 10, status = "") => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await fetch(`${API_BASE_URL}/payments/history?${params}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (page = 1, limit = 10) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/notifications?${params}`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  markAsRead: async (notificationId) => {
    const response = await fetch(
      `${API_BASE_URL}/notifications/${notificationId}/read`,
      {
        method: "PUT",
        headers: createHeaders(),
      },
    );
    return handleResponse(response);
  },

  markAllAsRead: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "PUT",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },

  getNotificationCount: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      method: "GET",
      headers: createHeaders(),
    });
    return handleResponse(response);
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: createHeaders(false),
    });
    return handleResponse(response);
  },
};

// Export configService
export const configService = configAPI;

// Export default API object
const api = {
  auth: authAPI,
  users: usersAPI,
  loans: loansAPI,
  payments: paymentsAPI,
  notifications: notificationsAPI,
  health: healthAPI,
  config: configAPI,
};

export default api;
