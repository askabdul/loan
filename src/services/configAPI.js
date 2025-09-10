import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ConfigAPI {
  // Get all app configurations
  async getAllConfigs() {
    try {
      const response = await axios.get(`${API_URL}/config`);
      return response.data;
    } catch (error) {
      console.error('Error fetching app configs:', error);
      throw error;
    }
  }

  // Get specific configuration by key
  async getConfig(key) {
    try {
      const response = await axios.get(`${API_URL}/config/${key}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching config ${key}:`, error);
      throw error;
    }
  }

  // Cache for configurations to avoid repeated API calls
  static configCache = {};
  static cacheExpiry = 5 * 60 * 1000; // 5 minutes
  static lastFetch = 0;

  // Get cached configurations or fetch from API
  async getCachedConfigs() {
    const now = Date.now();
    
    // Return cached data if it's still valid
    if (ConfigAPI.configCache.data && (now - ConfigAPI.lastFetch) < ConfigAPI.cacheExpiry) {
      return ConfigAPI.configCache;
    }

    try {
      const response = await this.getAllConfigs();
      ConfigAPI.configCache = response;
      ConfigAPI.lastFetch = now;
      return response;
    } catch (error) {
      // Return cached data if API fails and we have some
      if (ConfigAPI.configCache.data) {
        console.warn('Using cached config data due to API error');
        return ConfigAPI.configCache;
      }
      throw error;
    }
  }

  // Clear cache (useful for admin updates)
  clearCache() {
    ConfigAPI.configCache = {};
    ConfigAPI.lastFetch = 0;
  }

  // Get loan calculation parameters for all terms
  async getLoanCalculationParams() {
    try {
      const response = await axios.get(`${API_URL}/config-new/loan-calculations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching loan calculation params:', error);
      // Return default values if API fails
      return {
        success: true,
        data: {
          '7_days': { interestRate: 5, serviceFee: 2, adminFee: 1, commitmentFee: 1 },
          '14_days': { interestRate: 8, serviceFee: 3, adminFee: 1.5, commitmentFee: 1.5 },
          '30_days': { interestRate: 12, serviceFee: 4, adminFee: 2, commitmentFee: 2 }
        }
      };
    }
  }

  // Get loan calculation parameters for specific term
  async getLoanCalculationParamsForTerm(termDays) {
    try {
      const response = await axios.get(`${API_URL}/config-new/loan-calculations/${termDays}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching loan calculation params for ${termDays} days:`, error);
      // Return default values based on term
      const defaults = {
        7: { interestRate: 5, serviceFee: 2, adminFee: 1, commitmentFee: 1 },
        14: { interestRate: 8, serviceFee: 3, adminFee: 1.5, commitmentFee: 1.5 },
        30: { interestRate: 12, serviceFee: 4, adminFee: 2, commitmentFee: 2 }
      };
      return {
        success: true,
        data: defaults[termDays] || defaults[7]
      };
    }
  }

  // Get contact information
  async getContactInfo() {
    try {
      const response = await axios.get(`${API_URL}/config/contact-info`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact info:', error);
      return {
        success: true,
        data: {
          phone: '+233 123 456 789',
          email: 'support@cedi.com',
          whatsapp: '+233 123 456 789',
          address: 'Accra, Ghana',
          businessHours: 'Mon-Fri: 8AM-6PM',
          emergency: '+233 987 654 321'
        }
      };
    }
  }

  // Get app branding information
  async getAppBranding() {
    try {
      const response = await axios.get(`${API_URL}/config/app-branding`);
      return response.data;
    } catch (error) {
      console.error('Error fetching app branding:', error);
      return {
        success: true,
        data: {
          appName: 'Cedi Loan App',
          tagline: 'Quick & Easy Loans',
          description: 'Get instant loans with flexible repayment terms',
          companyName: 'Cedi Financial Services',
          logoUrl: '',
          version: '1.0.0'
        }
      };
    }
  }

  // Get loan settings
  async getLoanSettings() {
    try {
      const response = await axios.get(`${API_URL}/config/loan-settings`);
      return response.data;
    } catch (error) {
      console.error('Error fetching loan settings:', error);
      return {
        success: true,
        data: {
          minAmount: 100,
          maxAmount: 5000,
          defaultCreditLimit: 2000,
          autoApprovalLimit: 1000,
          availableTerms: [7, 14, 30],
          requireCollateral: false,
          minCreditScore: 300,
          processingFeeFlat: 0,
          processingFeePercentage: 0
        }
      };
    }
  }

  // Calculate loan fees dynamically based on current configuration
  async calculateLoanFees(amount, termDays) {
    try {
      const paramsResponse = await this.getLoanCalculationParamsForTerm(termDays);
      const params = paramsResponse.data;
      
      const principal = parseFloat(amount);
      const interestAmount = (principal * params.interestRate) / 100;
      const serviceAmount = (principal * params.serviceFee) / 100;
      const adminAmount = (principal * params.adminFee) / 100;
      const commitmentAmount = (principal * params.commitmentFee) / 100;
      
      const totalFees = interestAmount + serviceAmount + adminAmount + commitmentAmount;
      const totalAmount = principal + totalFees;
      
      return {
        success: true,
        data: {
          principal,
          fees: {
            interest: interestAmount,
            service: serviceAmount,
            admin: adminAmount,
            commitment: commitmentAmount,
            total: totalFees
          },
          totalAmount,
          breakdown: {
            interestRate: params.interestRate,
            serviceFeeRate: params.serviceFee,
            adminFeeRate: params.adminFee,
            commitmentFeeRate: params.commitmentFee
          }
        }
      };
    } catch (error) {
      console.error('Error calculating loan fees:', error);
      throw error;
    }
  }

  // Update configuration value
  async updateConfig(key, value) {
    try {
      const response = await axios.put(`${API_URL}/config/${key}`, { value });
      // Clear cache after update
      this.clearCache();
      return response.data;
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  }

  // Alias for getAllConfigs to match ConfigContext expectations
  async getConfigurations() {
    return await this.getAllConfigs();
  }

  // Get default fallback values in case API fails
  getDefaultConfig() {
    return {
      success: true,
      data: {
        terms_and_conditions: {
          content: `**Key Terms:**\n• Loan amounts: GHS 100 - GHS 5,000\n• Repayment terms: 7, 14, or 30 days\n• Interest rates vary by loan term\n• All fees are clearly disclosed before approval\n\n**Fee Structure:**\n• Interest Fee: Calculated based on loan term\n• Service Fee: 2% of loan amount\n• Admin Fee: GHS 5 flat fee\n• Commitment Fee: 1% of loan amount\n\n**Important Notes:**\n• Late payments may incur additional charges\n• Early repayment is allowed without penalty\n• All transactions are secured and encrypted\n• Customer support available 24/7\n• By accepting, you agree to our full terms and conditions`
        },
        loan_terms_available: [7, 14, 30],
        max_loan_amount: 5000,
        min_loan_amount: 100,
        interest_rates: {
          7: 0.05,
          14: 0.08,
          30: 0.12
        },
        fee_structure: {
          service_fee_rate: 0.02,
          admin_fee_flat: 5,
          commitment_fee_rate: 0.01
        },
        credit_score_range: {
          min: 300,
          max: 850,
          default: 650
        },
        default_credit_limit: 2000
      }
    };
  }
}

const configAPIInstance = new ConfigAPI();
export default configAPIInstance;