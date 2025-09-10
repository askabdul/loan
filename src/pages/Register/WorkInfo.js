import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const WorkInfo = () => {
  const [formData, setFormData] = useState({
    employmentStatus: '',
    employer: '',
    jobTitle: '',
    workAddress: '',
    monthlyIncome: '',
    yearsOfEmployment: '',
    workPhone: '',
    supervisorName: '',
    supervisorPhone: '',
    additionalIncome: '',
    additionalIncomeSource: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.employmentStatus) newErrors.employmentStatus = 'Employment status is required';
    
    if (formData.employmentStatus === 'employed') {
      if (!formData.employer.trim()) newErrors.employer = 'Company name is required';
      if (!formData.jobTitle.trim()) newErrors.jobTitle = 'Job title is required';
      if (!formData.workAddress.trim()) newErrors.workAddress = 'Work address is required';
      if (!formData.monthlyIncome) newErrors.monthlyIncome = 'Monthly income is required';
      if (!formData.yearsOfEmployment) newErrors.yearsOfEmployment = 'Employment duration is required';
    }
    
    if (formData.employmentStatus === 'self-employed') {
      if (!formData.employer.trim()) newErrors.employer = 'Business name is required';
      if (!formData.jobTitle.trim()) newErrors.jobTitle = 'Position/Role is required';
      if (!formData.workAddress.trim()) newErrors.workAddress = 'Business address is required';
      if (!formData.monthlyIncome) newErrors.monthlyIncome = 'Monthly income is required';
      if (!formData.yearsOfEmployment) newErrors.yearsOfEmployment = 'Business duration is required';
    }
    
    // Validate monthly income is a positive number
    if (formData.monthlyIncome && (isNaN(formData.monthlyIncome) || parseFloat(formData.monthlyIncome) <= 0)) {
      newErrors.monthlyIncome = 'Please enter a valid monthly income';
    }
    
    // Validate additional income if provided
    if (formData.additionalIncome && (isNaN(formData.additionalIncome) || parseFloat(formData.additionalIncome) < 0)) {
      newErrors.additionalIncome = 'Please enter a valid additional income';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Save work info to localStorage (same pattern as PersonalInfo)
      localStorage.setItem('workInfo', JSON.stringify(formData));
      
      toast.success('Work information saved!');
      
      // Navigate to next step - Education Information
      navigate('/education-info');
    } catch (error) {
      console.error('Error saving work info:', error);
      toast.error('Failed to save work information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isEmployed = formData.employmentStatus === 'employed';
  const isSelfEmployed = formData.employmentStatus === 'self-employed';
  const showIncomeFields = isEmployed || isSelfEmployed;

  return (
    <div className="cedi-page-background">
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-12 col-lg-12 col-xl-12">
            <div className="card cedi-card">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="cedi-logo-container mx-auto mb-3">
                    <span className="text-white fw-bold fs-5">CEDI</span>
                  </div>
                  <h1 className="h2 fw-bold text-cedi-dark mb-2">Employment Information</h1>
                  <p className="text-muted">Please provide your employment details</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-medium text-dark">Employment Status *</label>
                    <select
                      name="employmentStatus"
                      value={formData.employmentStatus}
                      onChange={handleInputChange}
                      className={`form-select cedi-form-input ${errors.employmentStatus ? 'is-invalid' : ''}`}
                    >
                      <option value="">Select employment status</option>
                      <option value="employed">Employed</option>
                      <option value="self-employed">Self-Employed</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="student">Student</option>
                      <option value="retired">Retired</option>
                    </select>
                    {errors.employmentStatus && <div className="invalid-feedback">{errors.employmentStatus}</div>}
                  </div>

                  {(isEmployed || isSelfEmployed) && (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">
                              {isEmployed ? 'Company Name *' : 'Business Name *'}
                            </label>
                            <input
                              type="text"
                              name="employer"
                              value={formData.employer}
                              onChange={handleInputChange}
                              className={`form-control cedi-form-input ${errors.employer ? 'is-invalid' : ''}`}
                              placeholder={isEmployed ? 'Enter company name' : 'Enter business name'}
                            />
                            {errors.employer && <div className="invalid-feedback">{errors.employer}</div>}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">
                              {isEmployed ? 'Job Title *' : 'Position/Role *'}
                            </label>
                            <input
                              type="text"
                              name="jobTitle"
                              value={formData.jobTitle}
                              onChange={handleInputChange}
                              className={`form-control cedi-form-input ${errors.jobTitle ? 'is-invalid' : ''}`}
                              placeholder={isEmployed ? 'Enter job title' : 'Enter your role'}
                            />
                            {errors.jobTitle && <div className="invalid-feedback">{errors.jobTitle}</div>}
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          {isEmployed ? 'Work Address *' : 'Business Address *'}
                        </label>
                        <textarea
                          name="workAddress"
                          value={formData.workAddress}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.workAddress ? 'is-invalid' : ''}`}
                          placeholder={isEmployed ? 'Enter work address' : 'Enter business address'}
                          rows={3}
                        />
                        {errors.workAddress && <div className="invalid-feedback">{errors.workAddress}</div>}
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">
                              {isEmployed ? 'Work Phone' : 'Business Phone'}
                            </label>
                            <input
                              type="tel"
                              name="workPhone"
                              value={formData.workPhone}
                              onChange={handleInputChange}
                              className="form-control cedi-form-input"
                              placeholder="Enter phone number"
                            />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">
                              {isEmployed ? 'Employment Duration *' : 'Business Duration *'}
                            </label>
                            <input
                              type="number"
                              name="yearsOfEmployment"
                              value={formData.yearsOfEmployment}
                              onChange={handleInputChange}
                              className={`form-control cedi-form-input ${errors.yearsOfEmployment ? 'is-invalid' : ''}`}
                              placeholder="e.g., 2.5"
                              min="0"
                              step="0.1"
                            />
                            {errors.yearsOfEmployment && <div className="invalid-feedback">{errors.yearsOfEmployment}</div>}
                          </div>
                        </div>
                      </div>

                      {isEmployed && (
                        <div className="row mb-3">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label fw-medium text-dark">Supervisor Name</label>
                              <input
                                type="text"
                                name="supervisorName"
                                value={formData.supervisorName}
                                onChange={handleInputChange}
                                className="form-control cedi-form-input"
                                placeholder="Enter supervisor name"
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label fw-medium text-dark">Supervisor Phone</label>
                              <input
                                type="tel"
                                name="supervisorPhone"
                                value={formData.supervisorPhone}
                                onChange={handleInputChange}
                                className="form-control cedi-form-input"
                                placeholder="Enter supervisor phone"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {showIncomeFields && (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">Monthly Income (ZMW) *</label>
                            <input
                              type="number"
                              name="monthlyIncome"
                              value={formData.monthlyIncome}
                              onChange={handleInputChange}
                              className={`form-control cedi-form-input ${errors.monthlyIncome ? 'is-invalid' : ''}`}
                              placeholder="Enter monthly income"
                              min="0"
                              step="0.01"
                            />
                            {errors.monthlyIncome && <div className="invalid-feedback">{errors.monthlyIncome}</div>}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-medium text-dark">Additional Income (ZMW)</label>
                            <input
                              type="number"
                              name="additionalIncome"
                              value={formData.additionalIncome}
                              onChange={handleInputChange}
                              className="form-control cedi-form-input"
                              placeholder="Enter additional income"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      {formData.additionalIncome && (
                        <div className="mb-3">
                          <label className="form-label fw-medium text-dark">Additional Income Source</label>
                          <input
                            type="text"
                            name="additionalIncomeSource"
                            value={formData.additionalIncomeSource}
                            onChange={handleInputChange}
                            className="form-control cedi-form-input"
                            placeholder="e.g., Part-time job, Rental income, etc."
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="d-flex flex-column flex-sm-row gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/personal-info')}
                      className="btn btn-outline-secondary flex-grow-1 py-2"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary flex-grow-1 py-2"
                    >
                      {loading ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkInfo;