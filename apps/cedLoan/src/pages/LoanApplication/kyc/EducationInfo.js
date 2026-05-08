import React, { useState } from "react";

const EducationInfo = ({ initialData = {}, onNext, onBack }) => {
  const [form, setForm] = useState({
    educationLevel: initialData.educationLevel || "",
    institution: initialData.institution || "",
    fieldOfStudy: initialData.fieldOfStudy || "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.educationLevel)
      newErrors.educationLevel = "Please select your education level";
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
        <h5 className="fw-bold mb-4">Education Information</h5>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium">
              Highest Education Level *
            </label>
            <select
              name="educationLevel"
              value={form.educationLevel}
              onChange={handleChange}
              className={`form-select cedi-form-input ${errors.educationLevel ? "is-invalid" : ""}`}
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
            {errors.educationLevel && (
              <div className="invalid-feedback">{errors.educationLevel}</div>
            )}
          </div>

          {["diploma", "bachelor", "master", "doctorate"].includes(
            form.educationLevel,
          ) && (
            <>
              <div className="mb-3">
                <label className="form-label fw-medium">
                  Institution (optional)
                </label>
                <input
                  type="text"
                  name="institution"
                  value={form.institution}
                  onChange={handleChange}
                  className="form-control cedi-form-input"
                  placeholder="e.g. University of Ghana"
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">
                  Field of Study (optional)
                </label>
                <input
                  type="text"
                  name="fieldOfStudy"
                  value={form.fieldOfStudy}
                  onChange={handleChange}
                  className="form-control cedi-form-input"
                  placeholder="e.g. Computer Science"
                />
              </div>
            </>
          )}

          <div className="d-flex gap-3 mt-4">
            <button
              type="button"
              onClick={onBack}
              className="btn btn-outline-secondary flex-grow-1 py-2"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-grow-1 py-2 fw-semibold"
            >
              Continue →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EducationInfo;
