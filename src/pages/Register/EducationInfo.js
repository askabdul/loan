import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const EducationInfo = () => {
  const [formData, setFormData] = useState({
    highestEducation: '',
    institutionName: '',
    fieldOfStudy: '',
    graduationYear: '',
    currentlyStudying: false,
    professionalCertifications: '',
    skills: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
    
    if (!formData.highestEducation) newErrors.highestEducation = 'Education level is required';
    
    // Only require institution name for higher education levels
    const requiresInstitution = ['diploma', 'bachelor', 'master', 'doctorate'].includes(formData.highestEducation);
    if (requiresInstitution && !formData.institutionName.trim()) {
      newErrors.institutionName = 'Institution name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Save education info to localStorage (same pattern as PersonalInfo and WorkInfo)
      localStorage.setItem('educationInfo', JSON.stringify(formData));
      
      toast.success('Education information saved!');
      
      // Navigate to next step - Emergency Contacts
      navigate('/emergency-contacts');
    } catch (error) {
      console.error('Error saving education info:', error);
      toast.error('Failed to save education information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);
  const showInstitutionFields = ['diploma', 'bachelor', 'master', 'doctorate'].includes(formData.highestEducation);

  return (
    <div className="min-vh-100 cedi-gradient py-4">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-md-12 col-lg-12 col-xl-12, ">
            <div className="card shadow-lg border-0 rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="cedi-logo-badge mx-auto mb-3">
                    <span className="text-white fw-bold fs-5">CEDI</span>
                  </div>
                  <h1 className="h2 fw-bold text-dark mb-2">Education Information</h1>
                  <p className="text-muted">
                    Tell us about your educational background
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="highestEducation" className="form-label fw-medium text-dark">
                      Highest Level of Education *
                    </label>
                    <select
                      id="highestEducation"
                      name="highestEducation"
                      value={formData.highestEducation}
                      onChange={handleInputChange}
                      className={`form-select cedi-form-input ${errors.highestEducation ? 'is-invalid' : ''}`}
                    >
                      <option value="">Select education level</option>
                      <option value="primary">Primary School</option>
                      <option value="secondary">Secondary School</option>
                      <option value="diploma">Diploma/Certificate</option>
                      <option value="bachelor">Bachelor's Degree</option>
                      <option value="master">Master's Degree</option>
                      <option value="doctorate">Doctorate/PhD</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.highestEducation && <div className="invalid-feedback">{errors.highestEducation}</div>}
                  </div>

                  {showInstitutionFields && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="institutionName" className="form-label fw-medium text-dark">
                          Institution Name *
                        </label>
                        <input
                          type="text"
                          id="institutionName"
                          name="institutionName"
                          value={formData.institutionName}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.institutionName ? 'is-invalid' : ''}`}
                          placeholder="Enter institution name"
                        />
                        {errors.institutionName && <div className="invalid-feedback">{errors.institutionName}</div>}
                      </div>

                      <div className="mb-3">
                        <label htmlFor="fieldOfStudy" className="form-label fw-medium text-dark">
                          Field of Study
                        </label>
                        <input
                          type="text"
                          id="fieldOfStudy"
                          name="fieldOfStudy"
                          value={formData.fieldOfStudy}
                          onChange={handleInputChange}
                          className="form-control cedi-form-input"
                          placeholder="Enter field of study"
                        />
                      </div>

                      <div className="mb-3">
                        <label htmlFor="graduationYear" className="form-label fw-medium text-dark">
                          Graduation Year
                        </label>
                        <select
                          id="graduationYear"
                          name="graduationYear"
                          value={formData.graduationYear}
                          onChange={handleInputChange}
                          className="form-select cedi-form-input"
                        >
                          <option value="">Select graduation year</option>
                          {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        id="currentlyStudying"
                        name="currentlyStudying"
                        checked={formData.currentlyStudying}
                        onChange={handleInputChange}
                        className="form-check-input"
                      />
                      <label htmlFor="currentlyStudying" className="form-check-label fw-medium text-dark">
                        Currently studying
                      </label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="professionalCertifications" className="form-label fw-medium text-dark">
                      Professional Certifications
                    </label>
                    <textarea
                      id="professionalCertifications"
                      name="professionalCertifications"
                      value={formData.professionalCertifications}
                      onChange={handleInputChange}
                      className="form-control cedi-form-input"
                      rows="3"
                      placeholder="List any professional certifications (optional)"
                    ></textarea>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="skills" className="form-label fw-medium text-dark">
                      Skills & Competencies
                    </label>
                    <textarea
                      id="skills"
                      name="skills"
                      value={formData.skills}
                      onChange={handleInputChange}
                      className="form-control cedi-form-input"
                      rows="3"
                      placeholder="List your key skills and competencies (optional)"
                    ></textarea>
                  </div>

                  <div className="row mt-4">
                    <div className="col-6">
                      <button
                        type="button"
                        onClick={() => navigate('/work-info')}
                        className="btn btn-outline-secondary w-100 py-3 fw-semibold"
                      >
                        Back
                      </button>
                    </div>
                    <div className="col-6">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn w-100 py-3 fw-semibold cedi-btn-primary"
                      >
                        {loading ? 'Saving...' : 'Continue'}
                      </button>
                    </div>
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

export default EducationInfo;