import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const GHANA_REGIONS = [
  "Greater Accra","Ashanti","Western","Eastern","Central","Volta",
  "Northern","Upper East","Upper West","Brong-Ahafo","Bono East",
  "Savannah","North East","Oti","Ahafo","Western North",
];

const PersonalInfo = () => {
  const [formData, setFormData] = useState({
    firstName:"",lastName:"",email:"",dateOfBirth:"",gender:"",address:"",city:"",region:"",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("registrationPersonalInfo");
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch { /* ignore */ }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email address";
    if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.region.trim()) newErrors.region = "Region is required";
    if (formData.dateOfBirth) {
      const today = new Date();
      const birth = new Date(formData.dateOfBirth);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) newErrors.dateOfBirth = "You must be at least 18 years old to register";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      localStorage.setItem("registrationPersonalInfo", JSON.stringify(formData));
      showToast("Personal information saved!", "success");
      navigate("/register/set-pin");
    } catch {
      showToast("Failed to save personal information. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString().split("T")[0];

  const inputCls = (f) => `form-control cedi-form-input${errors[f] ? " is-invalid" : ""}`;
  const selectCls = (f) => `form-select cedi-form-input${errors[f] ? " is-invalid" : ""}`;

  return (
    <div className="cedi-page-background d-flex align-items-start justify-content-center">
      <div className="container-fluid py-4 px-3">
        <div className="d-flex justify-content-center">
          <div className="w-100" style={{ maxWidth: "520px" }}>
            <div className="card cedi-card">
              <div className="card-body p-4">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="cedi-logo-container mx-auto mb-3">
                    <span className="cedi-logo-text">CEDI</span>
                  </div>
                  {/* Step pills */}
                  <div className="d-flex justify-content-center align-items-center gap-1 mb-3">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        style={{
                          width: s === 3 ? 28 : 8,
                          height: 8,
                          borderRadius: 4,
                          background: s === 3 ? "#2563eb" : s < 3 ? "#93c5fd" : "#e2e8f0",
                          transition: "all 0.3s",
                        }}
                      />
                    ))}
                  </div>
                  <h1 className="cedi-title mb-1" style={{ fontSize: "1.35rem" }}>
                    Personal Information
                  </h1>
                  <p className="text-muted small mb-0">Step 3 of 4 — Tell us a little about yourself</p>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Name row */}
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-medium text-dark small mb-1">First Name *</label>
                      <input
                        type="text" name="firstName" value={formData.firstName}
                        onChange={handleInputChange} className={inputCls("firstName")}
                        placeholder="e.g. Kofi"
                      />
                      {errors.firstName && <div className="invalid-feedback">{errors.firstName}</div>}
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-medium text-dark small mb-1">Last Name *</label>
                      <input
                        type="text" name="lastName" value={formData.lastName}
                        onChange={handleInputChange} className={inputCls("lastName")}
                        placeholder="e.g. Mensah"
                      />
                      {errors.lastName && <div className="invalid-feedback">{errors.lastName}</div>}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label fw-medium text-dark small mb-1">
                      Email Address <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <input
                      type="email" name="email" value={formData.email}
                      onChange={handleInputChange} className={inputCls("email")}
                      placeholder="e.g. yourname@gmail.com" autoComplete="email"
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                    <div className="form-text small">Used for loan notifications and account recovery.</div>
                  </div>

                  {/* DOB + Gender */}
                  <div className="row g-3 mb-4">
                    <div className="col-6">
                      <label className="form-label fw-medium text-dark small mb-1">Date of Birth *</label>
                      <input
                        type="date" name="dateOfBirth" value={formData.dateOfBirth}
                        onChange={handleInputChange} max={maxDob} className={inputCls("dateOfBirth")}
                      />
                      {errors.dateOfBirth && <div className="invalid-feedback">{errors.dateOfBirth}</div>}
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-medium text-dark small mb-1">Gender *</label>
                      <select
                        name="gender" value={formData.gender}
                        onChange={handleInputChange} className={selectCls("gender")}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Prefer not to say</option>
                      </select>
                      {errors.gender && <div className="invalid-feedback">{errors.gender}</div>}
                    </div>
                  </div>

                  {/* Location section */}
                  <div className="rounded-3 p-3 mb-4" style={{ background: "#f8faff", border: "1px solid #dbeafe" }}>
                    <p className="fw-semibold text-muted mb-3" style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      Location
                    </p>
                    <div className="mb-3">
                      <label className="form-label fw-medium text-dark small mb-1">
                        Street Address <span className="text-muted fw-normal">(optional)</span>
                      </label>
                      <input
                        type="text" name="address" value={formData.address}
                        onChange={handleInputChange} className="form-control cedi-form-input"
                        placeholder="e.g. 12 Airport Road"
                      />
                    </div>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-medium text-dark small mb-1">City *</label>
                        <input
                          type="text" name="city" value={formData.city}
                          onChange={handleInputChange} className={inputCls("city")}
                          placeholder="e.g. Accra"
                        />
                        {errors.city && <div className="invalid-feedback">{errors.city}</div>}
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium text-dark small mb-1">Region *</label>
                        <select
                          name="region" value={formData.region}
                          onChange={handleInputChange} className={selectCls("region")}
                        >
                          <option value="">Select region</option>
                          {GHANA_REGIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {errors.region && <div className="invalid-feedback">{errors.region}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="d-flex gap-3">
                    <button
                      type="button" onClick={() => navigate("/register")}
                      className="btn btn-outline-secondary flex-grow-1 py-2"
                      style={{ borderRadius: "12px" }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit" disabled={loading}
                      className="btn flex-grow-1 py-3 fw-semibold"
                      style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", borderRadius: "12px" }}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                          Saving...
                        </>
                      ) : "Continue →"}
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
