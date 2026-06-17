import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Brong-Ahafo",
  "Bono East",
  "Savannah",
  "North East",
  "Oti",
  "Ahafo",
  "Western North",
];

const PersonalInfo = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    city: "",
    region: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("registrationPersonalInfo");
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* ignore */
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email address";
    if (!formData.dateOfBirth)
      newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.region.trim()) newErrors.region = "Region is required";

    if (formData.dateOfBirth) {
      const today = new Date();
      const birth = new Date(formData.dateOfBirth);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18)
        newErrors.dateOfBirth = "You must be at least 18 years old to register";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      localStorage.setItem(
        "registrationPersonalInfo",
        JSON.stringify(formData),
      );
      showToast("Personal information saved!", "success");
      navigate("/register/set-pin");
    } catch (error) {
      console.error("Error saving personal info:", error);
      showToast(
        "Failed to save personal information. Please try again.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString()
    .split("T")[0];

  return (
    <div className="cedi-page-background d-flex align-items-start justify-content-center">
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            <div className="card cedi-card">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="cedi-logo-container mx-auto mb-3">
                    <span className="cedi-logo-text">CEDI</span>
                  </div>
                  <p className="text-muted small mb-1">Step 3 of 4</p>
                  <h1 className="cedi-title mb-2">Personal Information</h1>
                  <p className="text-muted">Tell us a little about yourself</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          First Name *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.firstName ? "is-invalid" : ""}`}
                          placeholder="Enter your first name"
                        />
                        {errors.firstName && (
                          <div className="invalid-feedback">
                            {errors.firstName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.lastName ? "is-invalid" : ""}`}
                          placeholder="Enter your last name"
                        />
                        {errors.lastName && (
                          <div className="invalid-feedback">
                            {errors.lastName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark">
                      Email Address{" "}
                      <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-control cedi-form-input ${errors.email ? "is-invalid" : ""}`}
                      placeholder="e.g. yourname@gmail.com"
                      autoComplete="email"
                    />
                    {errors.email && (
                      <div className="invalid-feedback">{errors.email}</div>
                    )}
                    <div className="form-text">
                      Used for loan notifications and account recovery.
                    </div>
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
                          max={maxDob}
                          className={`form-control cedi-form-input ${errors.dateOfBirth ? "is-invalid" : ""}`}
                        />
                        {errors.dateOfBirth && (
                          <div className="invalid-feedback">
                            {errors.dateOfBirth}
                          </div>
                        )}
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
                          className={`form-select cedi-form-input ${errors.gender ? "is-invalid" : ""}`}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        {errors.gender && (
                          <div className="invalid-feedback">
                            {errors.gender}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark">
                      Street Address
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="form-control cedi-form-input"
                      placeholder="e.g. 12 Airport Road"
                    />
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className={`form-control cedi-form-input ${errors.city ? "is-invalid" : ""}`}
                          placeholder="e.g. Accra"
                        />
                        {errors.city && (
                          <div className="invalid-feedback">{errors.city}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium text-dark">
                          Region *
                        </label>
                        <select
                          name="region"
                          value={formData.region}
                          onChange={handleInputChange}
                          className={`form-select cedi-form-input ${errors.region ? "is-invalid" : ""}`}
                        >
                          <option value="">Select region</option>
                          {GHANA_REGIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {errors.region && (
                          <div className="invalid-feedback">
                            {errors.region}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-column flex-sm-row gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="btn btn-outline-secondary flex-grow-1 py-2"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn cedi-btn-primary flex-grow-1 py-3 fw-semibold"
                    >
                      {loading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Saving...
                        </>
                      ) : (
                        "Continue to Set PIN →"
                      )}
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
