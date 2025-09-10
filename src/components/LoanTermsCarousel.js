import React, { useState, useEffect, useRef } from 'react';
import { loanLevelsAPI } from '../services/loanLevelsAPI';
import './LoanTermsCarousel.css';

const LoanTermsCarousel = ({ selectedTerm, onTermChange, userLevel }) => {
  const [availableTerms, setAvailableTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch available loan terms for the user
  useEffect(() => {
    const fetchAvailableTerms = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to get user-specific terms first, fallback to all terms
        let response;
        try {
          response = await loanLevelsAPI.getUserAvailableTerms();
        } catch (userTermsError) {
          console.warn('User-specific terms not available, fetching all terms:', userTermsError);
          response = await loanLevelsAPI.getAllLoanTerms();
        }
        
        if (response.success && response.data) {
          const terms = Array.isArray(response.data) ? response.data : response.data.terms || [];
          // Filter active terms and sort by duration
          const activeTerms = terms
            .filter(term => term.isActive && term.enabled)
            .sort((a, b) => a.durationDays - b.durationDays);
          
          setAvailableTerms(activeTerms);
          
          // Auto-select first term if no term is selected
          if (activeTerms.length > 0 && !selectedTerm) {
            onTermChange(activeTerms[0].durationDays, activeTerms[0]);
          }
        } else {
          // Fallback to default terms if API fails
          const defaultTerms = [
            { _id: '1', durationDays: 7, displayName: '7 days', interestRate: 5, isActive: true },
            { _id: '2', durationDays: 14, displayName: '14 days', interestRate: 8, isActive: true },
            { _id: '3', durationDays: 30, displayName: '30 days', interestRate: 12, isActive: true }
          ];
          setAvailableTerms(defaultTerms);
          if (!selectedTerm) {
            onTermChange(defaultTerms[0].durationDays, defaultTerms[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching loan terms:', err);
        setError('Failed to load loan terms');
        
        // Fallback to default terms
        const defaultTerms = [
          { _id: '1', durationDays: 7, displayName: '7 days', interestRate: 5, isActive: true },
          { _id: '2', durationDays: 14, displayName: '14 days', interestRate: 8, isActive: true },
          { _id: '3', durationDays: 30, displayName: '30 days', interestRate: 12, isActive: true }
        ];
        setAvailableTerms(defaultTerms);
        if (!selectedTerm) {
          onTermChange(defaultTerms[0].durationDays, defaultTerms[0]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableTerms();
  }, [userLevel, selectedTerm, onTermChange]);

  // Check scroll position and update scroll indicators
  const checkScrollPosition = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  // Handle scroll events
  useEffect(() => {
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', checkScrollPosition);
      checkScrollPosition(); // Initial check
      
      return () => {
        carousel.removeEventListener('scroll', checkScrollPosition);
      };
    }
  }, [availableTerms]);

  // Scroll functions
  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // Handle term selection
  const handleTermSelect = (term) => {
    onTermChange(term.durationDays, term);
  };

  // Format term display
  const formatTermDisplay = (term) => {
    if (term.displayName) {
      return term.displayName;
    }
    
    if (term.durationDays === 1) {
      return '1 day';
    } else if (term.durationDays < 30) {
      return `${term.durationDays} days`;
    } else if (term.durationDays === 30) {
      return '1 month';
    } else {
      const months = Math.floor(term.durationDays / 30);
      const remainingDays = term.durationDays % 30;
      if (remainingDays === 0) {
        return `${months} month${months > 1 ? 's' : ''}`;
      } else {
        return `${months}m ${remainingDays}d`;
      }
    }
  };

  if (loading) {
    return (
      <div className="card custom-card">
        <div className="card-body">
          <h3 className="card-title text-success mb-4">📅 Loan Term</h3>
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm text-success" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 mb-0 text-muted">Loading loan terms...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card custom-card">
        <div className="card-body">
          <h3 className="card-title text-success mb-4">📅 Loan Term</h3>
          <div className="alert alert-warning" role="alert">
            <small>{error}</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card custom-card">
      <div className="card-body">
        <h3 className="card-title text-success mb-4">📅 Loan Term</h3>
        
        <div className="loan-terms-carousel-container">
          {/* Left scroll button */}
          {canScrollLeft && (
            <button 
              className="carousel-scroll-btn carousel-scroll-left"
              onClick={scrollLeft}
              aria-label="Scroll left"
            >
              ‹
            </button>
          )}
          
          {/* Terms carousel */}
          <div 
            className="loan-terms-carousel"
            ref={carouselRef}
          >
            {availableTerms.map((term) => {
              const isSelected = selectedTerm === term.durationDays;
              return (
                <div
                  key={term._id || term.durationDays}
                  className={`loan-term-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleTermSelect(term)}
                >
                  <div className="term-duration">
                    {formatTermDisplay(term)}
                  </div>
                  <div className="term-details">
                    <div className="term-interest">
                      {term.interestRate}% interest
                    </div>
                    {term.serviceFeeRate && (
                      <div className="term-fee">
                        +{term.serviceFeeRate}% service
                      </div>
                    )}
                    {term.processingFeeRate && (
                      <div className="term-fee">
                        +{term.processingFeeRate}% processing
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Right scroll button */}
          {canScrollRight && (
            <button 
              className="carousel-scroll-btn carousel-scroll-right"
              onClick={scrollRight}
              aria-label="Scroll right"
            >
              ›
            </button>
          )}
        </div>
        
        {/* Terms count indicator */}
        {availableTerms.length > 3 && (
          <div className="text-center mt-2">
            <small className="text-muted">
              {availableTerms.length} terms available • Swipe to see more
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanTermsCarousel;