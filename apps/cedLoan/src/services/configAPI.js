import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

class ConfigAPI {
  normalizeConfigObject(payload) {
    if (!payload) return {};
    if (Array.isArray(payload)) {
      return payload.reduce((acc, item) => {
        if (item?.key) acc[item.key] = item.value;
        return acc;
      }, {});
    }
    return payload;
  }

  // Get all app configurations
  async getAllConfigs() {
    try {
      const response = await axios.get(`${API_URL}/config-new`);
      return response.data;
    } catch (error) {
      console.error("Error fetching app configs from /config-new:", error);
      const fallback = await axios.get(`${API_URL}/config`);
      return fallback.data;
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
    if (
      ConfigAPI.configCache.data &&
      now - ConfigAPI.lastFetch < ConfigAPI.cacheExpiry
    ) {
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
        console.warn("Using cached config data due to API error");
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
      const response = await axios.get(
        `${API_URL}/config-new/loan-calculations`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching loan calculation params:", error);
      const all = await this.getCachedConfigs();
      const cfg = this.normalizeConfigObject(all?.data);

      const buildTerm = (termDays) => ({
        interestRate: Number(cfg[`interest_rate_${termDays}_days`] || 0),
        serviceFee: Number(cfg[`service_fee_${termDays}_days`] || 0),
        adminFee: Number(cfg[`admin_fee_${termDays}_days`] || 0),
        commitmentFee: Number(cfg[`commitment_fee_${termDays}_days`] || 0),
      });

      return {
        success: true,
        data: {
          "7_days": buildTerm(7),
          "14_days": buildTerm(14),
          "30_days": buildTerm(30),
        },
      };
    }
  }

  // Get loan calculation parameters for specific term
  async getLoanCalculationParamsForTerm(termDays) {
    try {
      const response = await axios.get(
        `${API_URL}/config-new/loan-calculations/${termDays}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching loan calculation params for ${termDays} days:`,
        error,
      );
      const all = await this.getCachedConfigs();
      const cfg = this.normalizeConfigObject(all?.data);
      return {
        success: true,
        data: {
          interestRate: Number(cfg[`interest_rate_${termDays}_days`] || 0),
          serviceFee: Number(cfg[`service_fee_${termDays}_days`] || 0),
          adminFee: Number(cfg[`admin_fee_${termDays}_days`] || 0),
          commitmentFee: Number(cfg[`commitment_fee_${termDays}_days`] || 0),
        },
      };
    }
  }

  // Get contact information
  async getContactInfo() {
    try {
      const response = await axios.get(`${API_URL}/config-new/contact-info`);
      return response.data;
    } catch (error) {
      console.error("Error fetching contact info:", error);
      const all = await this.getCachedConfigs();
      const cfg = this.normalizeConfigObject(all?.data);
      return {
        success: true,
        data: {
          phone: cfg.support_phone || "",
          email: cfg.support_email || "",
          whatsapp: cfg.support_whatsapp || "",
          address: cfg.office_address || "",
          businessHours: cfg.business_hours || "",
          emergency: cfg.emergency_contact || "",
        },
      };
    }
  }

  // Get app branding information
  async getAppBranding() {
    try {
      const response = await axios.get(`${API_URL}/config-new/app-branding`);
      return response.data;
    } catch (error) {
      console.error("Error fetching app branding:", error);
      const all = await this.getCachedConfigs();
      const cfg = this.normalizeConfigObject(all?.data);
      return {
        success: true,
        data: {
          appName: cfg.app_name || "CEDI Loan",
          tagline: cfg.app_tagline || "",
          description: cfg.app_description || "",
          companyName: cfg.company_name || "",
          logoUrl: cfg.company_logo_url || "",
          version: cfg.app_version || "1.0.0",
        },
      };
    }
  }

  // Get loan settings
  async getLoanSettings() {
    try {
      const response = await axios.get(`${API_URL}/config-new/loan-settings`);
      return response.data;
    } catch (error) {
      console.error("Error fetching loan settings:", error);
      const all = await this.getCachedConfigs();
      const cfg = this.normalizeConfigObject(all?.data);
      return {
        success: true,
        data: {
          minAmount: Number(cfg.min_loan_amount || 100),
          maxAmount: Number(cfg.max_loan_amount || 5000),
          defaultCreditLimit: Number(cfg.default_credit_limit || 2000),
          autoApprovalLimit: Number(cfg.auto_approval_limit || 1000),
          availableTerms: Array.isArray(cfg.loan_terms_available)
            ? cfg.loan_terms_available
            : [7, 14, 30],
          requireCollateral: Boolean(cfg.require_collateral),
          minCreditScore: Number(cfg.min_credit_score || 300),
          processingFeeFlat: Number(cfg.processing_fee_flat || 0),
          processingFeePercentage: Number(cfg.processing_fee_percentage || 0),
        },
      };
    }
  }

  // Calculate loan fees dynamically based on current configuration
  async calculateLoanFees(amount, termDays) {
    try {
      const paramsResponse = await this.getLoanCalculationParamsForTerm(termDays);
      const params = paramsResponse.data;

      const principal = parseFloat(amount);
      const r2 = (n) => Math.round(n * 100) / 100;

      const interestAmount   = r2((principal * (params.interestRate   || 0)) / 100);
      const serviceAmount    = r2((principal * (params.serviceFee     || 0)) / 100);
      const adminAmount      = r2((principal * (params.adminFee       || 0)) / 100);
      const commitmentAmount = r2((principal * (params.commitmentFee  || 0)) / 100);
      const totalFees        = r2(interestAmount + serviceAmount + adminAmount + commitmentAmount);

      // upfrontDeductionPct: % of principal withheld at disbursement (from AppConfig, returned by backend)
      const upfrontPct     = params.upfrontDeductionPct || 20;
      const upfrontFee     = r2((principal * upfrontPct) / 100);
      const amountReceived = r2(principal - upfrontFee);
      // totalAmount: full obligation (principal + all fees, e.g. 145 for GHS 100 at 45%)
      const totalAmount    = r2(principal + totalFees);
      // repaymentAmount: what user owes after upfront is collected (e.g. 125)
      const repaymentAmount = r2(totalAmount - upfrontFee);

      return {
        success: true,
        data: {
          principal,
          upfrontPct,
          upfrontFee,
          amountReceived,
          fees: {
            interest: interestAmount,
            service: serviceAmount,
            admin: adminAmount,
            processing: adminAmount,
            commitment: commitmentAmount,
            total: totalFees,
          },
          totalAmount,
          repaymentAmount,
          breakdown: {
            interestRate:      params.interestRate   || 0,
            serviceFeeRate:    params.serviceFee     || 0,
            adminFeeRate:      params.adminFee       || 0,
            commitmentFeeRate: params.commitmentFee  || 0,
          },
        },
      };
    } catch (error) {
      console.error("Error calculating loan fees:", error);
      throw error;
    }
  }

  // Update configuration value
  async updateConfig(key, value) {
    try {
      const response = await axios.put(`${API_URL}/config-new/${key}`, {
        value,
      });
      // Clear cache after update
      this.clearCache();
      return response.data;
    } catch (error) {
      console.error("Error updating config:", error);
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
          content: `**Key Terms:**\n• Loan amounts: GHS 100 - GHS 5,000\n• Repayment terms: 7, 14, or 30 days\n• Interest rates vary by loan term\n• All fees are clearly disclosed before approval\n\n**Fee Structure:**\n• Interest Fee: Calculated based on loan term\n• Service Fee: 2% of loan amount\n• Admin Fee: GHS 5 flat fee\n• Commitment Fee: 1% of loan amount\n\n**Important Notes:**\n• Late payments may incur additional charges\n• Early repayment is allowed without penalty\n• All transactions are secured and encrypted\n• Customer support available 24/7\n• By accepting, you agree to our full terms and conditions`,
        },
        loan_terms_available: [7, 14, 30],
        max_loan_amount: 5000,
        min_loan_amount: 100,
        interest_rates: {
          7: 0.05,
          14: 0.08,
          30: 0.12,
        },
        fee_structure: {
          service_fee_rate: 0.02,
          admin_fee_flat: 5,
          commitment_fee_rate: 0.01,
        },
        credit_score_range: {
          min: 300,
          max: 850,
          default: 650,
        },
        default_credit_limit: 2000,
      },
    };
  }
}

const configAPIInstance = new ConfigAPI();
export default configAPIInstance;
