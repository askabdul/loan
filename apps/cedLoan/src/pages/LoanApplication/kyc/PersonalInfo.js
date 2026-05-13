import React, { useState } from "react";

const GHANA_REGIONS = [
  "Greater Accra","Ashanti","Western","Eastern","Central","Volta",
  "Northern","Upper East","Upper West","Brong-Ahafo","Bono East",
  "Savannah","North East","Oti","Ahafo","Western North",
];

const PersonalInfo = ({ initialData = {}, onNext }) => {
  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString()
    .split("T")[0];

  const [form, setForm] = useState({
    firstName: initialData.firstName || "",
    lastName:  initialData.lastName  || "",
    dateOfBirth: initialData.dateOfBirth || "",
    gender: initialData.gender || "",
    city:   initialData.city   || "",
    region: initialData.region || "",
    address: initialData.address || "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim())  newErrors.lastName  = "Last name is required";
    if (!form.dateOfBirth)      newErrors.dateOfBirth = "Date of birth is required";
    if (!form.gender)           newErrors.gender    = "Gender is required";
    if (!form.city.trim())      newErrors.city      = "City is required";
    if (!form.region)           newErrors.region    = "Region is required";
    if (form.dateOfBirth) {
      const today = new Date();
      const birth = new Date(form.dateOfBirth);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) newErrors.dateOfBirth = "You must be at least 18 years old";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  const inputCls = (field) =>
    `form-control cedi-form-input${errors[field] ? " is-invalid" : ""}`;

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Personal Information</h5>
        <p className="text-muted small mb-4">Tell us a bit about yourself before we process your loan.</p>
        <form onSubmit={handleSubmit}>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="form-label fw-medium">First Name *</label>
              <input
                type="text" name="firstName" value={form.firstName}
                onChange={handleChange} className={inputCls("firstName")}
                placeholder="e.g. Kofi"
              />
              {errors.firstName && <div className="invalid-feedback">{errors.firstName}</div>}
            </div>
            <div className="col-6">
              <label className="form-label fw-medium">Last Name *</label>
              <input
                type="text" name="lastName" value={form.lastName}
                onChange={handleChange} className={inputCls("lastName")}
                placeholder="e.g. Mensah"
              />
              {errors.lastName && <div className="invalid-feedback">{errors.lastName}</div>}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-medium">Date of Birth *</label>
            <input
              type="date" name="dateOfBirth" value={form.dateOfBirth}
              onChange={handleChange} max={maxDob} className={inputCls("dateOfBirth")}
            />
            {errors.dateOfBirth && <div className="invalid-feedback">{errors.dateOfBirth}</div>}
          </div>

          <div className="mb-3">
            <label className="form-label fw-medium">Gender *</label>
            <select name="gender" value={form.gender} onChange={handleChange}
              className={`form-select cedi-form-input${errors.gender ? " is-invalid" : ""}`}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Prefer not to say</option>
            </select>
            {errors.gender && <div className="invalid-feedback">{errors.gender}</div>}
          </div>

          <div className="mb-3">
            <label className="form-label fw-medium">Street Address (Optional)</label>
            <input
              type="text" name="address" value={form.address}
              onChange={handleChange} className="form-control cedi-form-input"
              placeholder="e.g. 12 Nkrumah Ave"
            />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-6">
              <label className="form-label fw-medium">City *</label>
              <input
                type="text" name="city" value={form.city}
                onChange={handleChange} className={inputCls("city")}
                placeholder="e.g. Accra"
              />
              {errors.city && <div className="invalid-feedback">{errors.city}</div>}
            </div>
            <div className="col-6">
              <label className="form-label fw-medium">Region *</label>
              <select name="region" value={form.region} onChange={handleChange}
                className={`form-select cedi-form-input${errors.region ? " is-invalid" : ""}`}>
                <option value="">Select region</option>
                {GHANA_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.region && <div className="invalid-feedback">{errors.region}</div>}
            </div>
          </div>

          <button type="submit" className="btn w-100 py-3 fw-semibold"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", borderRadius:"12px" }}>
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
};

export default PersonalInfo;
