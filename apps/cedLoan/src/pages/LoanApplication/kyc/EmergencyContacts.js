import React, { useState } from "react";

const BLANK_CONTACT = { name: "", phoneNumber: "", relationship: "" };

const EmergencyContacts = ({ initialData = {}, onNext, onBack }) => {
  const [contacts, setContacts] = useState(() => {
    if (initialData.emergencyContacts?.length) {
      // Normalize contacts that may have been saved with the old 'phone' field
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
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  };

  const addContact = () =>
    setContacts((prev) => [...prev, { ...BLANK_CONTACT }]);
  const removeContact = (index) => {
    if (contacts.length === 1) return; // keep at least 1
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors = contacts.map((c) => {
      const e = {};
      if (!(c.name ?? "").trim()) e.name = "Name is required";
      const phone = (c.phoneNumber ?? "").trim();
      if (!phone) e.phoneNumber = "Phone number is required";
      else if (!/^(0[2-9]\d{8}|\+233[2-9]\d{8})$/.test(phone))
        e.phoneNumber = "Enter a valid Ghana phone number (e.g. 0244123456)";
      if (!(c.relationship ?? "").trim())
        e.relationship = "Relationship is required";
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
        <p className="text-muted small mb-4">
          Add at least one person we can contact if needed
        </p>

        <form onSubmit={handleSubmit}>
          {contacts.map((contact, i) => (
            <div key={i} className="border rounded p-4 mb-4 position-relative">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <p className="fw-semibold mb-0 text-dark">Contact {i + 1}</p>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="btn btn-sm btn-outline-danger"
                  >
                    ✕ Remove
                  </button>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Full Name *</label>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) =>
                    handleContactChange(i, "name", e.target.value)
                  }
                  className={`form-control cedi-form-input ${errors[i]?.name ? "is-invalid" : ""}`}
                  placeholder="e.g. Kwame Mensah"
                />
                {errors[i]?.name && (
                  <div className="invalid-feedback">{errors[i].name}</div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Phone Number *</label>
                <input
                  type="tel"
                  value={contact.phoneNumber}
                  onChange={(e) =>
                    handleContactChange(i, "phoneNumber", e.target.value)
                  }
                  className={`form-control cedi-form-input ${errors[i]?.phoneNumber ? "is-invalid" : ""}`}
                  placeholder="e.g. 0244123456"
                />
                {errors[i]?.phoneNumber && (
                  <div className="invalid-feedback">
                    {errors[i].phoneNumber}
                  </div>
                )}
              </div>
              <div className="mb-1">
                <label className="form-label fw-medium">Relationship *</label>
                <select
                  value={contact.relationship}
                  onChange={(e) =>
                    handleContactChange(i, "relationship", e.target.value)
                  }
                  className={`form-select cedi-form-input ${errors[i]?.relationship ? "is-invalid" : ""}`}
                >
                  <option value="">Select relationship</option>
                  {[
                    "Parent",
                    "Spouse",
                    "Sibling",
                    "Friend",
                    "Colleague",
                    "Other",
                  ].map((r) => (
                    <option key={r} value={r.toLowerCase()}>
                      {r}
                    </option>
                  ))}
                </select>
                {errors[i]?.relationship && (
                  <div className="invalid-feedback">
                    {errors[i].relationship}
                  </div>
                )}
              </div>
            </div>
          ))}

          {contacts.length < 3 && (
            <button
              type="button"
              onClick={addContact}
              className="btn btn-outline-primary w-100 mb-4 py-2"
            >
              + Add Another Contact
            </button>
          )}

          <div className="d-flex gap-3">
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

export default EmergencyContacts;
