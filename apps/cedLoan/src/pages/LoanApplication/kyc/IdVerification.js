import React, { useState } from "react";

const primaryBtn = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  borderRadius: "12px",
  border: "none",
};

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IdVerification = ({ initialData = {}, onSubmit, onBack, submitting }) => {
  const [form, setForm] = useState({
    idType:   initialData.idType   || "",
    idNumber: initialData.idNumber || "",
  });
  const [frontFile, setFrontFile]     = useState(null);
  const [backFile, setBackFile]       = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview]   = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFile = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, [side]: "Only JPG/PNG images are accepted" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [side]: "Image must be less than 5MB" }));
      return;
    }
    setErrors((prev) => ({ ...prev, [side]: undefined }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (side === "front") { setFrontPreview(ev.target.result); setFrontFile(file); }
      else                  { setBackPreview(ev.target.result);  setBackFile(file); }
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.idType)             newErrors.idType   = "Please select your ID type";
    if (!form.idNumber.trim())    newErrors.idNumber = "Please enter your ID number";
    if (!frontFile)               newErrors.front    = "Please upload the front of your ID";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const toBase64 = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
    const idDocuments = [{ side: "front", data: await toBase64(frontFile), fileName: frontFile.name }];
    if (backFile) idDocuments.push({ side: "back", data: await toBase64(backFile), fileName: backFile.name });
    onSubmit({ idType: form.idType, idNumber: form.idNumber, idDocuments });
  };

  const UploadZone = ({ side, preview, label, required }) => (
    <div className="mb-3">
      <label className="form-label fw-medium small mb-1">
        {label} {required ? "*" : <span className="text-muted fw-normal">(optional)</span>}
      </label>
      <div
        onClick={() => document.getElementById(`${side}-id`).click()}
        className={`rounded-3 d-flex flex-column align-items-center justify-content-center${errors[side] ? " border border-danger" : ""}`}
        style={{
          minHeight: 110,
          cursor: "pointer",
          background: preview ? "transparent" : "#f8faff",
          border: errors[side] ? undefined : "1.5px dashed #93c5fd",
          borderRadius: "12px",
          padding: preview ? 0 : "16px",
          overflow: "hidden",
          transition: "background 0.2s",
        }}
      >
        {preview ? (
          <img src={preview} alt={`${side} of ID`} className="img-fluid rounded-3" style={{ maxHeight: 150, width: "100%", objectFit: "cover" }} />
        ) : (
          <>
            <UploadIcon />
            <p className="small text-muted mb-0 mt-2 fw-medium">Tap to upload</p>
            <p className="small text-muted mb-0" style={{ fontSize: "0.72rem" }}>JPG or PNG · Max 5MB</p>
          </>
        )}
      </div>
      <input id={`${side}-id`} type="file" accept="image/jpeg,image/jpg,image/png" onChange={(e) => handleFile(e, side)} className="d-none" />
      {errors[side] && <div className="text-danger small mt-1" style={{ fontSize: "0.8rem" }}>{errors[side]}</div>}
    </div>
  );

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">ID Verification</h5>
        <p className="text-muted small mb-4">We need a government-issued ID to verify your identity</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-medium small mb-1">ID Type *</label>
            <select
              name="idType" value={form.idType} onChange={handleChange}
              className={`form-select cedi-form-input${errors.idType ? " is-invalid" : ""}`}
            >
              <option value="">Select ID type</option>
              <option value="national-id">Ghana Card (National ID)</option>
              <option value="passport">Passport</option>
              <option value="voters-id">Voter's ID</option>
              <option value="drivers-license">Driver's License</option>
            </select>
            {errors.idType && <div className="invalid-feedback">{errors.idType}</div>}
          </div>

          <div className="mb-4">
            <label className="form-label fw-medium small mb-1">ID Number *</label>
            <input
              type="text" name="idNumber" value={form.idNumber} onChange={handleChange}
              className={`form-control cedi-form-input${errors.idNumber ? " is-invalid" : ""}`}
              placeholder="e.g. GHA-123456789-0"
            />
            {errors.idNumber && <div className="invalid-feedback">{errors.idNumber}</div>}
          </div>

          <UploadZone side="front" preview={frontPreview} label="Front of ID" required />
          {!["passport"].includes(form.idType) && (
            <UploadZone side="back" preview={backPreview} label="Back of ID" required={false} />
          )}

          <div className="rounded-3 p-3 mb-4 d-flex align-items-start gap-2" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <p className="small text-muted mb-0" style={{ fontSize: "0.8rem" }}>
              Your ID documents are securely stored and only used for identity verification.
            </p>
          </div>

          <div className="d-flex gap-3">
            <button type="button" onClick={onBack} disabled={submitting}
              className="btn btn-outline-secondary flex-grow-1 py-2"
              style={{ borderRadius: "12px" }}
            >
              ← Back
            </button>
            <button type="submit" disabled={submitting} className="btn flex-grow-1 py-3 fw-semibold" style={primaryBtn}>
              {submitting ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" />Saving...</>
              ) : "Complete Profile ✓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IdVerification;
