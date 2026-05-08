import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiSettings } from 'react-icons/fi';
import { toast } from 'react-toastify';
import apiService from '../services/api';

const AppBranding = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    appName: '',
    appVersion: '',
    companyName: '',
    supportEmail: '',
    supportPhone: '',
    primaryColor: '#1976d2',
    secondaryColor: '#dc004e',
    logoUrl: '',
    splashScreenUrl: '',
    termsUrl: '',
    privacyUrl: ''
  });

  useEffect(() => {
    fetchBrandingConfig();
  }, []);

  const fetchBrandingConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getConfig();
      if (response.success && response.data) {
        const configs = response.data;
        setBranding({
          appName: configs.find(c => c.key === 'app_name')?.value || '',
          appVersion: configs.find(c => c.key === 'app_version')?.value || '',
          companyName: configs.find(c => c.key === 'company_name')?.value || '',
          supportEmail: configs.find(c => c.key === 'support_email')?.value || '',
          supportPhone: configs.find(c => c.key === 'support_phone')?.value || '',
          primaryColor: configs.find(c => c.key === 'primary_color')?.value || '#1976d2',
          secondaryColor: configs.find(c => c.key === 'secondary_color')?.value || '#dc004e',
          logoUrl: configs.find(c => c.key === 'logo_url')?.value || '',
          splashScreenUrl: configs.find(c => c.key === 'splash_screen_url')?.value || '',
          termsUrl: configs.find(c => c.key === 'terms_url')?.value || '',
          privacyUrl: configs.find(c => c.key === 'privacy_url')?.value || ''
        });
      }
    } catch (error) {
      console.error('Error fetching branding config:', error);
      toast.error('Failed to load branding configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setBranding(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const configUpdates = [
        { key: 'app_name', value: branding.appName },
        { key: 'app_version', value: branding.appVersion },
        { key: 'company_name', value: branding.companyName },
        { key: 'support_email', value: branding.supportEmail },
        { key: 'support_phone', value: branding.supportPhone },
        { key: 'primary_color', value: branding.primaryColor },
        { key: 'secondary_color', value: branding.secondaryColor },
        { key: 'logo_url', value: branding.logoUrl },
        { key: 'splash_screen_url', value: branding.splashScreenUrl },
        { key: 'terms_url', value: branding.termsUrl },
        { key: 'privacy_url', value: branding.privacyUrl }
      ];

      for (const config of configUpdates) {
        await apiService.updateConfig(config.key, config.value);
      }

      toast.success('Branding configuration updated successfully!');
    } catch (error) {
      console.error('Error updating branding config:', error);
      toast.error('Failed to update branding configuration');
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading branding config...
        </div>
      </div>
    );
  }

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );

  const Field = ({ label, field, type = 'text', help }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <input type={type} value={branding[field]} onChange={(e) => handleInputChange(field, e.target.value)} className={inp} />
      {help && <p className="text-[11px] text-gray-400 mt-1">{help}</p>}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiSettings size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">App Branding</h1>
            <p className="text-xs text-gray-400 mt-0.5">Configure branding, colors and company information</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? <FiRefreshCw size={13} className="animate-spin" /> : <FiSave size={13} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="space-y-4">
        <Section title="Basic Information">
          <Field label="App Name" field="appName" />
          <Field label="App Version" field="appVersion" />
          <Field label="Company Name" field="companyName" />
        </Section>
        <Section title="Contact Information">
          <Field label="Support Email" field="supportEmail" type="email" />
          <Field label="Support Phone" field="supportPhone" />
        </Section>
        <Section title="Color Configuration">
          <Field label="Primary Color" field="primaryColor" type="color" />
          <Field label="Secondary Color" field="secondaryColor" type="color" />
        </Section>
        <Section title="Assets & URLs">
          <Field label="Logo URL" field="logoUrl" help="URL to your app logo" />
          <Field label="Splash Screen URL" field="splashScreenUrl" help="URL to your splash screen image" />
          <Field label="Terms & Conditions URL" field="termsUrl" />
          <Field label="Privacy Policy URL" field="privacyUrl" />
        </Section>
      </div>
    </div>
  );

};

export default AppBranding;
