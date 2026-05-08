import axios from "axios";

const RAW_API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const API_BASE_URL = RAW_API_URL.endsWith("/api")
  ? RAW_API_URL
  : `${RAW_API_URL.replace(/\/$/, "")}/api`;

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem("adminToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// API Service Class
class ApiService {
  // Generic HTTP methods
  async get(url, config = {}) {
    try {
      const response = await api.get(url, config);
      return response;
    } catch (error) {
      console.error(`Error making GET request to ${url}:`, error);
      throw error;
    }
  }

  async post(url, data = {}, config = {}) {
    try {
      const response = await api.post(url, data, config);
      return response;
    } catch (error) {
      console.error(`Error making POST request to ${url}:`, error);
      throw error;
    }
  }

  async put(url, data = {}, config = {}) {
    try {
      const response = await api.put(url, data, config);
      return response;
    } catch (error) {
      console.error(`Error making PUT request to ${url}:`, error);
      throw error;
    }
  }

  async patch(url, data = {}, config = {}) {
    try {
      const response = await api.patch(url, data, config);
      return response;
    } catch (error) {
      console.error(`Error making PATCH request to ${url}:`, error);
      throw error;
    }
  }

  async delete(url, config = {}) {
    try {
      const response = await api.delete(url, config);
      return response;
    } catch (error) {
      console.error(`Error making DELETE request to ${url}:`, error);
      throw error;
    }
  }

  // Dashboard APIs
  async getDashboardOverview() {
    try {
      const response = await api.get("/admin/dashboard/overview");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard overview:", error);
      throw error;
    }
  }

  // User Management APIs
  async getUsers(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        searchType,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = params;

      const queryParams = { page, limit, sortBy, sortOrder };
      if (search) queryParams.search = search;
      if (searchType) queryParams.searchType = searchType;
      if (status && status !== "all") queryParams.status = status;

      const response = await api.get("/admin/users", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  }

  async updateUserStatus(userId, isActive) {
    try {
      // Backend expects { isActive: boolean } — not a status string
      const response = await api.patch(`/admin/users/${userId}/status`, {
        isActive: Boolean(isActive),
      });
      return response.data;
    } catch (error) {
      console.error("Error updating user status:", error);
      throw error;
    }
  }

  // Helper function to get auth headers
  getAuthHeader() {
    const token = localStorage.getItem("adminToken");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // Admin Registration API
  async adminRegisterUser(userData) {
    try {
      const response = await api.post("/users/admin-register", userData, {
        headers: this.getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      console.error("Error registering user:", error);
      throw error;
    }
  }

  // Get Users List for Admin Management
  async getUsersList(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "all",
        loanLevel = "all",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = params;

      const queryParams = {
        page,
        limit,
        search,
        status,
        loanLevel,
        sortBy,
        sortOrder,
      };

      const response = await api.get("/admin/users", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching users list:", error);
      throw error;
    }
  }

  // Update user information
  async updateUserInfo(userId, userData) {
    try {
      const response = await api.put(`/users/${userId}/info`, userData);
      return response.data;
    } catch (error) {
      console.error("Error updating user info:", error);
      throw error;
    }
  }

  // Reset user PIN
  async resetUserPin(userId, pinData) {
    try {
      const response = await api.put(`/users/${userId}/reset-pin`, pinData);
      return response.data;
    } catch (error) {
      console.error("Error resetting user PIN:", error);
      throw error;
    }
  }

  // Update user account status (activate/deactivate)
  async updateUserAccountStatus(userId, statusData) {
    try {
      const response = await api.put(`/users/${userId}/status`, statusData);
      return response.data;
    } catch (error) {
      console.error("Error updating user account status:", error);
      throw error;
    }
  }

  // User Level Assignment APIs
  async getUsersWithLevels(params = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        level,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = params;

      const queryParams = { page, limit, sortBy, sortOrder };
      if (search) queryParams.search = search;
      if (level && level !== "all") queryParams.level = level;

      const response = await api.get("/users/with-levels", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching users with levels:", error);
      throw error;
    }
  }

  async updateUserLevel(userId, levelId, reason = "") {
    try {
      const response = await api.put(`/users/${userId}/level`, {
        levelId,
        reason,
      });
      return response.data;
    } catch (error) {
      console.error("Error updating user level:", error);
      throw error;
    }
  }

  async bulkUpdateUserLevels(userIds, levelId, reason = "") {
    try {
      const response = await api.put("/users/bulk-level-update", {
        userIds,
        levelId,
        reason,
      });
      return response.data;
    } catch (error) {
      console.error("Error bulk updating user levels:", error);
      throw error;
    }
  }

  async getUserLevelHistory(userId) {
    try {
      const response = await api.get(`/users/${userId}/level-history`);
      return response.data;
    } catch (error) {
      console.error("Error fetching user level history:", error);
      throw error;
    }
  }

  // Loan Management APIs
  async getLoans(page = 1, limit = 10, status = "", search = "") {
    try {
      const queryParams = { page, limit };
      if (status && status !== "all") queryParams.status = status;
      if (search) queryParams.search = search;

      const response = await api.get("/admin/loans", {
        params: queryParams,
      });

      // Return data in the expected format for CreditReviewList component
      return {
        loans: response.data?.data?.loans || [],
        pagination: response.data?.data?.pagination || { total: 0, pages: 0 },
      };
    } catch (error) {
      console.error("Error fetching loans:", error);
      throw error;
    }
  }

  async getLoanById(loanId) {
    try {
      const response = await api.get(`/admin/loans/${loanId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching loan:", error);
      throw error;
    }
  }

  async updateLoanStatus(loanId, status, notes = "") {
    try {
      const response = await api.put(`/loans/admin/${loanId}/status`, {
        status,
        adminNotes: notes,
      });
      return response.data;
    } catch (error) {
      console.error("Error updating loan status:", error);
      throw error;
    }
  }

  async getAllLoans(page = 1, limit = 10, status = undefined) {
    try {
      const params = { page, limit };
      if (status) params.status = status;

      const response = await api.get("/admin/loans", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching all loans:", error);
      throw error;
    }
  }

  async getLoanDashboardStats() {
    try {
      const response = await api.get("/loans/admin/dashboard-stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching loan dashboard stats:", error);
      throw error;
    }
  }

  // Analytics APIs
  async getLoanAnalytics(period = "30d") {
    try {
      const response = await api.get("/admin/analytics/loans", {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching loan analytics:", error);
      throw error;
    }
  }

  async getUserAnalytics(period = "30d") {
    try {
      const response = await api.get("/admin/analytics/users", {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      throw error;
    }
  }

  // Configuration APIs
  async getConfiguration() {
    try {
      const response = await api.get("/config-new/admin/all");
      return response.data;
    } catch (error) {
      console.error("Error fetching config:", error);
      throw error;
    }
  }

  async updateConfiguration(config) {
    try {
      const response = await api.put("/admin/config", config);
      return response.data;
    } catch (error) {
      console.error("Error updating config:", error);
      throw error;
    }
  }

  async getConfig() {
    try {
      const response = await api.get("/admin/config");
      return response.data;
    } catch (error) {
      console.error("Error fetching config:", error);
      throw error;
    }
  }

  async updateConfig(key, value) {
    try {
      const response = await api.put(`/admin/config/${key}`, { value });
      return response.data;
    } catch (error) {
      console.error("Error updating config:", error);
      throw error;
    }
  }

  // Payment Management APIs
  async getPayments(page = 1, limit = 10, status = "", loanId = "") {
    try {
      const params = { page, limit };
      if (status) params.status = status;
      if (loanId) params.loanId = loanId;

      const response = await api.get("/admin/payments", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching payments:", error);
      throw error;
    }
  }

  async getPaymentById(paymentId) {
    try {
      const response = await api.get(`/admin/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching payment:", error);
      throw error;
    }
  }

  async getPaymentStats() {
    try {
      const response = await api.get("/admin/payments/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching payment stats:", error);
      throw error;
    }
  }

  // Notification Management APIs
  async getNotifications(page = 1, limit = 10, type = "", status = "") {
    try {
      const params = { page, limit };
      if (type) params.type = type;
      if (status) params.status = status;

      const response = await api.get("/admin/notifications", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  }

  async getNotificationById(notificationId) {
    try {
      const response = await api.get(`/admin/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching notification:", error);
      throw error;
    }
  }

  async createNotification(notificationData) {
    try {
      const response = await api.post("/admin/notifications", notificationData);
      return response.data;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async updateNotification(notificationId, notificationData) {
    try {
      const response = await api.put(
        `/admin/notifications/${notificationId}`,
        notificationData,
      );
      return response.data;
    } catch (error) {
      console.error("Error updating notification:", error);
      throw error;
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await api.delete(
        `/admin/notifications/${notificationId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  async sendNotification(notificationId) {
    try {
      const response = await api.post(
        `/admin/notifications/${notificationId}/send`,
      );
      return response.data;
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }

  async getNotificationStats() {
    try {
      const response = await api.get("/admin/notifications/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      throw error;
    }
  }

  async retryPayment(paymentId) {
    try {
      const response = await api.post(`/admin/payments/${paymentId}/retry`);
      return response.data;
    } catch (error) {
      console.error("Error retrying payment:", error);
      throw error;
    }
  }

  async broadcastNotification(data) {
    try {
      const response = await api.post("/admin/notifications/broadcast", data);
      return response.data;
    } catch (error) {
      console.error("Error broadcasting notification:", error);
      throw error;
    }
  }

  // Content Management APIs
  async getContent() {
    try {
      const response = await api.get("/admin/content");
      return response.data;
    } catch (error) {
      console.error("Error fetching content:", error);
      throw error;
    }
  }

  async getAllContent() {
    try {
      const response = await api.get("/admin/content");
      return response.data;
    } catch (error) {
      console.error("Error fetching all content:", error);
      throw error;
    }
  }

  async createContent(contentData) {
    try {
      const response = await api.post("/admin/content", contentData);
      return response.data;
    } catch (error) {
      console.error("Error creating content:", error);
      throw error;
    }
  }

  async updateContent(contentId, contentData) {
    try {
      const response = await api.put(
        `/admin/content/${contentId}`,
        contentData,
      );
      return response.data;
    } catch (error) {
      console.error("Error updating content:", error);
      throw error;
    }
  }

  async deleteContent(contentId) {
    try {
      const response = await api.delete(`/admin/content/${contentId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting content:", error);
      throw error;
    }
  }

  // Authentication APIs
  async login(credentials) {
    try {
      const loginData = {
        login: credentials.login || credentials.email || credentials.username,
        password: credentials.password,
      };
      const response = await api.post("/admin-auth/login", loginData);
      if (response.data.token) {
        localStorage.setItem("adminToken", response.data.token);
      }
      return response.data;
    } catch (error) {
      console.error("Error logging in:", error);
      throw error;
    }
  }

  // Permissions API
  async getAdminPermissions() {
    try {
      const response = await api.get("/admin-management/permissions");
      return response.data;
    } catch (error) {
      console.error("Error fetching admin permissions:", error);
      throw error;
    }
  }

  // Role Management APIs
  async getRoles(params = {}) {
    try {
      const response = await api.get("/admin-management/roles", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  async getRoleById(roleId) {
    try {
      const response = await api.get(`/admin-management/roles/${roleId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching role:", error);
      throw error;
    }
  }

  async createRole(roleData) {
    try {
      const response = await api.post("/admin-management/roles", roleData);
      return response.data;
    } catch (error) {
      console.error("Error creating role:", error);
      throw error;
    }
  }

  async updateRole(roleId, roleData) {
    try {
      const response = await api.put(
        `/admin-management/roles/${roleId}`,
        roleData,
      );
      return response.data;
    } catch (error) {
      console.error("Error updating role:", error);
      throw error;
    }
  }

  async deleteRole(roleId) {
    try {
      const response = await api.delete(`/admin-management/roles/${roleId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting role:", error);
      throw error;
    }
  }

  async getRoleStats() {
    try {
      const response = await api.get("/admin-management/roles/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching role stats:", error);
      throw error;
    }
  }

  // Loan Assignment and Review APIs
  async assignLoans(loanIds, officerIds, distributionType = "even") {
    try {
      const response = await api.post("/loans/assign", {
        loanIds,
        officerIds,
        distributionType,
      });
      return response.data;
    } catch (error) {
      console.error("Error assigning loans:", error);
      throw error;
    }
  }

  async withdrawLoanAssignment(loanId) {
    try {
      const response = await api.post(`/loans/${loanId}/withdraw-assignment`);
      return response.data;
    } catch (error) {
      console.error("Error withdrawing loan assignment:", error);
      throw error;
    }
  }

  async approveApplication(loanId, data) {
    try {
      const response = await api.post(`/loans/${loanId}/approve`, data);
      return response.data;
    } catch (error) {
      console.error("Error approving application:", error);
      throw error;
    }
  }

  async rejectApplication(loanId, data) {
    try {
      const response = await api.post(`/loans/${loanId}/reject`, data);
      return response.data;
    } catch (error) {
      console.error("Error rejecting application:", error);
      throw error;
    }
  }

  async hangUpApplication(loanId, data) {
    try {
      const response = await api.post(`/loans/${loanId}/hang-up`, data);
      return response.data;
    } catch (error) {
      console.error("Error hanging up application:", error);
      throw error;
    }
  }

  async getCreditOfficers() {
    try {
      const response = await api.get("/users/credit-officers");
      return response.data;
    } catch (error) {
      console.error("Error fetching credit officers:", error);
      throw error;
    }
  }

  async getTeams() {
    try {
      const response = await api.get("/admin/teams");
      return response.data;
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw error;
    }
  }

  async getCreditReviewOfficers() {
    try {
      const response = await api.get("/admin-management/admins", {
        params: {
          limit: 100, // Get all officers
          status: "active",
        },
      });

      // Filter for credit review officers and format the response
      const allAdmins =
        response.data?.data?.admins || response.data?.admins || [];
      const creditReviewOfficers = allAdmins.filter((admin) => {
        const roleName = admin.role?.name || admin.roleName;
        return (
          roleName &&
          (roleName.includes("review") ||
            roleName.includes("credit") ||
            roleName === "review-officer" ||
            roleName === "credit-review-officer" ||
            roleName === "review-lead")
        );
      });

      // Format officers for the assignment modal
      const formattedOfficers = creditReviewOfficers.map((officer) => ({
        _id: officer._id || officer.id,
        name:
          officer.fullName ||
          `${officer.firstName} ${officer.lastName}`.trim() ||
          officer.username,
        email: officer.email,
        currentLoans: officer.assignments?.loanApplications?.length || 0,
        role: officer.role,
      }));

      return {
        success: true,
        officers: formattedOfficers,
      };
    } catch (error) {
      console.error("Error fetching credit review officers:", error);
      throw error;
    }
  }

  async retryContactLoan(loanId) {
    try {
      const response = await api.post(`/loans/${loanId}/retry-contact`);
      return response.data;
    } catch (error) {
      console.error("Error retrying contact for loan:", error);
      throw error;
    }
  }

  // Loan Level Management APIs
  async getAllLevels() {
    try {
      const response = await api.get("/loan-levels");
      return response.data;
    } catch (error) {
      console.error("Error fetching loan levels:", error);
      throw error;
    }
  }

  async createLoanLevel(levelData) {
    try {
      const response = await api.post("/loan-levels", levelData);
      return response.data;
    } catch (error) {
      console.error("Error creating loan level:", error);
      throw error;
    }
  }

  async updateLoanLevel(levelId, levelData) {
    try {
      const response = await api.put(`/loan-levels/${levelId}`, levelData);
      return response.data;
    } catch (error) {
      console.error("Error updating loan level:", error);
      throw error;
    }
  }

  async deleteLoanLevel(levelId) {
    try {
      const response = await api.delete(`/loan-levels/${levelId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting loan level:", error);
      throw error;
    }
  }

  // Loan Terms Management APIs
  async getLoanTerms() {
    try {
      const response = await api.get("/loan-terms");
      return response.data;
    } catch (error) {
      console.error("Error fetching loan terms:", error);
      throw error;
    }
  }

  async toggleLoanTerm(termId) {
    try {
      const response = await api.patch(`/loan-terms/${termId}/toggle`);
      return response.data;
    } catch (error) {
      console.error("Error toggling loan term:", error);
      throw error;
    }
  }

  async updateLoanTerm(termId, termData) {
    try {
      const response = await api.patch(`/loan-terms/${termId}`, termData);
      return response.data;
    } catch (error) {
      console.error("Error updating loan term:", error);
      throw error;
    }
  }

  // Loan Assignment API
  async assignLoansToOfficers(loanIds, officerIds, assignmentType = "even") {
    try {
      // Ensure all IDs are strings (MongoDB ObjectId format)
      const formattedLoanIds = Array.isArray(loanIds)
        ? loanIds.map((id) => String(id))
        : [String(loanIds)];
      const formattedOfficerIds = Array.isArray(officerIds)
        ? officerIds.map((id) => String(id))
        : [String(officerIds)];

      const requestData = {
        loanIds: formattedLoanIds,
        officerIds: formattedOfficerIds,
        assignmentType: assignmentType,
      };

      const response = await api.post("/admin/loans/assign", requestData);
      return response.data;
    } catch (error) {
      console.error("Error assigning loans to officers:", error);
      throw error;
    }
  }

  async logout() {
    try {
      localStorage.removeItem("adminToken");
      return { success: true };
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;

// Also export the axios instance for direct use if needed
export { api };
