import React, { useState } from "react";

const IdVerification = ({ initialData = {}, onSubmit, onBack, submitting }) => {
  const [form, setForm] = useState({
    idType: initialData.idType || "",
    idNumber: initialData.idNumber || "",
  });
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFile = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size (max 5MB)
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [side]: "Only JPG/PNG images are accepted",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [side]: "Image must be less than 5MB" }));
      return;
    }
    setErrors((prev) => ({ ...prev, [side]: undefined }));

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (side === "front") {
        setFrontPreview(ev.target.result);
        setFrontFile(file);
      } else {
        setBackPreview(ev.target.result);
        setBackFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.idType) newErrors.idType = "Please select your ID type";
    if (!form.idNumber.trim())
      newErrors.idNumber = "Please enter your ID number";
    if (!frontFile) newErrors.front = "Please upload the front of your ID";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Convert files to base64 for API submission
    const toBase64 = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });

    const idDocuments = [
      {
        side: "front",
        data: await toBase64(frontFile),
        fileName: frontFile.name,
      },
    ];
    if (backFile)
      idDocuments.push({
        side: "back",
        data: await toBase64(backFile),
        fileName: backFile.name,
      });

    onSubmit({ idType: form.idType, idNumber: form.idNumber, idDocuments });
  };

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">ID Verification</h5>
        <p className="text-muted small mb-4">
          We need a government-issued ID to verify your identity
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium">ID Type *</label>
            <select
              name="idType"
              value={form.idType}
              onChange={handleChange}
              className={`form-select cedi-form-input ${errors.idType ? "is-invalid" : ""}`}
            >
              <option value="">Select ID type</option>
              <option value="national-id">Ghana Card (National ID)</option>
              <option value="passport">Passport</option>
              <option value="voters-id">Voter's ID</option>
              <option value="drivers-license">Driver's License</option>
            </select>
            {errors.idType && (
              <div className="invalid-feedback">{errors.idType}</div>
            )}
          </div>

          <div className="mb-4">
            <label className="form-label fw-medium">ID Number *</label>
            <input
              type="text"
              name="idNumber"
              value={form.idNumber}
              onChange={handleChange}
              className={`form-control cedi-form-input ${errors.idNumber ? "is-invalid" : ""}`}
              placeholder="e.g. GHA-123456789-0"
            />
            {errors.idNumber && (
              <div className="invalid-feedback">{errors.idNumber}</div>
            )}
          </div>

          {/* Front of ID */}
          <div className="mb-3">
            <label className="form-label fw-medium">Front of ID *</label>
            <div
              className={`border rounded p-3 text-center ${errors.front ? "border-danger" : "border-dashed"}`}
              style={{
                cursor: "pointer",
                backgroundColor: frontPreview ? "transparent" : "#f8f9fa",
                minHeight: "120px",
              }}
              onClick={() => document.getElementById("front-id").click()}
            >
              {frontPreview ? (
                <img
                  src={frontPreview}
                  alt="Front of ID"
                  className="img-fluid rounded"
                  style={{ maxHeight: "150px" }}
                />
              ) : (
                <div className="py-3">
                  <div style={{ fontSize: "2rem" }}>📷</div>
                  <p className="small text-muted mb-0">
                    Tap to upload front of your ID
                  </p>
                  <p className="small text-muted">JPG or PNG, max 5MB</p>
                </div>
              )}
            </div>
            <input
              id="front-id"
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => handleFile(e, "front")}
              className="d-none"
            />
            {errors.front && (
              <div className="text-danger small mt-1">{errors.front}</div>
            )}
          </div>

          {/* Back of ID (optional for passport/voters-id) */}
          {!["passport"].includes(form.idType) && (
            <div className="mb-4">
              <label className="form-label fw-medium">
                Back of ID <span className="text-muted">(optional)</span>
              </label>
              <div
                className="border rounded p-3 text-center"
                style={{
                  cursor: "pointer",
                  backgroundColor: backPreview ? "transparent" : "#f8f9fa",
                  minHeight: "120px",
                }}
                onClick={() => document.getElementById("back-id").click()}
              >
                {backPreview ? (
                  <img
                    src={backPreview}
                    alt="Back of ID"
                    className="img-fluid rounded"
                    style={{ maxHeight: "150px" }}
                  />
                ) : (
                  <div className="py-3">
                    <div style={{ fontSize: "2rem" }}>📷</div>
                    <p className="small text-muted mb-0">
                      Tap to upload back of your ID
                    </p>
                  </div>
                )}
              </div>
              <input
                id="back-id"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFile(e, "back")}
                className="d-none"
              />
              {errors.back && (
                <div className="text-danger small mt-1">{errors.back}</div>
              )}
            </div>
          )}

          <div className="cedi-info-box mb-4">
            <p className="small text-muted mb-0">
              🔒 Your ID documents are securely stored and only used for
              identity verification purposes.
            </p>
          </div>

          <div className="d-flex gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="btn btn-outline-secondary flex-grow-1 py-2"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary flex-grow-1 py-2 fw-semibold"
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></span>
                  Saving...
                </>
              ) : (
                "Complete Profile ✓"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IdVerification;
