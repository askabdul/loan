import React, { useState, useEffect } from "react";
import { FiPhone, FiRefreshCw, FiEdit3, FiSave, FiX } from "react-icons/fi";

const ContactInfo = () => {
  const [contactData, setContactData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState({});

  // Configuration for contact fields
  const contactConfig = {
    support_phone: {
      label: "Support Phone",
      description: "Primary customer support phone number",
      type: "tel",
      required: true,
      placeholder: "+233 XX XXX XXXX",
    },
    support_email: {
      label: "Support Email",
      description: "Customer support email address",
      type: "email",
      required: true,
      placeholder: "support@company.com",
    },
    support_whatsapp: {
      label: "WhatsApp Number",
      description: "WhatsApp support number",
      type: "tel",
      placeholder: "+233 XX XXX XXXX",
    },
    office_address: {
      label: "Office Address",
      description: "Physical office address",
      type: "textarea",
      placeholder: "Enter complete office address",
    },
    business_hours: {
      label: "Business Hours",
      description: "Operating hours for customer support",
      type: "text",
      placeholder: "Mon-Fri: 8:00 AM - 6:00 PM",
    },
    emergency_contact: {
      label: "Emergency Contact",
      description: "Emergency contact number",
      type: "tel",
      placeholder: "+233 XX XXX XXXX",
    },
    website_url: {
      label: "Website URL",
      description: "Company website URL",
      type: "url",
      placeholder: "https://www.company.com",
    },
    social_media_facebook: {
      label: "Facebook Page",
      description: "Facebook page URL",
      type: "url",
      placeholder: "https://facebook.com/company",
    },
    social_media_twitter: {
      label: "Twitter Handle",
      description: "Twitter profile URL",
      type: "url",
      placeholder: "https://twitter.com/company",
    },
    social_media_linkedin: {
      label: "LinkedIn Page",
      description: "LinkedIn company page URL",
      type: "url",
      placeholder: "https://linkedin.com/company/company",
    },
  };

  useEffect(() => {
    fetchContactData();
  }, []);

  const fetchContactData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/contact-info");
      if (response.ok) {
        const data = await response.json();
        setContactData(data.data || {});
      } else {
        throw new Error("Failed to fetch contact data");
      }
    } catch (error) {
      console.error("Error fetching contact data:", error);
      setMessage("Failed to load contact information");
    } finally {
      setLoading(false);
    }
  };

  const updateContactData = async (updates) => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/contact-info", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const result = await response.json();
        setContactData((prev) => ({ ...prev, ...updates }));
        setMessage("Contact information updated successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        throw new Error("Failed to update contact data");
      }
    } catch (error) {
      console.error("Error updating contact data:", error);
      setMessage("Failed to update contact information");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setContactData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (field) => {
    const value = contactData[field];
    const config = contactConfig[field];

    // Validation
    if (config.required && (!value || value.trim() === "")) {
      setMessage(`${config.label} is required`);
      return;
    }

    if (
      config.type === "email" &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      setMessage("Please enter a valid email address");
      return;
    }

    if (config.type === "url" && value && !/^https?:\/\/.+/.test(value)) {
      setMessage("Please enter a valid URL starting with http:// or https://");
      return;
    }

    updateContactData({ [field]: value });
    setIsEditing((prev) => ({ ...prev, [field]: false }));
  };

  const handleCancel = (field) => {
    // Reset to original value
    fetchContactData();
    setIsEditing((prev) => ({ ...prev, [field]: false }));
  };

  const renderField = (fieldKey, config) => {
    const currentValue = contactData[fieldKey] || "";
    const editing = isEditing[fieldKey];

    return (
      <div
        key={fieldKey}
        className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition"
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              {config.label}
            </label>
            <p className="text-xs text-gray-400 m-0 mt-0.5">
              {config.description}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={() => handleSave(fieldKey)}
                  disabled={saving}
                  title="Save"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition"
                >
                  <FiSave size={12} />
                </button>
                <button
                  onClick={() => handleCancel(fieldKey)}
                  disabled={saving}
                  title="Cancel"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                >
                  <FiX size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  setIsEditing((prev) => ({ ...prev, [fieldKey]: true }))
                }
                title="Edit"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
              >
                <FiEdit3 size={12} />
              </button>
            )}
          </div>
        </div>
        {editing ? (
          config.type === "textarea" ? (
            <textarea
              value={currentValue}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              placeholder={config.placeholder}
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          ) : (
            <input
              type={config.type}
              value={currentValue}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              placeholder={config.placeholder}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          )
        ) : (
          <p
            className={`text-sm m-0 ${currentValue ? "text-gray-700" : "text-gray-300 italic"}`}
          >
            {currentValue || "Not set"}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading contact
          information...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiPhone size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Contact Information
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage customer support and company contact details
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`px-5 py-3 mb-5 rounded-xl text-sm border ${message.includes("success") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
        >
          {message}
        </div>
      )}

      <div className="space-y-5">
        {[
          {
            title: "Support Contacts",
            desc: "Primary customer support channels",
            keys: [
              "support_phone",
              "support_email",
              "support_whatsapp",
              "emergency_contact",
            ],
          },
          {
            title: "Business Information",
            desc: "Office location and operating hours",
            keys: ["office_address", "business_hours", "website_url"],
          },
          {
            title: "Social Media",
            desc: "Social media presence and links",
            keys: [
              "social_media_facebook",
              "social_media_twitter",
              "social_media_linkedin",
            ],
          },
        ].map(({ title, desc, keys }) => (
          <div
            key={title}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
          >
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
              {title}
            </p>
            <p className="text-xs text-gray-400 mb-4">{desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {keys.map((key) => renderField(key, contactConfig[key]))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContactInfo;
