import React, { useState } from "react";

const primaryBtn = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  borderRadius: "12px",
  border: "none",
};

const EducationInfo = ({ initialData = {}, onNext, onBack }) => {
  const [form, setForm] = useState({
    educationLevel: initialData.educationLevel || "",
    institution:    initialData.institution    || "",
    fieldOfStudy:   initialData.fieldOfStudy   || "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.educationLevel) newErrors.educationLevel = "Please select your education level";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  const showInstitutionFields = ["diploma","bachelor","master","doctorate"].includes(form.educationLevel);

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Education Information</h5>
        <p className="text-muted small mb-4">Your educational background helps with loan assessment</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium small">Highest Education Level *</label>
            <select
              name="educationLevel" value={form.educationLevel} onChange={handleChange}
              className={`form-select cedi-form-input${errors.educationLevel ? " is-invalid" : ""}`}
            >
              <option value="">Select education level</option>
              <option value="other">No Formal Education</option>
              <option value="primary">Primary School</option>
              <option value="secondary">Junior / Senior High School</option>
              <option value="vocational">Vocational / Technical</option>
              <option value="diploma">Diploma / HND</option>
              <option value="bachelor">Bachelor's Degree</option>
              <option value="master">Master's Degree</option>
              <option value="doctorate">PhD / Doctorate</option>
            </select>
            {errors.educationLevel && <div className="invalid-feedback">{errors.educationLevel}</div>}
          </div>

          {showInstitutionFields && (
            <div className="rounded-3 p-3 mb-3" style={{ background: "#f8faff", border: "1px solid #dbeafe" }}>
              <p className="fw-semibold text-muted mb-3" style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Institution Details (Optional)
              </p>
              <div className="mb-3">
                <label className="form-label fw-medium small">Institution</label>
                <input
                  type="text" name="institution" value={form.institution} onChange={handleChange}
                  className="form-control cedi-form-input" placeholder="e.g. University of Ghana"
                />
              </div>
              <div>
                <label className="form-label fw-medium small">Field of Study</label>
                <input
                  type="text" name="fieldOfStudy" value={form.fieldOfStudy} onChange={handleChange}
                  className="form-control cedi-form-input" placeholder="e.g. Computer Science"
                />
              </div>
            </div>
          )}

          <div className="d-flex gap-3 mt-4">
            <button type="button" onClick={onBack}
              className="btn btn-outline-secondary flex-grow-1 py-2"
              style={{ borderRadius: "12px" }}
            >
              ← Back
            </button>
            <button type="submit" className="btn flex-grow-1 py-3 fw-semibold" style={primaryBtn}>
              Continue →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EducationInfo;
