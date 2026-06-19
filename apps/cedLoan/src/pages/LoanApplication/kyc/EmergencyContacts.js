import React, { useState } from "react";

const primaryBtn = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  borderRadius: "12px",
  border: "none",
};

const BLANK_CONTACT = { name: "", phoneNumber: "", relationship: "" };

const RELATIONSHIPS = ["Parent","Spouse","Sibling","Friend","Colleague","Other"];

const EmergencyContacts = ({ initialData = {}, onNext, onBack }) => {
  const [contacts, setContacts] = useState(() => {
    if (initialData.emergencyContacts?.length) {
      return initialData.emergencyContacts.map((c) => ({
        ...BLANK_CONTACT,
        ...c,
        phoneNumber: c.phoneNumber ?? c.phone ?? "",
      }));
    }
    return [{ ...BLANK_CONTACT }];
  });
  const [errors, setErrors] = useState([]);

  const handleContactChange = (index, field, value) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
    if (errors[index]?.[field]) {
      setErrors((prev) =>
        prev.map((e, i) => (i === index ? { ...e, [field]: "" } : e))
      );
    }
  };

  const addContact = () => setContacts((prev) => [...prev, { ...BLANK_CONTACT }]);
  const removeContact = (index) => {
    if (contacts.length === 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors = contacts.map((c) => {
      const e = {};
      if (!(c.name ?? "").trim()) e.name = "Name is required";
      const phone = (c.phoneNumber ?? "").trim();
      if (!phone) e.phoneNumber = "Phone number is required";
      else if (!/^(0[2-9]\d{8}|\+233[2-9]\d{8})$/.test(phone))
        e.phoneNumber = "Enter a valid Ghana phone number (e.g. 0244123456)";
      if (!(c.relationship ?? "").trim()) e.relationship = "Relationship is required";
      return e;
    });
    setErrors(newErrors);
    return newErrors.every((e) => Object.keys(e).length === 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onNext({ emergencyContacts: contacts });
  };

  return (
    <div className="card cedi-card">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Emergency Contacts</h5>
        <p className="text-muted small mb-4">Add at least one person we can reach if needed</p>

        <form onSubmit={handleSubmit}>
          {contacts.map((contact, i) => (
            <div
              key={i}
              className="rounded-3 p-3 mb-3 position-relative"
              style={{ background: "#f8faff", border: "1px solid #dbeafe" }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3">
                <p className="fw-semibold mb-0 small text-cedi-dark" style={{ fontSize: "0.78rem", letterSpacing: "0.02em" }}>
                  Contact {i + 1}
                </p>
                {contacts.length > 1 && (
                  <button
                    type="button" onClick={() => removeContact(i)}
                    className="btn btn-sm d-flex align-items-center gap-1"
                    style={{ fontSize: "0.72rem", color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "2px 10px" }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium small mb-1">Full Name *</label>
                <input
                  type="text" value={contact.name}
                  onChange={(e) => handleContactChange(i, "name", e.target.value)}
                  className={`form-control cedi-form-input${errors[i]?.name ? " is-invalid" : ""}`}
                  placeholder="e.g. Kwame Mensah"
                />
                {errors[i]?.name && <div className="invalid-feedback">{errors[i].name}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium small mb-1">Phone Number *</label>
                <input
                  type="tel" value={contact.phoneNumber}
                  onChange={(e) => handleContactChange(i, "phoneNumber", e.target.value)}
                  className={`form-control cedi-form-input${errors[i]?.phoneNumber ? " is-invalid" : ""}`}
                  placeholder="e.g. 0244123456"
                />
                {errors[i]?.phoneNumber && <div className="invalid-feedback">{errors[i].phoneNumber}</div>}
              </div>

              <div>
                <label className="form-label fw-medium small mb-1">Relationship *</label>
                <select
                  value={contact.relationship}
                  onChange={(e) => handleContactChange(i, "relationship", e.target.value)}
                  className={`form-select cedi-form-input${errors[i]?.relationship ? " is-invalid" : ""}`}
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r} value={r.toLowerCase()}>{r}</option>
                  ))}
                </select>
                {errors[i]?.relationship && <div className="invalid-feedback">{errors[i].relationship}</div>}
              </div>
            </div>
          ))}

          {contacts.length < 3 && (
            <button
              type="button" onClick={addContact}
              className="btn w-100 mb-4 py-2 fw-medium"
              style={{ borderRadius: "12px", border: "1.5px dashed #93c5fd", color: "#2563eb", background: "#f8faff", fontSize: "0.875rem" }}
            >
              + Add Another Contact
            </button>
          )}

          <div className="d-flex gap-3">
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

export default EmergencyContacts;
