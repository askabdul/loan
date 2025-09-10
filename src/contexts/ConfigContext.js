import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import { configService } from '../services/api';

const ConfigContext = createContext();

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  const [configurations, setConfigurations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isConnected } = useSocket();
  const { showInfo } = useToast();

  // Fetch initial configurations
  const fetchConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await configService.getConfigurations();
      
      if (response.success) {
        // Handle both array and object responses
        let configObj = {};
        
        if (Array.isArray(response.data)) {
          // Convert array of configs to object for easier access
          response.data.forEach(config => {
            // Parse JSON strings for nested objects
            let value = config.value;
            if (typeof value === 'string' && (config.key === 'interest_rates' || config.key === 'fee_structure')) {
              try {
                value = JSON.parse(value);
              } catch (e) {
                console.warn(`Failed to parse JSON for config key: ${config.key}`, e);
              }
            }
            configObj[config.key] = value;
          });
        } else {
          // Handle object response (from mobile app endpoint)
          configObj = response.data;
          // Parse JSON strings for nested objects
          Object.keys(configObj).forEach(key => {
            let value = configObj[key];
            if (typeof value === 'string' && (key === 'interest_rates' || key === 'fee_structure')) {
              try {
                configObj[key] = JSON.parse(value);
              } catch (e) {
                console.warn(`Failed to parse JSON for config key: ${key}`, e);
              }
            }
          });
        }
        
        setConfigurations(configObj);
      }
    } catch (err) {
      console.error('Failed to fetch configurations:', err);
      setError(err.message || 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time configuration updates
  const handleConfigUpdate = useCallback((event) => {
    const { key, value } = event.detail;
    setConfigurations(prev => ({
      ...prev,
      [key]: value
    }));
    console.log(`Configuration updated: ${key} = ${value}`);
  }, []);

  // Handle bulk configuration updates
  const handleBulkConfigUpdate = useCallback((event) => {
    const configData = event.detail.config;
    setConfigurations(prev => ({
      ...prev,
      ...configData
    }));
    console.log('Bulk configuration update applied:', configData);
  }, []);

  // Handle system configuration updates
  const handleSystemConfigUpdate = useCallback((event) => {
    const configData = event.detail.config;
    if (configData) {
      setConfigurations(prev => ({
        ...prev,
        ...configData
      }));
      console.log('System configuration update applied:', configData);
    }
  }, []);

  // Setup event listeners for real-time updates
  useEffect(() => {
    if (isConnected) {
      window.addEventListener('configUpdate', handleConfigUpdate);
      window.addEventListener('bulkConfigUpdate', handleBulkConfigUpdate);
      window.addEventListener('systemConfigUpdate', handleSystemConfigUpdate);

      return () => {
        window.removeEventListener('configUpdate', handleConfigUpdate);
        window.removeEventListener('bulkConfigUpdate', handleBulkConfigUpdate);
        window.removeEventListener('systemConfigUpdate', handleSystemConfigUpdate);
      };
    }
  }, [isConnected, handleConfigUpdate, handleBulkConfigUpdate, handleSystemConfigUpdate]);

  // Fetch configurations on mount
  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  // Helper functions to get specific configuration values
  const getConfig = useCallback((key, defaultValue = null) => {
    return configurations[key] !== undefined ? configurations[key] : defaultValue;
  }, [configurations]);

  const getLoanConfig = useCallback((term, type) => {
    // First try to get from nested structure
    const interestRates = getConfig('interest_rates', {});
    const feeStructure = getConfig('fee_structure', {});
    
    if (type === 'interest_rate' && interestRates[term]) {
      return interestRates[term] * 100; // Convert to percentage
    } else if (type === 'service_fee' && feeStructure.service_fee_rate) {
      return feeStructure.service_fee_rate * 100; // Convert to percentage
    } else if (type === 'admin_fee' && feeStructure.admin_fee_flat) {
      return feeStructure.admin_fee_flat; // Flat fee
    } else if (type === 'commitment_fee' && feeStructure.commitment_fee_rate) {
      return feeStructure.commitment_fee_rate * 100; // Convert to percentage
    }
    
    // Fallback to individual keys for backward compatibility
    const key = `${type}_${term}_days`;
    return getConfig(key, 0);
  }, [getConfig]);

  const getContactConfig = useCallback(() => {
    return {
      phone: getConfig('support_phone', ''),
      email: getConfig('support_email', ''),
      whatsapp: getConfig('support_whatsapp', ''),
      address: getConfig('office_address', ''),
      businessHours: getConfig('business_hours', ''),
      emergency: getConfig('emergency_contact', '')
    };
  }, [getConfig]);

  const getAppConfig = useCallback(() => {
    return {
      name: getConfig('app_name', 'CEDI Loan'),
      tagline: getConfig('app_tagline', ''),
      description: getConfig('app_description', ''),
      companyName: getConfig('company_name', ''),
      logoUrl: getConfig('company_logo_url', ''),
      version: getConfig('app_version', '1.0.0')
    };
  }, [getConfig]);

  const value = {
    configurations,
    loading,
    error,
    getConfig,
    getLoanConfig,
    getContactConfig,
    getAppConfig,
    refetch: fetchConfigurations
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};