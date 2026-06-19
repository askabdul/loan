import React, { useState } from "react";

const primaryBtn = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  borderRadius: "12px",
  border: "none",
};

const WorkInfo = ({ initialData = {}, onNext, onBack }) => {
  const [form, setForm] = useState({
    employmentStatus: initialData.employmentStatus || "",
    employer:         initialData.employer         || "",
    jobTitle:         initialData.jobTitle         || "",
    monthlyIncome:    initialData.monthlyIncome    || "",
    workAddress:      initialData.workAddress      || "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.employmentStatus)
      newErrors.employmentStatus = "Please select your employment status";
    if (["employed", "self-employed"].includes(form.employmentStatus) && !form.employer)
      newErrors.employer = "Please enter your employer / business name";
    if (!form.monthlyIncome)
      newErrors.monthlyIncome = "Please enter your monthly income";
    else if (isNaN(Number(form.monthlyIncome)) || Number(form.monthlyIncome) < 0)
      newErrors.monthlyIncome = "Please enter a valid amount";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  const inputCls = (f) => `form-control cedi-form-input${errors[f] ? " is-invalid" : ""}`;

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Work Information</h5>
        <p className="text-muted small mb-4">Help us understand your financial situation</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium small">Employment Status *</label>
            <select
              name="employmentStatus" value={form.employmentStatus} onChange={handleChange}
              className={`form-select cedi-form-input${errors.employmentStatus ? " is-invalid" : ""}`}
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

          {["employed", "self-employed"].includes(form.employmentStatus) && (
            <div className="rounded-3 p-3 mb-3" style={{ background: "#f8faff", border: "1px solid #dbeafe" }}>
              <p className="fw-semibold text-muted mb-3" style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                {form.employmentStatus === "self-employed" ? "Business Details" : "Employer Details"}
              </p>
              <div className="mb-3">
                <label className="form-label fw-medium small">
                  {form.employmentStatus === "self-employed" ? "Business Name *" : "Employer Name *"}
                </label>
                <input
                  type="text" name="employer" value={form.employer} onChange={handleChange}
                  className={inputCls("employer")}
                  placeholder={form.employmentStatus === "self-employed" ? "e.g. My Business Ltd" : "e.g. Ghana Commercial Bank"}
                />
                {errors.employer && <div className="invalid-feedback">{errors.employer}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium small">Job Title / Position</label>
                <input
                  type="text" name="jobTitle" value={form.jobTitle} onChange={handleChange}
                  className="form-control cedi-form-input" placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="form-label fw-medium small">Work Address</label>
                <input
                  type="text" name="workAddress" value={form.workAddress} onChange={handleChange}
                  className="form-control cedi-form-input" placeholder="e.g. 23 Independence Ave, Accra"
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="form-label fw-medium small">Monthly Income (GHS) *</label>
            <div className="input-group">
              <span className="input-group-text fw-medium" style={{ background: "#f1f5f9", borderRight: "none" }}>GH₵</span>
              <input
                type="number" name="monthlyIncome" value={form.monthlyIncome} onChange={handleChange}
                className={`form-control cedi-form-input${errors.monthlyIncome ? " is-invalid" : ""}`}
                style={{ borderLeft: "none" }}
                placeholder="e.g. 2500" min="0" step="0.01"
              />
              {errors.monthlyIncome && <div className="invalid-feedback">{errors.monthlyIncome}</div>}
            </div>
          </div>

          <div className="d-flex gap-3">
            {onBack && (
              <button type="button" onClick={onBack}
                className="btn btn-outline-secondary flex-grow-1 py-2"
                style={{ borderRadius: "12px" }}
              >
                ← Back
              </button>
            )}
            <button type="submit" className="btn flex-grow-1 py-3 fw-semibold" style={primaryBtn}>
              Continue →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkInfo;
