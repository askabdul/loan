import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useSocket } from '../../contexts/SocketContext';
import { loansAPI, usersAPI } from '../../services/api';
import configAPI from '../../services/configAPI';
import ContentAPI from '../../services/contentAPI';

// Add inline styles for contact cards
const contactCardStyles = `
  .contact-card:hover {
    transform: translateY(-2px);
    transition: transform 0.2s ease-in-out;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
  }
  
  .contact-card {
    transition: all 0.2s ease-in-out;
  }
  
  .process-step-card:hover {
    transform: translateY(-2px);
    transition: transform 0.2s ease-in-out;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
  }
  
  .process-step-card {
    transition: all 0.2s ease-in-out;
    cursor: pointer;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = contactCardStyles;
  document.head.appendChild(styleSheet);
}

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  useSocket(); // Initialize socket connection
  const [userStats, setUserStats] = useState({
    availableCredit: 0,
    loansCompleted: 0,
    creditScore: 0
  });
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
 
  const [appConfig, setAppConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [processGuide, setProcessGuide] = useState([]);
  const [faqData, setFaqData] = useState([]);
  const [contactInfo, setContactInfo] = useState([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Fetch app configuration
  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const configResponse = await configAPI.getCachedConfigs();
        if (configResponse.success) {
          setAppConfig(configResponse.data);
          // Config loaded successfully
        }
      } catch (error) {
        console.error('Error fetching app config:', error);
        // Use fallback config
        const fallbackConfig = configAPI.getDefaultConfig();
        setAppConfig(fallbackConfig.data);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchAppConfig();
  }, []);

  // Fetch dynamic content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [processGuideData, faqContent, contactData] = await Promise.all([
          ContentAPI.getProcessGuideContent(),
          ContentAPI.getFAQContent(),
          ContentAPI.getContactInfo()
        ]);
        
        setProcessGuide(processGuideData);
        setFaqData(faqContent);
        setContactInfo(contactData);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setContentLoading(false);
      }
    };

    fetchContent();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [profileResponse, loansResponse] = await Promise.all([
           usersAPI.getProfile(),
           loansAPI.getUserLoans()
         ]);
        
        const profile = profileResponse.user;
        const loans = loansResponse.loans || [];
        
        setUserProfile(profile);
        
        const completedLoans = loans.filter(loan => loan.status === 'completed').length;
        // Use dynamic credit limit or fallback to config default
        const availableCredit = profile.creditLimit || (appConfig?.default_credit_limit || 2000);
        // Use dynamic credit score or fallback to config default
        const creditScore = profile.creditScore || (appConfig?.credit_score_range?.default || 650);
        
        setUserStats({
          availableCredit,
          loansCompleted: completedLoans,
          creditScore
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Set default values on error using config or hardcoded fallbacks
        setUserStats({
          availableCredit: appConfig?.default_credit_limit || 2000,
          loansCompleted: 0,
          creditScore: appConfig?.credit_score_range?.default || 650
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && !configLoading) {
      fetchUserData();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, appConfig, configLoading]);





  const handleContactClick = (contact) => {
    const { type, value, displayText } = contact.content || {};
    
    switch (type) {
      case 'whatsapp':
        window.open(`https://wa.me/${value}`, '_blank');
        break;
      case 'phone':
        window.open(`tel:${value}`);
        break;
      case 'email':
        window.open(`mailto:${value}`);
        break;
      case 'faq':
        // Scroll to FAQ section
        document.getElementById('faqAccordion')?.scrollIntoView({ behavior: 'smooth' });
        break;
      default:
        console.log('Contact clicked:', contact.title);
    }
  };

  const handleProcessStepClick = (step, index) => {
    // Show detailed information about the process step
    const stepDetails = step.content?.fullDescription || step.content?.description || 'No additional details available.';
    const stepTitle = step.title || `Step ${index + 1}`;
    
    // Create a modal-like alert with step details
    const message = `${stepTitle}\n\n${stepDetails}`;
    
    if (step.content?.actionUrl) {
      // If there's an action URL, ask user if they want to navigate
      const shouldNavigate = window.confirm(`${message}\n\nWould you like to proceed with this step?`);
      if (shouldNavigate) {
        window.open(step.content.actionUrl, '_blank');
      }
    } else {
      // Just show the information
      alert(message);
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center">
              <h2 className="card-title mb-4">Welcome{userProfile?.personalInfo?.firstName ? `, ${userProfile.personalInfo.firstName}` : (user?.firstName ? `, ${user.firstName}` : '')}</h2>
              <p className="card-text mb-4">
                Your trusted partner for quick and easy loans
              </p>
              
              <div className="row g-3">
                <div className="col-6">
                  <div className="card bg-primary text-white h-100">
                    <div className="card-body d-flex flex-column justify-content-center">
                      <h5 className="card-title">Apply for Loan</h5>
                      <p className="card-text">Get instant loans up to GHS {(appConfig?.max_loan_amount || userStats.availableCredit || 5000).toLocaleString()}</p>
                      <button 
                        className="btn btn-light btn-sm mt-auto"
                        onClick={() => navigate('/apply')}
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="col-6">
                  <div className="card bg-success text-white h-100">
                    <div className="card-body d-flex flex-column justify-content-center">
                      <h5 className="card-title">Loan History</h5>
                      <p className="card-text">View your loan transactions</p>
                      <button 
                        className="btn btn-light btn-sm mt-auto"
                        onClick={() => navigate('/history')}
                      >
                        View History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="card bg-light">
                  <div className="card-body">
                    <h6 className="card-title">Quick Stats</h6>
                    <div className="row text-center">
                      <div className="col-4">
                        <div className="fw-bold text-primary">
                          {loading ? '...' : `GHS ${userStats.availableCredit.toLocaleString()}`}
                        </div>
                        <small className="text-muted">Available Credit</small>
                      </div>
                      <div className="col-4">
                        <div className="fw-bold text-success">
                          {loading ? '...' : userStats.loansCompleted}
                        </div>
                        <small className="text-muted">Loans Completed</small>
                      </div>
                      <div className="col-4">
                        <div className="fw-bold text-info">
                          {loading ? '...' : userStats.creditScore}
                        </div>
                        <small className="text-muted">Credit Score</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Application/Repayment Process Guide */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-primary">
            <div 
              className="card-header bg-primary text-white d-flex justify-content-between align-items-center" 
              style={{cursor: 'pointer'}}
              onClick={() => setShowGuide(!showGuide)}
            >
              <h5 className="mb-0">📋 Application/Repayment Process Guide</h5>
              <i className={`fas fa-chevron-${showGuide ? 'up' : 'down'}`}></i>
            </div>
            {showGuide && (
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6 col-lg-12 col-xl-12">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body text-center p-3">
                        <div className="mb-2">
                          <div className="bg-info text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                            <span className="fw-bold">1</span>
                          </div>
                        </div>
                        <h6 className="fw-bold mb-2">Registration</h6>
                        <p className="small text-muted mb-0" style={{fontSize: '0.8rem', lineHeight: '1.3'}}>
                          Create your CEDI account by providing your phone number and basic personal information. New users will receive verification.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6 col-lg-12 col-xl-12">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body text-center p-3">
                        <div className="mb-2">
                          <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                            <span className="fw-bold">2</span>
                          </div>
                        </div>
                        <h6 className="fw-bold mb-2">Login</h6>
                        <p className="small text-muted mb-0" style={{fontSize: '0.8rem', lineHeight: '1.3'}}>
                          Login with SMS OTP (new customers) or Phone PIN (returning customers). Secure access to your account.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6 col-lg-12 col-xl-12">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body text-center p-3">
                        <div className="mb-2">
                          <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                            <span className="fw-bold">3</span>
                          </div>
                        </div>
                        <h6 className="fw-bold mb-2">Apply for Loan</h6>
                        <p className="small text-muted mb-0" style={{fontSize: '0.8rem', lineHeight: '1.3'}}>
                          Complete your loan application by uploading NRC documents, providing references, and selecting loan amount.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6 col-lg-12 col-xl-12">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body text-center p-3">
                        <div className="mb-2">
                          <div className="bg-warning text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                            <span className="fw-bold">4</span>
                          </div>
                        </div>
                        <h6 className="fw-bold mb-2">Repayment</h6>
                        <p className="small text-muted mb-0" style={{fontSize: '0.8rem', lineHeight: '1.3'}}>
                          Repay your loan through the app, dial *885*3134#, or use mobile money. Easy and convenient payment options.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="row mt-4">
                  <div className="col-12">
                    <div className="alert alert-info border-0">
                      <div className="d-flex align-items-center mb-2">
                        <i className="fas fa-info-circle me-2"></i>
                        <h6 className="mb-0 fw-bold">Complete Process Flow:</h6>
                      </div>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <small className="d-block"><strong>📱 Registration:</strong> Sign up with phone number and verify identity</small>
                          <small className="d-block"><strong>🔐 Login:</strong> Access account with OTP or PIN</small>
                        </div>
                        <div className="col-md-6">
                          <small className="d-block"><strong>📋 Application:</strong> Submit loan request with required documents</small>
                          <small className="d-block"><strong>💳 Repayment:</strong> Pay back loan through multiple convenient methods</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-info">
            <div 
              className="card-header bg-info text-white d-flex justify-content-between align-items-center" 
              style={{cursor: 'pointer'}}
              onClick={() => setShowFAQ(!showFAQ)}
            >
              <h5 className="mb-0">❓ Frequently Asked Questions</h5>
              <i className={`fas fa-chevron-${showFAQ ? 'up' : 'down'}`}></i>
            </div>
            {showFAQ && (
              <div className="card-body">
                <div className="accordion" id="faqAccordion">
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 0 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
                      >
                        <span className="me-2">1.</span>
                        What is the minimum and maximum loan amount I can apply for?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 0 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>CEDI offers flexible loan amounts ranging from GHS 500 to GHS 50,000. The exact amount you qualify for depends on your credit profile, income verification, and repayment history with us.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 1 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                      >
                        <span className="me-2">2.</span>
                        How long does it take to get loan approval?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 1 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>Most loan applications are processed within 24-48 hours. New customers may take slightly longer (up to 72 hours) as we verify your information. Once approved, funds are disbursed immediately to your mobile money account.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 2 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
                      >
                        <span className="me-2">3.</span>
                        What documents do I need to apply?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 2 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>You need a valid National Registration Card (NRC), a selfie with your NRC, and contact information for two references. All documents can be uploaded directly through the app.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 3 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 3 ? null : 3)}
                      >
                        <span className="me-2">4.</span>
                        How do I repay my loan?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 3 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>You can repay through the app by clicking 'Pay The Bill', or dial *885*3134# from your registered phone number. We also accept payments through mobile money and bank transfers.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 4 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 4 ? null : 4)}
                      >
                        <span className="me-2">5.</span>
                        What happens if I miss a payment?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 4 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>We understand that sometimes circumstances change. Contact our customer service immediately if you anticipate difficulty making a payment. Late payments may incur additional fees and affect your credit score with us.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button ${expandedFaq === 5 ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === 5 ? null : 5)}
                      >
                        <span className="me-2">6.</span>
                        Is my personal information secure?
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${expandedFaq === 5 ? 'show' : ''}`}>
                      <div className="accordion-body">
                        <p>Yes, CEDI uses bank-level encryption and security measures to protect your personal and financial information. We comply with all data protection regulations and never share your information with unauthorized third parties.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Us Section */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                <div className="list-group-item d-flex align-items-center py-3 px-4 border-0" style={{cursor: 'pointer'}}>
                  <div className="me-3">
                    <div className="bg-success rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                      <i className="fab fa-whatsapp text-white fs-5"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0 fw-bold">WhatsApp</h6>
                  </div>
                  <div>
                    <i className="fas fa-chevron-right text-muted"></i>
                  </div>
                </div>
                
                <div className="list-group-item d-flex align-items-center py-3 px-4 border-0" style={{cursor: 'pointer'}}>
                  <div className="me-3">
                    <div className="bg-info rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                      <i className="fas fa-phone text-white fs-5"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0 fw-bold">Contact</h6>
                  </div>
                  <div>
                    <i className="fas fa-chevron-right text-muted"></i>
                  </div>
                </div>
                
                <div className="list-group-item d-flex align-items-center py-3 px-4 border-0" style={{cursor: 'pointer'}}>
                  <div className="me-3">
                    <div className="bg-warning rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                      <i className="fas fa-envelope text-white fs-5"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0 fw-bold">customer@cedilending.com</h6>
                  </div>
                  <div>
                    <i className="fas fa-chevron-right text-muted"></i>
                  </div>
                </div>
                
                {/* <div className="list-group-item d-flex align-items-center py-3 px-4 border-0" style={{cursor: 'pointer'}} onClick={() => setShowFAQ(!showFAQ)}>
                  <div className="me-3">
                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                      <i className="fas fa-question text-white fs-5"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0 fw-bold">FAQ</h6>
                  </div>
                  <div>
                    <i className="fas fa-chevron-right text-muted"></i>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </div>
      

    </div>
  );
};

export default Home;