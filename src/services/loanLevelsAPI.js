import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Loan Levels API functions
export const loanLevelsAPI = {
  // Get all active loan levels
  getAllLevels: async () => {
    try {
      const response = await api.get('/loan-levels');
      return response.data;
    } catch (error) {
      console.error('Error fetching loan levels:', error);
      throw error;
    }
  },

  // Get specific loan level
  getLevelByNumber: async (levelNumber) => {
    try {
      const response = await api.get(`/loan-levels/${levelNumber}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching loan level:', error);
      throw error;
    }
  },

  // Get current user's loan level and progression info
  getCurrentUserLevel: async () => {
    try {
      const response = await api.get('/loan-levels/user/current');
      return response.data;
    } catch (error) {
      console.error('Error fetching user loan level:', error);
      throw error;
    }
  },

  // Admin functions
  createLevel: async (levelData) => {
    try {
      const response = await api.post('/loan-levels', levelData);
      return response.data;
    } catch (error) {
      console.error('Error creating loan level:', error);
      throw error;
    }
  },

  updateLevel: async (levelId, levelData) => {
    try {
      const response = await api.patch(`/loan-levels/${levelId}`, levelData);
      return response.data;
    } catch (error) {
      console.error('Error updating loan level:', error);
      throw error;
    }
  },

  deleteLevel: async (levelId) => {
    try {
      const response = await api.delete(`/loan-levels/${levelId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting loan level:', error);
      throw error;
    }
  },

  // Update user level (admin only)
  updateUserLevel: async (userId, newLevel, reason, notes) => {
    try {
      const response = await api.patch(`/loan-levels/user/${userId}/level`, {
        newLevel,
        reason,
        notes
      });
      return response.data;
    } catch (error) {
      console.error('Error updating user level:', error);
      throw error;
    }
  },

  // Get all users with their levels (admin only)
  getAllUsersWithLevels: async () => {
    try {
      const response = await api.get('/loan-levels/users/all');
      return response.data;
    } catch (error) {
      console.error('Error fetching users with levels:', error);
      throw error;
    }
  },

  // Update loan terms for a specific level (admin only)
  updateLevelTerms: async (levelId, availableTerms) => {
    try {
      const response = await api.patch(`/loan-levels/${levelId}/terms`, {
        availableTerms
      });
      return response.data;
    } catch (error) {
      console.error('Error updating level terms:', error);
      throw error;
    }
  },

  // Update auto-approval settings for a specific level (admin only)
  updateAutoApproval: async (levelId, autoApproval) => {
    try {
      const response = await api.patch(`/loan-levels/${levelId}/auto-approval`, {
        autoApproval
      });
      return response.data;
    } catch (error) {
      console.error('Error updating auto-approval settings:', error);
      throw error;
    }
  },

  // Bulk update terms for multiple levels (admin only)
  bulkUpdateTerms: async (levelUpdates) => {
    try {
      const response = await api.patch('/loan-levels/bulk/terms', {
        levelUpdates
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating terms:', error);
      throw error;
    }
  },

  // Loan Terms API functions
  // Get all active loan terms
  getAllLoanTerms: async () => {
    try {
      const response = await api.get('/loan-terms');
      return response.data;
    } catch (error) {
      console.error('Error fetching loan terms:', error);
      throw error;
    }
  },

  // Get available loan terms for current user based on their level
  getUserAvailableTerms: async () => {
    try {
      const response = await api.get('/loan-terms/available');
      return response.data;
    } catch (error) {
      console.error('Error fetching user available terms:', error);
      throw error;
    }
  },

  // Get specific loan term details
  getLoanTermById: async (termId) => {
    try {
      const response = await api.get(`/loan-terms/${termId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching loan term:', error);
      throw error;
    }
  }
};

export default loanLevelsAPI;