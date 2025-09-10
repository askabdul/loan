import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const PersonalInfo = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    address: '',
    city: '',
    state: '',
    postalCode: ''
  });

  // Load existing data from localStorage on component mount
  useEffect(() => {
    const savedPersonalInfo = localStorage.getItem('personalInfo');
    if (savedPersonalInfo) {
      try {
        const parsedData = JSON.parse(savedPersonalInfo);
        setFormData(parsedData);
      } catch (error) {
        console.error('Error parsing saved personal info:', error);
      }
    }
  }, []);
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
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    
    // Age validation
    if (formData.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(formData.dateOfBirth);
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Save personal info to localStorage
      localStorage.setItem('personalInfo', JSON.stringify(formData));
      
      toast.success('Personal information saved!');
      
      // Navigate to next step - Work Information
      navigate('/work-info');
    } catch (error) {
      console.error('Error saving personal info:', error);
      toast.error('Failed to save personal information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
                  <h1 className="h2 fw-bold text-cedi-dark mb-2">Personal Information</h1>
                  <p className="text-muted">Please provide your personal details</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="row mb-3">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          First Name *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.firstName ? 'is-invalid' : ''}`}
                          placeholder="Enter your first name"
                        />
                        {errors.firstName && <div className="invalid-feedback">{errors.firstName}</div>}
                      </div>
                    </div>

                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.lastName ? 'is-invalid' : ''}`}
                          placeholder="Enter your last name"
                        />
                        {errors.lastName && <div className="invalid-feedback">{errors.lastName}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-control cedi-form-input ${errors.email ? 'is-invalid' : ''}`}
                      placeholder="Enter your email address"
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Date of Birth *
                        </label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.dateOfBirth ? 'is-invalid' : ''}`}
                        />
                        {errors.dateOfBirth && <div className="invalid-feedback">{errors.dateOfBirth}</div>}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Gender *
                        </label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className={`form-select cedi-form-input ${errors.gender ? 'is-invalid' : ''}`}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        {errors.gender && <div className="invalid-feedback">{errors.gender}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark">
                      Marital Status
                    </label>
                    <select
                      name="maritalStatus"
                      value={formData.maritalStatus}
                      onChange={handleInputChange}
                      className="form-select cedi-form-input"
                    >
                      <option value="">Select marital status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark">
                      Address *
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className={`form-control cedi-form-input ${errors.address ? 'is-invalid' : ''}`}
                      placeholder="Enter your full address"
                      rows={3}
                    />
                    {errors.address && <div className="invalid-feedback">{errors.address}</div>}
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.city ? 'is-invalid' : ''}`}
                          placeholder="Enter your city"
                        />
                        {errors.city && <div className="invalid-feedback">{errors.city}</div>}
                      </div>
                    </div>

                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          State *
                        </label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.state ? 'is-invalid' : ''}`}
                          placeholder="Enter your state"
                        />
                        {errors.state && <div className="invalid-feedback">{errors.state}</div>}
                      </div>
                    </div>

                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          className="form-control cedi-form-input"
                          placeholder="Enter postal code"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-flex flex-column flex-sm-row gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/set-pin')}
                      className="btn btn-outline-secondary flex-grow-1 py-2"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary flex-grow-1 py-2"
                    >
                      {loading ? 'Completing Registration...' : 'Complete Registration'}
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

export default PersonalInfo;