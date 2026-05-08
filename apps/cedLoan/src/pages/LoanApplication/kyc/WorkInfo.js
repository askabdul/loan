import React, { useState } from "react";

const WorkInfo = ({ initialData = {}, onNext }) => {
  const [form, setForm] = useState({
    employmentStatus: initialData.employmentStatus || "",
    employer: initialData.employer || "",
    jobTitle: initialData.jobTitle || "",
    monthlyIncome: initialData.monthlyIncome || "",
    workAddress: initialData.workAddress || "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.employmentStatus)
      newErrors.employmentStatus = "Please select your employment status";
    if (
      ["employed", "self-employed"].includes(form.employmentStatus) &&
      !form.employer
    )
      newErrors.employer = "Please enter your employer / business name";
    if (!form.monthlyIncome)
      newErrors.monthlyIncome = "Please enter your monthly income";
    else if (
      isNaN(Number(form.monthlyIncome)) ||
      Number(form.monthlyIncome) < 0
    )
      newErrors.monthlyIncome = "Please enter a valid amount";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-4">Work Information</h5>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium">Employment Status *</label>
            <select
              name="employmentStatus"
              value={form.employmentStatus}
              onChange={handleChange}
              className={`form-select cedi-form-input ${errors.employmentStatus ? "is-invalid" : ""}`}
            >
              <option value="">Select employment status</option>
              <option value="employed">Employed</option>
              <option value="self-employed">Self-Employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
            </select>
            {errors.employmentStatus && (
              <div className="invalid-feedback">{errors.employmentStatus}</div>
            )}
          </div>

          {["employed", "self-employed"].includes(form.employmentStatus) && (
            <>
              <div className="mb-3">
                <label className="form-label fw-medium">
                  {form.employmentStatus === "self-employed"
                    ? "Business Name *"
                    : "Employer Name *"}
                </label>
                <input
                  type="text"
                  name="employer"
                  value={form.employer}
                  onChange={handleChange}
                  className={`form-control cedi-form-input ${errors.employer ? "is-invalid" : ""}`}
                  placeholder={
                    form.employmentStatus === "self-employed"
                      ? "e.g. My Business Ltd"
                      : "e.g. Ghana Commercial Bank"
                  }
                />
                {errors.employer && (
                  <div className="invalid-feedback">{errors.employer}</div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">
                  Job Title / Position
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  className="form-control cedi-form-input"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Work Address</label>
                <input
                  type="text"
                  name="workAddress"
                  value={form.workAddress}
                  onChange={handleChange}
                  className="form-control cedi-form-input"
                  placeholder="e.g. 23 Independence Ave, Accra"
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="form-label fw-medium">
              Monthly Income (GHS) *
            </label>
            <div className="input-group">
              <span className="input-group-text">GH₵</span>
              <input
                type="number"
                name="monthlyIncome"
                value={form.monthlyIncome}
                onChange={handleChange}
                className={`form-control cedi-form-input ${errors.monthlyIncome ? "is-invalid" : ""}`}
                placeholder="e.g. 2500"
                min="0"
                step="0.01"
              />
              {errors.monthlyIncome && (
                <div className="invalid-feedback">{errors.monthlyIncome}</div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-semibold"
          >
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
};

export default WorkInfo;
