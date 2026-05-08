import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([
    {
      id: 1,
      name: '',
      relationship: '',
      phone: '',
      email: '',
      address: ''
    },
    {
      id: 2,
      name: '',
      relationship: '',
      phone: '',
      email: '',
      address: ''
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleContactChange = (contactId, field, value) => {
    setContacts(prev => prev.map(contact => 
      contact.id === contactId 
        ? { ...contact, [field]: value }
        : contact
    ));
    
    // Clear error when user starts typing
    const errorKey = `${contactId}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const userPhone = localStorage.getItem('registrationPhone');
    const phoneNumbers = [];
    
    contacts.forEach((contact, index) => {
      const contactNum = index + 1;
      
      if (!contact.name.trim()) {
        newErrors[`${contact.id}_name`] = `Contact ${contactNum} name is required`;
      }
      
      if (!contact.relationship.trim()) {
        newErrors[`${contact.id}_relationship`] = `Contact ${contactNum} relationship is required`;
      }
      
      if (!contact.phone.trim()) {
        newErrors[`${contact.id}_phone`] = `Contact ${contactNum} phone is required`;
      } else if (contact.phone.length < 10) {
        newErrors[`${contact.id}_phone`] = `Contact ${contactNum} phone must be valid`;
      } else {
        // Check if phone number matches user's registered phone
        if (contact.phone === userPhone) {
          newErrors[`${contact.id}_phone`] = `Contact ${contactNum} phone cannot be the same as your registered phone number`;
        }
        
        // Check for duplicate phone numbers
        if (phoneNumbers.includes(contact.phone)) {
          newErrors[`${contact.id}_phone`] = `Contact ${contactNum} phone number is already used by another emergency contact`;
        } else {
          phoneNumbers.push(contact.phone);
        }
      }
      
      if (contact.email && !/\S+@\S+\.\S+/.test(contact.email)) {
        newErrors[`${contact.id}_email`] = `Contact ${contactNum} email must be valid`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Save emergency contacts to localStorage (same pattern as other registration steps)
      localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
      
      toast.success('Emergency contacts saved!');
      
      // Navigate to next step - ID Verification
      navigate('/id-verification');
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
      toast.error('Failed to save emergency contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addContact = () => {
    if (contacts.length < 3) {
      const newId = Math.max(...contacts.map(c => c.id)) + 1;
      setContacts(prev => [...prev, {
        id: newId,
        name: '',
        relationship: '',
        phone: '',
        email: '',
        address: ''
      }]);
    }
  };

  const removeContact = (contactId) => {
    if (contacts.length > 2) {
      setContacts(prev => prev.filter(contact => contact.id !== contactId));
      // Clear errors for removed contact
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`${contactId}_`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
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
                  <h1 className="h2 fw-bold text-cedi-dark mb-2">Emergency Contacts</h1>
                  <p className="text-muted">
                    Provide at least 2 emergency contacts who can be reached if needed
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  {contacts.map((contact, index) => (
                    <div key={contact.id} className="card mb-4 border-cedi-light">
                      <div className="card-body p-4" style={{ backgroundColor: 'rgba(248, 249, 250, 0.5)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h3 className="h5 fw-semibold text-cedi-dark mb-0">
                            Emergency Contact {index + 1}
                          </h3>
                          {contacts.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeContact(contact.id)}
                              className="btn btn-outline-danger btn-sm px-3 py-1"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="row">
                          <div className="col-md-12 mb-12">
                            <label className="form-label fw-medium text-cedi-dark">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                              className={`form-control cedi-form-input ${
                                errors[`${contact.id}_name`] ? 'is-invalid' : ''
                              }`}
                              placeholder="Enter full name"
                            />
                            {errors[`${contact.id}_name`] && (
                              <div className="invalid-feedback">{errors[`${contact.id}_name`]}</div>
                            )}
                          </div>

                          <div className="col-md-6 mb-3">
                            <label className="form-label fw-medium text-cedi-dark">
                              Relationship *
                            </label>
                            <select
                              value={contact.relationship}
                              onChange={(e) => handleContactChange(contact.id, 'relationship', e.target.value)}
                              className={`form-select cedi-form-input ${
                                errors[`${contact.id}_relationship`] ? 'is-invalid' : ''
                              }`}
                            >
                              <option value="">Select relationship</option>
                              <option value="parent">Parent</option>
                              <option value="sibling">Sibling</option>
                              <option value="spouse">Spouse</option>
                              <option value="child">Child</option>
                              <option value="friend">Friend</option>
                              <option value="colleague">Colleague</option>
                              <option value="relative">Other Relative</option>
                              <option value="other">Other</option>
                            </select>
                            {errors[`${contact.id}_relationship`] && (
                              <div className="invalid-feedback">{errors[`${contact.id}_relationship`]}</div>
                            )}
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-12 mb-3">
                            <label className="form-label fw-medium text-cedi-dark">
                              Phone Number *
                            </label>
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                              className={`form-control cedi-form-input ${
                                errors[`${contact.id}_phone`] ? 'is-invalid' : ''
                              }`}
                              placeholder="Enter phone number"
                            />
                            {errors[`${contact.id}_phone`] && (
                              <div className="invalid-feedback">{errors[`${contact.id}_phone`]}</div>
                            )}
                          </div>

                          <div className="col-md-12 mb-3">
                            <label className="form-label fw-medium text-cedi-dark">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={contact.email}
                              onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                              className={`form-control cedi-form-input ${
                                errors[`${contact.id}_email`] ? 'is-invalid' : ''
                              }`}
                              placeholder="Enter email address (optional)"
                            />
                            {errors[`${contact.id}_email`] && (
                              <div className="invalid-feedback">{errors[`${contact.id}_email`]}</div>
                            )}
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-12 mb-3">
                            <label className="form-label fw-medium text-cedi-dark">
                              Address
                            </label>
                            <textarea
                              rows={2}
                              value={contact.address}
                              onChange={(e) => handleContactChange(contact.id, 'address', e.target.value)}
                              className="form-control cedi-form-input"
                              placeholder="Enter address (optional)"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {contacts.length < 3 && (
                    <div className="text-center mb-4">
                      <button
                        type="button"
                        onClick={addContact}
                        className="btn btn-outline-primary d-inline-flex align-items-center px-4 py-2"
                      >
                        <svg className="me-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Another Contact
                      </button>
                    </div>
                  )}

                  <div className="alert alert-info cedi-info-box">
                    <h6 className="fw-medium mb-2">Important Notes:</h6>
                    <ul className="mb-0 small">
                      <li>Emergency contacts should be people who know you well</li>
                      <li>They may be contacted for verification purposes</li>
                      <li>Please ensure the contact information is accurate and up-to-date</li>
                      <li>Your contacts will not be charged or held responsible for your loan</li>
                    </ul>
                  </div>

                  <div className="row pt-4">
                    <div className="col-12 col-sm-6 mb-2 mb-sm-0">
                      <button
                        type="button"
                        onClick={() => navigate('/education-info')}
                        className="btn btn-secondary w-100 py-3 fw-semibold"
                      >
                        Back
                      </button>
                    </div>
                    <div className="col-12 col-sm-6">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn cedi-btn-primary w-100 py-3 fw-semibold"
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

export default EmergencyContacts;