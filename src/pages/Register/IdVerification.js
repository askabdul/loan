import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const IdVerification = () => {
  const [documents, setDocuments] = useState({
    idType: '',
    idNumber: '',
    idFront: null,
    idBack: null,
    selfie: null,
    proofOfAddress: null
  });
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDocuments(prev => ({
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

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          [fieldName]: 'File size must be less than 5MB'
        }));
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({
          ...prev,
          [fieldName]: 'Only JPEG, PNG, and PDF files are allowed'
        }));
        return;
      }

      setDocuments(prev => ({
        ...prev,
        [fieldName]: file
      }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => ({
            ...prev,
            [fieldName]: e.target.result
          }));
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews(prev => ({
          ...prev,
          [fieldName]: null
        }));
      }

      // Clear error
      if (errors[fieldName]) {
        setErrors(prev => ({
          ...prev,
          [fieldName]: ''
        }));
      }
    }
  };

  const removeFile = (fieldName) => {
    setDocuments(prev => ({
      ...prev,
      [fieldName]: null
    }));
    setPreviews(prev => ({
      ...prev,
      [fieldName]: null
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!documents.idType) newErrors.idType = 'ID type is required';
    if (!documents.idNumber.trim()) newErrors.idNumber = 'ID number is required';
    if (!documents.idFront) newErrors.idFront = 'Front of ID is required';
    if (!documents.selfie) newErrors.selfie = 'Selfie is required';
    
    // Back of ID required for certain types
    if (['national-id', 'drivers-license'].includes(documents.idType) && !documents.idBack) {
      newErrors.idBack = 'Back of ID is required for this document type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Get all registration data from localStorage
      const phoneNumber = localStorage.getItem('registrationPhone');
      const pin = localStorage.getItem('userPin');
      const personalInfo = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      const workInfo = JSON.parse(localStorage.getItem('workInfo') || '{}');
      const educationInfo = JSON.parse(localStorage.getItem('educationInfo') || '{}');
      const emergencyContacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
      
      if (!phoneNumber || !pin) {
         toast.error('Registration data incomplete. Please start over.');
         navigate('/register');
         return;
       }
      
      // Prepare complete registration data
      const registrationData = {
        phoneNumber: phoneNumber,
        pin: pin,
        personalInfo: {
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          email: personalInfo.email,
          dateOfBirth: personalInfo.dateOfBirth,
          gender: personalInfo.gender,
          maritalStatus: personalInfo.maritalStatus,
          address: personalInfo.address,
          city: personalInfo.city,
          state: personalInfo.state,
          postalCode: personalInfo.postalCode
        },
        workInfo: {
          employmentStatus: workInfo.employmentStatus,
          employer: workInfo.employer,
          jobTitle: workInfo.jobTitle,
          monthlyIncome: workInfo.monthlyIncome,
          workAddress: workInfo.workAddress,
          yearsOfEmployment: workInfo.yearsOfEmployment
        },
        educationInfo: {
          highestLevel: educationInfo.highestEducation,
          institution: educationInfo.institutionName,
          fieldOfStudy: educationInfo.fieldOfStudy,
          graduationYear: educationInfo.graduationYear
        },
        emergencyContacts: emergencyContacts.map(contact => ({
          name: contact.name,
          relationship: contact.relationship,
          phoneNumber: contact.phone,
          email: contact.email
        })),
        idVerification: {
          idType: documents.idType,
          idNumber: documents.idNumber,
          isVerified: false
        }
      };
      
      // Submit complete registration to backend
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/register-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Clear all registration data from localStorage
        localStorage.removeItem('registrationPhone');
        localStorage.removeItem('userPin');
        localStorage.removeItem('personalInfo');
        localStorage.removeItem('workInfo');
        localStorage.removeItem('educationInfo');
        localStorage.removeItem('emergencyContacts');
        localStorage.removeItem('idVerification');
        
        // Store user data and token
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        toast.success('Registration completed successfully!');
         navigate('/home');
      } else {
        toast.error(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const FileUploadBox = ({ fieldName, label, required, accept, description }) => {
    const file = documents[fieldName];
    const preview = previews[fieldName];
    const error = errors[fieldName];

    return (
      <div className="border border-2 border-dashed rounded p-4 text-center" style={{ borderColor: '#e9ecef', backgroundColor: '#f8f9fa' }}>
        <input
          type="file"
          id={fieldName}
          accept={accept}
          onChange={(e) => handleFileChange(e, fieldName)}
          className="d-none"
        />
        
        {file ? (
          <div className="d-flex flex-column gap-3">
            {preview && (
              <img src={preview} alt="Preview" className="mx-auto rounded" style={{ height: '128px', width: 'auto' }} />
            )}
            <div className="small text-muted">
              <p className="fw-medium mb-1">{file.name}</p>
              <p className="mb-0">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div className="d-flex justify-content-center gap-2">
              <label
                htmlFor={fieldName}
                className="btn btn-primary btn-sm cedi-btn-primary"
                style={{ cursor: 'pointer' }}
              >
                Replace
              </label>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeFile(fieldName)}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            <div className="text-primary" style={{ fontSize: '2.5rem' }}>
              📁
            </div>
            <div>
              <p className="text-dark fw-medium mb-1">{label} {required && <span className="text-danger">*</span>}</p>
              <p className="small text-muted">{description}</p>
            </div>
            <label
              htmlFor={fieldName}
              className="btn btn-primary cedi-btn-primary"
              style={{ cursor: 'pointer' }}
            >
              Choose File
            </label>
          </div>
        )}
        
        {error && <p className="text-danger small mt-2">{error}</p>}
      </div>
    );
  };

  return (
    <div className="cedi-page-background">
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-12 col-lg-12 col-xl-12">
            <div className="card cedi-card">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <h1 className="h2 fw-bold text-cedi-dark mb-2">Identity Verification</h1>
                  <p className="text-muted">
                    Upload your identification documents to complete your registration
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="row mb-4">
                    <div className="col-md-12 mb-3">
                      <label className="form-label fw-medium text-cedi-dark">
                        ID Type *
                      </label>
                      <select
                        name="idType"
                        value={documents.idType}
                        onChange={handleInputChange}
                        className={`form-select cedi-form-input ${
                          errors.idType ? 'is-invalid' : ''
                        }`}
                      >
                        <option value="">Select ID type</option>
                        <option value="national-id">National ID Card</option>
                        <option value="drivers-license">Driver's License</option>
                        <option value="passport">International Passport</option>
                        <option value="voters-card">Voter's Card</option>
                      </select>
                      {errors.idType && <div className="invalid-feedback">{errors.idType}</div>}
                    </div>

                    <div className="col-md-12 mb-3">
                      <label className="form-label fw-medium text-cedi-dark">
                        ID Number *
                      </label>
                      <input
                        type="text"
                        name="idNumber"
                        value={documents.idNumber}
                        onChange={handleInputChange}
                        className={`form-control cedi-form-input ${
                          errors.idNumber ? 'is-invalid' : ''
                        }`}
                        placeholder="Enter ID number"
                      />
                      {errors.idNumber && <div className="invalid-feedback">{errors.idNumber}</div>}
                    </div>
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-12 mb-4">
                      <h5 className="fw-medium text-cedi-dark mb-3">Front of ID *</h5>
                      <FileUploadBox
                        fieldName="idFront"
                        label="Front of ID"
                        required
                        accept="image/*,.pdf"
                        description="Clear photo of the front of your ID"
                      />
                    </div>

                    {['national-id', 'drivers-license'].includes(documents.idType) && (
                      <div className="col-md-12 mb-4">
                        <h5 className="fw-medium text-cedi-dark mb-3">Back of ID *</h5>
                        <FileUploadBox
                          fieldName="idBack"
                          label="Back of ID"
                          required
                          accept="image/*,.pdf"
                          description="Clear photo of the back of your ID"
                        />
                      </div>
                    )}
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-12 mb-4">
                      <h5 className="fw-medium text-cedi-dark mb-3">Selfie Photo *</h5>
                      <FileUploadBox
                        fieldName="selfie"
                        label="Selfie"
                        required
                        accept="image/*"
                        description="Clear selfie holding your ID next to your face"
                      />
                    </div>

                    <div className="col-md-12 mb-4">
                      <h5 className="fw-medium text-cedi-dark mb-3">Proof of Address</h5>
                      <FileUploadBox
                        fieldName="proofOfAddress"
                        label="Proof of Address"
                        accept="image/*,.pdf"
                        description="Utility bill, bank statement, or lease agreement (optional)"
                      />
                    </div>
                  </div>

                  <div className="alert alert-info border-primary" style={{ backgroundColor: '#e7f3ff', borderColor: '#b3d9ff' }}>
                    <h5 className="fw-semibold text-dark mb-3">📋 Document Guidelines</h5>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="d-flex flex-column gap-2 small text-muted">
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>Ensure documents are clear and readable</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>All four corners of the ID should be visible</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>No glare or shadows on the documents</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>Files must be less than 5MB each</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="d-flex flex-column gap-2 small text-muted">
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>Accepted formats: JPEG, PNG, PDF</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>For selfie: hold ID next to your face</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>Ensure your face is clearly visible</span>
                          </div>
                          <div className="d-flex align-items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>Documents will be verified within 24-48 hours</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-column flex-sm-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/emergency-contacts')}
                      className="btn btn-secondary flex-fill py-3"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary flex-fill py-3 cedi-btn-primary"
                    >
                      {loading ? 'Uploading Documents...' : 'Complete Registration'}
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

export default IdVerification;